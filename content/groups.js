var VTGroups = {
    /*
     * Functionality for grouping tabs
     */

    kId: 'verticaltabs-id',
    kGroup: 'verticaltabs-group',
    kInGroup: 'verticaltabs-ingroup',
    kChildren: 'verticaltabs-children',
    kLabel: 'verticaltabs-grouplabel',

    tabsById: {},

    init: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        tabs.addEventListener('TabOpen', this, true);
        tabs.addEventListener('TabClose', this, true);
        tabs.addEventListener('SSTabRestoring', this, true);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }

        var menuitemGroup = document.createElement('menuitem');
        menuitemGroup.setAttribute('id', 'context_verticalTabsGroup');
        menuitemGroup.setAttribute('label', 'Group'); //XXX TODO l10n
        menuitemGroup.setAttribute('tbattr', 'tabbrowser-multiple');
        menuitemGroup.setAttribute('oncommand', 'VTGroups.createGroupFromMultiSelect()');
        tabs.contextMenu.appendChild(menuitemGroup);
    },

    initTab: function(aTab) {
        if (!aTab.hasAttribute(this.kId)) {
            var id = VTTabDataStore.getTabValue(aTab, this.kId) || this.makeNewId();
            aTab.setAttribute(this.kId, id);
            window.setTimeout(function(aSelf) {
                if (!VTTabDataStore.getTabValue(aTab, aSelf.kId)) {
                    VTTabDataStore.setTabValue(aTab, aSelf.kId, id);
                    if (!(id in aSelf.tabsById)) {
                        aSelf.tabsById[id] = aTab;
                    }
                }
            }, 0, this);
            if (!(id in this.tabsById)) {
                this.tabsById[id] = aTab;
            }
        }
    },

    destroyTab: function(aTab) {
        var id = aTag.getAttribute(this.kId);
        if (id && (id in this.tabsById)) {
            delete this.tabsById[id];
        }
    },

    restoreTab: function(aTab) {
        // Restore tab attributes from session data
        // kId is already restored in initTab()
        for each (let attr in [this.kGroup,
                               this.kInGroup,
                               this.kChildren,
                               this.kLabel]) {
            let value = VTTabDataStore.getTabValue(aTab, attr);
            if (value) {
                aTab.setAttribute(attr, value);
            }
        }
    },

    makeNewId: function() {
        return 'tab-<' + Date.now() + '-'
               + parseInt(Math.random() * 65000) + '>';
    },

    addGroup: function(aLabel) {        
        var tabs = document.getElementById("tabbrowser-tabs");
        var group = tabs.tabbrowser.addTab();
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

        var groupId = aGroup.getAttribute(this.kId);
        VTTabDataStore.setTabValue(aTab, this.kInGroup, groupId);
        var groupChildren = VTTabDataStore.getTabValue(aGroup, this.kChildren);
        // TODO this doesn't preserve any order
        if (!groupChildren) {
            groupChildren = aTab.getAttribute(this.kId);
        } else {
            groupChildren += '|' + aTab.getAttribute(this.kId);
        }
        VTTabDataStore.setTabValue(aGroup, this.kChildren, groupChildren);
    },

    createGroupFromMultiSelect: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        var group = this.addGroup();
        var children = VTMultiSelect.getMultiSelection();
        for each (let tab in children) {
            this.addChild(group, tab);
            tabs.tabbrowser.moveTabTo(tab, group._tPos+1);  //XXX
        }
    },

    isGroup: function(aTab) {
        return (VTTabDataStore.getTabValue(aTab, this.kGroup) == "true");
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
        }
    }

};
