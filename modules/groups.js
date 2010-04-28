/*
 * Functionality for grouping tabs.
 *
 * Groups are implemented as a special kind of tab (see binding in
 * group.xml) that isn't selectable.  There are a few advantages and
 * disadvantages to this:
 *
 *   - Groups can be regular children of tabbrowser.tabContainer
 *     (cf. https://bugzilla.mozilla.org/show_bug.cgi?id=475142).
 *
 *   - The nsISessionStore service takes care of restoring groups and
 *     their properties.
 *
 *   - But we have to make sure that groups don't behave like tabs at
 *     all.
 */

var EXPORTED_SYMBOLS = ["VTGroups"];
Components.utils.import("resource://verticaltabs/tabdatastore.js");

function VTGroups(tabs) {
    this.tabs = tabs;
    tabs.VTGroups = this;

    // Restore group and in-group status
    tabs.addEventListener('SSTabRestoring', this, true);

    // For clicks on the twisty
    tabs.addEventListener('click', this, true);

    // For synchronizing group behaviour and tab positioning
    tabs.addEventListener('dragover', this, false);
    tabs.addEventListener('dragend', this, false);
    tabs.addEventListener('drop', this, false);
    tabs.addEventListener('TabMove', this, false);
}
VTGroups.prototype = {

    kId: 'verticaltabs-id',
    kGroup: 'verticaltabs-group',
    kInGroup: 'verticaltabs-ingroup',
    kLabel: 'verticaltabs-grouplabel',
    kCollapsed: 'verticaltabs-collapsed',
    kDropTarget: 'verticaltabs-droptarget',

    restoreTab: function(aTab) {
        // Restore tab attributes from session data (this isn't done
        // automatically).  kId is restored by VTTabIDs.
        for each (let attr in [this.kGroup,
                               this.kInGroup,
                               this.kLabel,
                               this.kCollapsed]) {
            let value = VTTabDataStore.getTabValue(aTab, attr);
            if (value) {
                aTab.setAttribute(attr, value);
            }
        }
    },

    /*** Public API ***/

    addGroup: function(aLabel) {        
        var group = this.tabs.tabbrowser.addTab();
        VTTabDataStore.setTabValue(group, this.kGroup, 'true');

        //XXX this doesn't work since the binding isn't made available
        // synchronously :(
/*
        if (aLabel) {
            VTTabDataStore.setTabValue(group, this.kLabel, aLabel);
            group.groupLabel = aLabel;
        } else {
            group.editLabel();
        }
*/
        return group;
    },

    getChildren: function(aGroup) {
        var groupId = this.tabs.VTTabIDs.id(aGroup);
        return this.tabs.getElementsByAttribute(this.kInGroup, groupId);
    },

    addChild: function(aGroup, aTab) {
        // Only groups can have children
        if (!this.isGroup(aGroup)) {
            return;
        }
        // We don't allow nested groups
        if (this.isGroup(aTab)) {
            return;
        }

        // Remove the tab from its current group, if it belongs to one.
        this.removeChild(aTab);

        let groupId = this.tabs.VTTabIDs.id(aGroup);
        VTTabDataStore.setTabValue(aTab, this.kInGroup, groupId);
    },

    removeChild: function(aTab) {
        var groupId = VTTabDataStore.getTabValue(aTab, this.kInGroup);
        if (!groupId) {
            return;
        }

        VTTabDataStore.deleteTabValue(aTab, this.kInGroup);
    },

    createGroupFromMultiSelect: function() {
        var group = this.addGroup();
        var children = this.tabs.VTMultiSelect.getMultiSelection();
        for each (let tab in children) {
            // Moving the tabs to the right position is enough, the
            // TabMove handler knows the right thing to do.
            this.tabs.tabbrowser.moveTabTo(tab, group._tPos+1);
        }
    },

    isGroup: function(aTab) {
        return (VTTabDataStore.getTabValue(aTab, this.kGroup) == "true");
    },

    collapseExpand: function(aGroup) {
        if (!this.isGroup(aGroup)) {
            return;
        }
        let collapsed = (VTTabDataStore.getTabValue(aGroup, this.kCollapsed) == "true");
        let children = this.getChildren(aGroup);
        for (let i=0; i < children.length; i++) {
            children[i].collapsed = !collapsed;
        }
        VTTabDataStore.setTabValue(aGroup, this.kCollapsed, !collapsed);
    },


    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case 'SSTabRestoring':
            this.restoreTab(aEvent.originalTarget);
            return;
        case "click":
            this.onClick(aEvent);
            return;
        case "dragover":
            this.onDragOver(aEvent);
            return;
        case "dragend":
        case "drop":
            this.clearDropTargets();
            return;
        case 'TabMove':
            this.onTabMove(aEvent);
            return;
        }
    },

    onClick: function(aEvent) {
        var tab = aEvent.target;
        if (tab.localName != "tab") {
            return;
        }
        if (aEvent.originalTarget !== tab.mTwisty) {
            return;
        }
        this.collapseExpand(tab);
    },

    clearDropTargets: function() {
        var groups = this.tabs.getElementsByClassName(this.kDropTarget);
        for (let i=0; i < groups.length; i++) {
            groups[i].classList.remove(this.kDropTarget);
        }
    },

    onDragOver: function(aEvent) {
        if (aEvent.target.localName != "tab") {
            return;
        }
        let dropindex = this.tabs._getDropIndex(aEvent);
        let tab = this.tabs.childNodes[dropindex];
        let groupId = VTTabDataStore.getTabValue(tab, this.kInGroup);

        if (!groupId) {
            // Potentially remove drop style
            this.clearDropTargets();
            return;
        }

        //TODO change drop indicator's left margin
        // Add drop style to the group
        let group = this.tabs.VTTabIDs.get(groupId);
        group.classList.add(this.kDropTarget);
    },

    onTabMove: function(aEvent) {
        var tab = aEvent.target;
        if (this.isGroup(tab)) {
            return;
        }

        // Determine whether the move should result in the tab being
        // added to a group (or removed from one).
        let group;
        let nextPos = tab._tPos + 1;
        if (nextPos < this.tabs.childNodes.length) {
            // If the next tab down the line is in a group, then the
            // tab is added to that group.
            let next = this.tabs.childNodes[nextPos];
            let groupId = VTTabDataStore.getTabValue(next, this.kInGroup);
            group = this.tabs.VTTabIDs.get(groupId);
        } else {
            // We're moved to the last position, so let's look at the
            // previous tab.  Is it in a group, or even a group?
            nextPos = tab._tPos - 1;
            let prev = this.tabs.childNodes[nextPos];
            if (this.isGroup(prev)) {
                group = prev;
            } else {
                let groupId = VTTabDataStore.getTabValue(prev, this.kInGroup);
                group = this.tabs.VTTabIDs.get(groupId);
            }
        }

        if (!group) {
            this.removeChild(tab)
        } else {
            this.addChild(group, tab);
        }
    }

};
