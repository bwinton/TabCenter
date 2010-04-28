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

     // Hashmap (id -> tab) for easy access to tabs via id (assigned by us).
     // Necessary until https://bugzilla.mozilla.org/show_bug.cgi?id=529477
     // is implemented.
    this.tabsById = {};

    // For maintaining tab IDs
    tabs.addEventListener('TabOpen', this, true);
    tabs.addEventListener('TabClose', this, true);
    tabs.addEventListener('SSTabRestoring', this, true);
    for (let i=0; i < tabs.childNodes.length; i++) {
        this.initTab(tabs.childNodes[i]);
    }

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
    kChildren: 'verticaltabs-children',
    kLabel: 'verticaltabs-grouplabel',
    kCollapsed: 'verticaltabs-collapsed',
    kDropTarget: 'verticaltabs-droptarget',

    initTab: function(aTab) {
        if (aTab.hasAttribute(this.kId)) {
            return;
        }

        let id = VTTabDataStore.getTabValue(aTab, this.kId) || this.makeNewId();
        VTTabDataStore.setTabValue(aTab, this.kId, id);
        if (!(id in this.tabsById)) {
            this.tabsById[id] = aTab;
        }
    },

    destroyTab: function(aTab) {
        var id = aTag.getAttribute(this.kId);
        if (id && (id in this.tabsById)) {
            delete this.tabsById[id];
        }
    },

    restoreTab: function(aTab) {
        // Restore tab attributes from session data (this isn't done
        // automatically).  kId is already restored in initTab()
        for each (let attr in [this.kGroup,
                               this.kInGroup,
                               this.kChildren,
                               this.kLabel,
                               this.kCollapsed]) {
            let value = VTTabDataStore.getTabValue(aTab, attr);
            if (value) {
                aTab.setAttribute(attr, value);
            }
        }

        // Restore the original ID
        let oldId = aTab.getAttribute(this.kId);
        let newId = VTTabDataStore.getTabValue(aTab, this.kId);
        if (oldId && newId) {
            delete this.tabsById[oldId];
            aTab.setAttribute(this.kId, newId);
            this.tabsById[newId] = aTab;
        }
    },

    makeNewId: function() {
        return 'tab-<' + Date.now() + '-'
               + parseInt(Math.random() * 65000) + '>';
    },

    /*** Public API ***/

    addGroup: function(aLabel) {        
        var group = this.tabs.tabbrowser.addTab();
        VTTabDataStore.setTabValue(group, this.kGroup, 'true');
        VTTabDataStore.setTabValue(group, this.kChildren, '');

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
        var childIds = VTTabDataStore.getTabValue(aGroup, this.kChildren);
        if (!childIds) {
            return [];
        }
        return [this.tabsById[id] for each (id in childIds.split('|'))];
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

        let groupId = aGroup.getAttribute(this.kId);
        VTTabDataStore.setTabValue(aTab, this.kInGroup, groupId);
        let groupChildren = VTTabDataStore.getTabValue(aGroup, this.kChildren);
        // TODO this doesn't preserve any order
        if (!groupChildren) {
            groupChildren = aTab.getAttribute(this.kId);
        } else {
            groupChildren += '|' + aTab.getAttribute(this.kId);
        }
        VTTabDataStore.setTabValue(aGroup, this.kChildren, groupChildren);
    },

    removeChild: function(aTab) {
        var groupId = VTTabDataStore.getTabValue(aTab, this.kInGroup);
        if (!groupId) {
            return;
        }

        let group = this.tabsById[groupId];
        let tabId = aTab.getAttribute(this.kId);
        let groupChildren = VTTabDataStore.getTabValue(group, this.kChildren);
        groupChildren = groupChildren.split("|");
        let index = groupChildren.indexOf(tabId);
        groupChildren.splice(index, 1);
        groupChildren = groupChildren.join("|");

        VTTabDataStore.deleteTabValue(aTab, this.kInGroup);
        VTTabDataStore.setTabValue(group, this.kChildren, groupChildren);
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
        for each (let tab in children) {
            tab.collapsed = !collapsed;
        }
        VTTabDataStore.setTabValue(aGroup, this.kCollapsed, !collapsed);
    },


    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case 'TabOpen':
            this.initTab(aEvent.originalTarget);
            return;
        case 'TabClose':
            this.destroyTab(aEvent.originalTarget);
            return;
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
        Components.utils.reportError("clearDropTargets");
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
        let group = this.tabsById[groupId];
        group.classList.add(this.kDropTarget);
    },

    onTabMove: function(aEvent) {
        var tab = aEvent.target;
        if (this.isGroup(tab)) {
            return;
        }

        // Determine whether the move should result in the tab being
        // added to a group (or removed from one).
        let next;
        let groupId;
        let nextPos = tab._tPos + 1;
        if (nextPos < this.tabs.childNodes.length) {
            // If the next tab down the line is in a group, then the
            // tab is added to that group.
            next = this.tabs.childNodes[nextPos];
            groupId = VTTabDataStore.getTabValue(next, this.kInGroup);
        } else {
            // We're moved to the last position, so let's look at the
            // previous tab.  Is it in a group, or even a group?
            nextPos = tab._tPos - 1;
            next = this.tabs.childNodes[nextPos];
            if (this.isGroup(next)) {
                groupId = next.getAttribute(this.kId);
            } else {
                groupId = VTTabDataStore.getTabValue(next, this.kInGroup);
            }
        }

        if (!groupId) {
            this.removeChild(tab)
        } else {
            this.addChild(this.tabsById[groupId], tab);
        }
    }

};
