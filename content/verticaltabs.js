Components.utils.import("resource://verticaltabs/tabdatastore.js");
Components.utils.import("resource://verticaltabs/multiselect.js");
Components.utils.import("resource://verticaltabs/groups.js");

/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
var VerticalTabs = {

    init: function() {
        window.removeEventListener("DOMContentLoaded", this, false);

        // Move the bottom stuff (statusbar, findbar) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        let contentbox = document.getElementById("appcontent");
        let bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        let leftbox = document.getElementById("verticaltabs-box");
        let tabs = document.getElementById("tabbrowser-tabs");
        leftbox.insertBefore(tabs, leftbox.firstChild);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary
        tabs.setAttribute("width", Services.prefs.getIntPref('extensions.verticaltabs.width'));

        // Hook up event handler for splitter so that the width of the
        // tab bar is persisted.
        let splitter = document.getElementById("verticaltabs-splitter");
        splitter.addEventListener('mouseup', this, false);

        VTTabbrowserTabs.patch();
        this.tabIDs = new VTTabIDs(tabs);
        this.multiSelect = new VTMultiSelect(tabs);
        this.groups = new VTGroups(tabs);

        // Fix up each individual tab for vertical layout, including
        // ones that are opened later on.
        tabs.addEventListener('TabOpen', this, true);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }

        tabs.contextMenu.addEventListener('popupshowing', this, false);
    },

    initTab: function(aTab) {
        aTab.setAttribute('align', 'stretch');
        aTab.removeAttribute('maxwidth');
        aTab.removeAttribute('minwidth');
        aTab.removeAttribute('width');
        aTab.removeAttribute('flex');
        aTab.maxWidth = 65000;
        aTab.minWidth = 0;
    },

	onTabbarResized: function() {
        let tabs = document.getElementById("tabbrowser-tabs");
        setTimeout(function() {
            Services.prefs.setIntPref('extensions.verticaltabs.width',
                                      tabs.boxObject.width);
        }, 10);
	},

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case 'DOMContentLoaded':
            this.init();
            return;
        case 'TabOpen':
            this.onTabOpen(aEvent);
            return;
        case 'mouseup':
            this.onMouseUp(aEvent);
            return;
        case 'popupshowing':
            this.onPopupShowing(aEvent);
            return;
        }
    },

    onTabOpen: function(aEvent) {
        this.initTab(aEvent.target);
    },

    onMouseUp: function(aEvent) {
        if (aEvent.target.getAttribute("id") == "verticaltabs-splitter") {
            this.onTabbarResized();
        }
    },

    onPopupShowing: function(aEvent) {
        let closeTabs = document.getElementById('context_verticalTabsCloseMultiple');
        let tabs = this.multiSelect.getSelected();
        if (tabs.length > 1) {
            closeTabs.disabled = false;
        } else {
            closeTabs.disabled = true;
        }
    }

};
window.addEventListener("DOMContentLoaded", VerticalTabs, false);
