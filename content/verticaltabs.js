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
            return;
        }
        if (aTab.getAttribute("multiselect") == "true") {
            aTab.removeAttribute("multiselect");
        } else {
            aTab.setAttribute("multiselect", "true");
        }
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

var TabbrowserTabs = {

    _getDropIndex: function(event) {
        var tabs = this.childNodes;
        var tab = this._getDragTargetTab(event);
        // CHANGE for Vertical Tabs: no ltr handling, X -> Y, width -> height
        for (let i = tab ? tab._tPos : 0; i < tabs.length; i++)
            if (event.screenY < tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2) 
                return i;
        return tabs.length;
    },

    _setEffectAllowedForDataTransfer: function(event) {
        var dt = event.dataTransfer;
        // Disallow dropping multiple items
        if (dt.mozItemCount > 1)
            return dt.effectAllowed = "none";

        var types = dt.mozTypesAt(0);
        var sourceNode = null;
        // tabs are always added as the first type
        if (types[0] == TAB_DROP_TYPE) {
            var sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
            if (sourceNode instanceof XULElement &&
                sourceNode.localName == "tab" &&
                (sourceNode.parentNode == this ||
                 (sourceNode.ownerDocument.defaultView instanceof ChromeWindow &&
                  sourceNode.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser"))) {
                if (sourceNode.parentNode == this &&
                    // CHANGE for Vertical Tabs: X -> Y, width -> height
                    (event.screenY >= sourceNode.boxObject.screenY &&
                     event.screenY <= (sourceNode.boxObject.screenY +
                                       sourceNode.boxObject.height))) {
                    return dt.effectAllowed = "none";
                }

                return dt.effectAllowed = "copyMove";
            }
        }

        for (let i = 0; i < this._supportedLinkDropTypes.length; i++) {
            if (types.contains(this._supportedLinkDropTypes[i])) {
                // Here we need to to do this manually
                return dt.effectAllowed = dt.dropEffect = "link";
            }
        }
        return dt.effectAllowed = "none";
    },

    // Calculate the drop indocator's position for vertical tabs.
    // Overwrites what the original 'dragover' event handler does
    // towards the end.
    onDragOver: function(aEvent) {
        var tabs = document.getElementById("tabbrowser-tabs");
        var ind = tabs._tabDropIndicator;
        var newIndex = tabs._getDropIndex(aEvent);
        var rect = tabs.getBoundingClientRect();
        var newMargin;

        if (newIndex == tabs.childNodes.length) {
            let tabRect = tabs.childNodes[newIndex-1].getBoundingClientRect();
            newMargin = tabRect.bottom - rect.top;
        } else {
            let tabRect = tabs.childNodes[newIndex].getBoundingClientRect();
            newMargin = tabRect.top - rect.top;
        }

        newMargin += ind.clientHeight / 2;
        ind.style.MozTransform = "translate(0, " + Math.round(newMargin) + "px)";
        ind.style.MozMarginStart = null;
        ind.style.marginTop = null;
        ind.style.maxWidth = rect.width + "px";
    }

};
