var VerticalTabs = {

    prefs: Components.classes["@mozilla.org/preferences-service;1"]
           .getService(Components.interfaces.nsIPrefBranch)
           .QueryInterface(Components.interfaces.nsIPrefBranch2),

    init: function() {
        window.removeEventListener("DOMContentLoaded", this, false);

        // Move the bottom stuff (statusbar, findbar) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        var contentbox = document.getElementById("appcontent");
        var bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        var leftbox = document.getElementById("verticaltabs-box");
        var tabs = document.getElementById("tabbrowser-tabs");
        leftbox.insertBefore(tabs, leftbox.firstChild);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary
        tabs.setAttribute("width", this.prefs.getIntPref('extensions.verticaltabs.width'));

        // Hook up event handler for splitter so that the width of the
        // tab bar is persisted.
        var splitter = document.getElementById("verticaltabs-splitter");
        splitter.addEventListener('mouseup', this, false);

        // New methods and event handlers for drag'n'drop.  The
        // original tabbrowser naturally makes the assumption that
        // stuff is laid out horizontally.
        tabs._getDropIndex = TabbrowserTabs._getDropIndex;
        tabs._setEffectAllowedForDataTransfer
            = TabbrowserTabs._setEffectAllowedForDataTransfer;
        tabs.addEventListener('dragover', this, false);

        // Multiselect
        tabs.addEventListener('mousedown', this, true);
        tabs.addEventListener('TabSelect', this, false);

        // Fix up each individual tab for vertical layout, including
        // ones that are opened later on.
        tabs.addEventListener('TabOpen', this, true);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }
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
        var tabs = document.getElementById("tabbrowser-tabs");
        setTimeout(
            function(self) {
                self.prefs.setIntPref('extensions.verticaltabs.width',
                                      tabs.boxObject.width);
            }, 10, this);
	},

    toggleMultiSelect: function(aTab) {
        if (aTab.selected) {
            let tab = this.findClosestMultiSelectedTab(aTab);
            let tabs = document.getElementById("tabbrowser-tabs");
            if (tab) {
                tab.setAttribute("multiselect-noclear", "true");
                tabs.tabbrowser.selectedTab = tab;
            }
            return;
        }
        if (aTab.getAttribute("multiselect") == "true") {
            aTab.removeAttribute("multiselect");
        } else {
            aTab.setAttribute("multiselect", "true");
        }
    },

    findClosestMultiSelectedTab: function(aTab) {
        var tabs = document.getElementById("tabbrowser-tabs");
        var i = 1;
        var tab;
        while ((aTab._tPos - i >= 0) ||
               (aTab._tPos + i < tabs.childNodes.length)) {
            if (aTab._tPos - i >= 0) {
                tab = tabs.childNodes[aTab._tPos - i];
                if (tab.getAttribute("multiselect") == "true") {
                    return tab;
                }
            }
            if (aTab._tPos + i < tabs.childNodes.length) {
                tab = tabs.childNodes[aTab._tPos + i];
                if (tab.getAttribute("multiselect") == "true") {
                    tab.setAttribute("multiselect-noclear", "true");
                    return tab;
                }
            }
            i++;
        }
        return null;
    },

    multiSpanSelect: function(aBeginTab, aEndTab) {
        this.clearMultiSelect();
        var tabs = document.getElementById("tabbrowser-tabs");
        var begin = aBeginTab._tPos;
        var end = aEndTab._tPos;
        if (begin > end) {
            [end, begin] = [begin, end];
        }
        for (let i=begin; i <= end; i++) {
            tabs.childNodes[i].setAttribute("multiselect", "true");
        }
    },

    clearMultiSelect: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        for (let i=0; i < tabs.childNodes.length; i++ ) {
            tabs.childNodes[i].removeAttribute("multiselect");
        }
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
        case 'TabSelect':
            this.onTabSelect(aEvent);
            return;
        case 'mouseup':
            this.onMouseUp(aEvent);
            return;
        case 'mousedown':
            this.onMouseDown(aEvent);
            return;
        case 'dragover':
            TabbrowserTabs.onDragOver(aEvent);
            return;
        }
    },

    onTabOpen: function(aEvent) {
        this.initTab(aEvent.originalTarget);
    },

    onTabSelect: function(aEvent) {
        if (aEvent.target.getAttribute("multiselect-noclear") == "true") {
            aEvent.target.removeAttribute("multiselect");
            aEvent.target.removeAttribute("multiselect-noclear");
            return;
        }
        this.clearMultiSelect();
    },

    onMouseUp: function(aEvent) {
        if (aEvent.target.getAttribute("id") == "verticaltabs-splitter") {
            this.onTabbarResized();
        }
    },

    onMouseDown: function(aEvent) {
        if (aEvent.target.localName != "tab") {
            return;
        }
        if (aEvent.button != 0) {
            return;
        }

        // Check for Ctrl+click (multiselection).  On the Mac it's
        // Cmd+click which is represented by metaKey.  Ctrl+click won't be
        // possible on the Mac because that would be a right click (button 2)
        if (aEvent.ctrlKey || aEvent.metaKey) {
            this.toggleMultiSelect(aEvent.target);
            aEvent.stopPropagation();
        } else if (aEvent.shiftKey) {
            let tabs = document.getElementById("tabbrowser-tabs");
            this.multiSpanSelect(tabs.tabbrowser.selectedTab, aEvent.target);
            aEvent.stopPropagation();
        } else if (aEvent.target.selected) {
            // Clicking on the already selected tab won't fire a
            // TabSelect event, but we still want to deselect any
            // other tabs.
            this.clearMultiSelect();
        }
    }

};

window.addEventListener("DOMContentLoaded", VerticalTabs, false);
