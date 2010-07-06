/*
 * Functionality for grouping tabs.
 *
 * Groups are implemented as a special kind of tab (see binding in
 * group.xml).  There are a few advantages and disadvantages to this:
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

const EXPORTED_SYMBOLS = ["VTGroups"];
Components.utils.import("resource://verticaltabs/tabdatastore.js");

const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";

function VTGroups(tabs) {
    this.tabs = tabs;
    tabs.VTGroups = this;

    // Restore group and in-group status
    tabs.addEventListener('SSTabRestoring', this, true);

    // Updating UI
    tabs.addEventListener('TabSelect', this, false);

    // For clicks on the twisty
    tabs.addEventListener('click', this, true);

    // For synchronizing group behaviour and tab positioning
    tabs.addEventListener('dragover', this, false);
    tabs.addEventListener('dragenter', this, false);
    tabs.addEventListener('dragleave', this, false);
    tabs.addEventListener('dragend', this, false);
    tabs.addEventListener('drop', this, false);
    tabs.addEventListener('TabMove', this, false);
    tabs.addEventListener('TabClose', this, false);
}
VTGroups.prototype = {

    kId: 'verticaltabs-id',
    kGroup: 'verticaltabs-group',
    kInGroup: 'verticaltabs-ingroup',
    kLabel: 'verticaltabs-grouplabel',
    kCollapsed: 'verticaltabs-collapsed',
    kDropTarget: 'verticaltabs-droptarget',
    kDropInGroup: 'verticaltabs-dropingroup',
    kDropToNewGroup: 'verticaltabs-droptonewgroup',
    kIgnoreMove: 'verticaltabs-ignoremove',


    /*** Public API ***/

    /*
     * Create a new group tab.  If given as an argument, the label is
     * applied to the group.  Otherwise the label will be made
     * editable.
     */
    addGroup: function(aLabel) {        
        let group = this.tabs.tabbrowser.addTab();
        VTTabDataStore.setTabValue(group, this.kGroup, "true");

        let window = this.tabs.ownerDocument.defaultView;
        function makeLabelEditable() {
            // XBL bindings aren't applied synchronously.
            if (typeof group.editLabel !== "function") {
                window.setTimeout(makeLabelEditable, 10);
                return;
            }
            group.editLabel();
        }

        if (aLabel) {
            VTTabDataStore.setTabValue(group, this.kLabel, aLabel);
            group.groupLabel = aLabel;
        } else {
            makeLabelEditable();
        }

        return group;
    },

    /*
     * Return the child tabs of a given group.  The return value is a
     * JavaScript Array (not just a NodeList) and is "owned" by the
     * caller (e.g. it may be modified).
     */
    getChildren: function(aGroup) {
        let groupId = this.tabs.VTTabIDs.id(aGroup);
        let children = this.tabs.getElementsByAttribute(this.kInGroup, groupId);
        // Return a copy
        return Array.prototype.slice.call(children);
    },

    /*
     * Add a tab to a group.  This won't physically move the tab
     * anywhere, just create the logical connection.
     */
    addChild: function(aGroup, aTab) {
        // Only groups can have children
        if (!this.isGroup(aGroup)) {
            return;
        }
        // We don't allow nested groups
        if (this.isGroup(aTab)) {
            return;
        }

        // Assign a group to the tab.  If the tab was in another group
        // before, this will simply overwrite the old value.
        let groupId = this.tabs.VTTabIDs.id(aGroup);
        VTTabDataStore.setTabValue(aTab, this.kInGroup, groupId);

        // Apply the group's collapsed state to the tab
        let collapsed = (VTTabDataStore.getTabValue(aGroup, this.kCollapsed)
                         == "true");
        this._tabCollapseExpand(aTab, collapsed); 
    },

    addChildren: function(aGroup, aTabs) {
        for each (let tab in aTabs) {
            this.addChild(aGroup, tab);
        }
    },

    /*
     * Remove a tab from its group.
     */
    removeChild: function(aTab) {
        let groupId = VTTabDataStore.getTabValue(aTab, this.kInGroup);
        if (!groupId) {
            return;
        }

        VTTabDataStore.deleteTabValue(aTab, this.kInGroup);
    },

    removeChildren: function(aTabs) {
        for each (let tab in aTabs) {
            this.removeChild(tab);
        }
    },

    /*
     * Creates a tab from the active selection.
     */
    createGroupFromMultiSelect: function() {
        let group = this.addGroup();
        let children = this.tabs.VTMultiSelect.getSelected();
        for each (let tab in children) {
            // Moving the tabs to the right position is enough, the
            // TabMove handler knows the right thing to do.
            this.tabs.tabbrowser.moveTabTo(tab, group._tPos+1);
        }
        this.tabs.VTMultiSelect.clear();
    },

    /*
     * Return true if a given tab is a group tab.
     */
    isGroup: function(aTab) {
        return (VTTabDataStore.getTabValue(aTab, this.kGroup) == "true");
    },

    /*
     * Toggle collapsed/expanded state of a group tab.
     */
    collapseExpand: function(aGroup) {
        if (!this.isGroup(aGroup)) {
            return;
        }
        let collapsed = (VTTabDataStore.getTabValue(aGroup, this.kCollapsed)
                         == "true");
        for each (let tab in this.getChildren(aGroup)) {
            this._tabCollapseExpand(tab, !collapsed);
            if (tab.selected) {
                this.tabs.tabbrowser.selectedTab = aGroup;
            }
        }
        VTTabDataStore.setTabValue(aGroup, this.kCollapsed, !collapsed);
    },


    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case "SSTabRestoring":
            this.onTabRestoring(aEvent.originalTarget);
            return;
        case "TabSelect":
            this.onTabSelect(aEvent);
            return;
        case "TabMove":
            this.onTabMove(aEvent);
            return;
        case "TabClose":
            this.onTabClose(aEvent);
            return;
        case "click":
            this.onClick(aEvent);
            return;
        case "dragover":
            this.onDragOver(aEvent);
            return;
        case "dragenter":
            this.onDragEnter(aEvent);
            return;
        case "dragleave":
            this.onDragLeave(aEvent);
            return;
        case "dragend":
            this._clearDropTargets();
            return;
        case "drop":
            this.onDrop(aEvent);
            return;
        }
    },

    onTabRestoring: function(aTab) {
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

        // Restore collapsed state if we belong to a group.
        let groupId = VTTabDataStore.getTabValue(aTab, this.kInGroup);
        if (!groupId) {
            return;
        }

        let self = this;
        let window = this.tabs.ownerDocument.defaultView;
        function restoreCollapsedState() {
            // The group tab we belong to may not have been restored yet.
            let group = self.tabs.VTTabIDs.get(groupId);
            if (group === undefined) {
                window.setTimeout(restoreCollapsedState, 10);
                return;
            }
            let collapsed = (VTTabDataStore.getTabValue(group, self.kCollapsed)
                             == "true");
            self._tabCollapseExpand(aTab, collapsed);
        }
        restoreCollapsedState();
    },

    _tabCollapseExpand: function(aTab, collapsed) {
        if (collapsed) {
            aTab.classList.add(this.kCollapsed);
        } else {
            aTab.classList.remove(this.kCollapsed);
        }
    },

    onTabSelect: function(aEvent) {
        let tab = aEvent.target;
        let document = tab.ownerDocument;
        let urlbar = document.getElementById("urlbar");

        let isGroup = this.isGroup(tab);
        if (isGroup) {
            //TODO l10n
            urlbar.placeholder = "Group: " + tab.groupLabel;
        } else {
            urlbar.placeholder = urlbar.getAttribute("bookmarkhistoryplaceholder");
            // Selecting a tab that's in a collapsed group will expand
            // the group.
            if (tab.classList.contains(this.kCollapsed)) {
                let groupId = VTTabDataStore.getTabValue(tab, this.kInGroup);
                if (groupId) {
                    let group = this.tabs.VTTabIDs.get(groupId);
                    this.collapseExpand(group);
                }
            }
        }
        urlbar.disabled = isGroup;

        //XXX this doesn't quite work:
        let buttons = ["reload-button", "home-button", "urlbar", "searchbar"];
        for (let i=0; i < buttons.length; i++) {
            let element = document.getElementById(buttons[i]);
            element.disabled = isGroup;
        }
    },

    onClick: function(aEvent) {
        let tab = aEvent.target;
        if (tab.localName != "tab") {
            return;
        }
        if (aEvent.originalTarget !== tab.mTwisty) {
            return;
        }
        this.collapseExpand(tab);
    },

    /*
     * Remove style from all potential drop targets (usually there
     * should only be one...).
     */
    _clearDropTargets: function() {
        let groups = this.tabs.getElementsByClassName(this.kDropTarget);
        // Make a copy of the array before modifying its contents.
        groups = Array.prototype.slice.call(groups);
        for (let i=0; i < groups.length; i++) {
            groups[i].classList.remove(this.kDropTarget);
        }
    },

    onDragOver: function(aEvent) {
        if (aEvent.target.localName != "tab") {
            return;
        }
        // Potentially remove drop target style
        //XXX is this inefficient?
        this._clearDropTargets();

        // Directly dropping on a group or the tab icon:
        // Disable drop indicator, mark tab as drop target.
        if (this.isGroup(aEvent.target)
           || (aEvent.originalTarget.classList
               && aEvent.originalTarget.classList.contains("tab-icon-image"))) {
            aEvent.target.classList.add(this.kDropTarget);
            this.tabs._tabDropIndicator.collapsed = true;
            return;
        }

        // Find out if the tab's new position would add it to a group.
        // If so, mark the group as drop target and indent drop indicator.
        let dropindex = this.tabs._getDropIndex(aEvent);
        let tab = this.tabs.childNodes[dropindex];
        let groupId = VTTabDataStore.getTabValue(tab, this.kInGroup);
        if (!groupId) {
            this.tabs._tabDropIndicator.classList.remove(this.kDropInGroup);
            return;
        }
        // Add drop style to the group and the indicator
        let group = this.tabs.VTTabIDs.get(groupId);
        group.classList.add(this.kDropTarget);
        this.tabs._tabDropIndicator.classList.add(this.kDropInGroup);
    },

    onDragEnter: function(aEvent) {
        if (aEvent.target.localName != "tab") {
            return;
        }
        // Dragging a tab over a tab's icon changes the icon to the
        // "create group" icon.
        if (aEvent.originalTarget.classList
            && aEvent.originalTarget.classList.contains("tab-icon-image")) {
            aEvent.originalTarget.classList.add(this.kDropToNewGroup);
        }
    },

    onDragLeave: function(aEvent) {
        if (aEvent.target.localName != "tab") {
            return;
        }
        // Change the tab's icon back from the "create group" to
        // whatever it was before.
        if (aEvent.originalTarget.classList
            && aEvent.originalTarget.classList.contains("tab-icon-image")) {
            aEvent.originalTarget.classList.remove(this.kDropToNewGroup);
        }
    },

    onDrop: function(aEvent) {
        this._clearDropTargets();
        let tab = aEvent.target;

        let dt = aEvent.dataTransfer;
        let draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
        if (!this.tabs._isAllowedForDataTransfer(draggedTab)) {
            return;
        }

        // Dropping a tab on another tab's icon will create a new
        // group with those two tabs in it.
        if (aEvent.originalTarget.classList
            && aEvent.originalTarget.classList.contains("tab-icon-image")) {
            let group = this.addGroup();
            this.tabs.tabbrowser.moveTabTo(tab, group._tPos+1);
            this.tabs.tabbrowser.moveTabTo(draggedTab, group._tPos+1);
            return;
        }

        // Dropping on a group will append to that group's children.
        if (this.isGroup(tab)) {
            if (this.isGroup(draggedTab)) {
                // If it's a group we're dropping, merge groups.
                this.addChildren(tab, this.getChildren(draggedTab));
                this.tabs.tabbrowser.removeTab(draggedTab);
            } else {
                this.addChild(tab, draggedTab);
            }
        }
    },

    onTabMove: function(aEvent) {
        let tab = aEvent.target;
        if (tab.getAttribute(this.kIgnoreMove) == "true") {
            tab.removeAttribute(this.kIgnoreMove);
            return;
        }

        if (this.isGroup(tab)) {
            let newGroup = this._findGroupFromContext(tab);

            // Move group's children.
            let children = this.getChildren(tab);
            let offset = 0;
            if (children.length && children[0]._tPos > tab._tPos) {
                offset = 1;
            }
            for (let i = 0; i < children.length; i++) {
                children[i].setAttribute(this.kIgnoreMove, "true");
                this.tabs.tabbrowser.moveTabTo(children[i],
                                               tab._tPos + i + offset);
            }

            // If we're being dragged into another group, merge groups.
            if (newGroup) {
                this.addChildren(newGroup, children);
                this.tabs.tabbrowser.removeTab(tab);
            }
            return;
        }

        let group = this._findGroupFromContext(tab);
        if (!group) {
            this.removeChild(tab);
        } else {
            this.addChild(group, tab);
        }
    },


    /*
     * Determine whether a tab move should result in the tab being
     * added to a group (or removed from one).
     */
    _findGroupFromContext: function(tab) {
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
            // previous tab.  Is it a group or in a group?
            nextPos = tab._tPos - 1;
            let prev = this.tabs.childNodes[nextPos];
            if (this.isGroup(prev)) {
                group = prev;
            } else {
                let groupId = VTTabDataStore.getTabValue(prev, this.kInGroup);
                group = this.tabs.VTTabIDs.get(groupId);
            }
        }
        return group;
    },

    onTabClose: function(aEvent) {
        let group = aEvent.target;
        if (!this.isGroup(group)) {
            return;
        }

        // If a collapsed group is removed, close its children as
        // well.  Otherwise just remove their group pointer.
        let collapsed = (VTTabDataStore.getTabValue(group, this.kCollapsed)
                         == "true");
        let children = this.getChildren(group);

        if (!collapsed) {
            this.removeChildren(children);
            return;
        }

        let window = group.ownerDocument.defaultView;
        let tabbrowser = this.tabs.tabbrowser;
        // Remove children async to avoid confusing tabbrowser.removeTab()
        window.setTimeout(function() {
            for each (let tab in children) {
                tabbrowser.removeTab(tab);
            }
        }, 10);
    }

};
