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
        // restore their width from previous session, and place a
        // splitter between them.
        var tabs = document.getElementById("tabbrowser-tabs");
        contentbox.parentNode.insertBefore(tabs, contentbox);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary
        tabs.removeAttribute("flex");
        tabs.setAttribute("width", this.prefs.getIntPref('extensions.verticaltabs.width'));

        var splitter = document.createElement("splitter");
        splitter.setAttribute("id", "verticaltabs-splitter");
        splitter.setAttribute("class", "chromeclass-extrachrome");
        contentbox.parentNode.insertBefore(splitter, contentbox);
        splitter.addEventListener('mouseup', this, false);

        // New methods and event handlers for drag'n'drop.  The
        // original tabbrowser naturally makes the assumption that
        // stuff is laid out horizontally.
        tabs._setEffectAllowedForDataTransfer
            = TabbrowserTabs._setEffectAllowedForDataTransfer;
        tabs.addEventListener('dragover', this, false);

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
        case 'dragover':
            TabbrowserTabs.onDragOver(aEvent);
            return;
        }
    },

    onTabOpen: function(aEvent) {
        this.initTab(aEvent.originalTarget);
    },

    onMouseUp: function(aEvent) {
        if (aEvent.target.getAttribute("id") == "verticaltabs-splitter") {
            this.onTabbarResized();
        }
    }

};

window.addEventListener("DOMContentLoaded", VerticalTabs, false);

var TabbrowserTabs = {

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

    // Calculate the drop indocator's position for vertical tabs
    onDragOver: function(aEvent) {
        var tabs = document.getElementById("tabbrowser-tabs");
        var ind = tabs._tabDropIndicator;
        var newIndex = tabs._getDropIndex(aEvent);

        var rect = tabs.getBoundingClientRect();
        var tabRect = tabs.childNodes[newIndex].getBoundingClientRect();
        var newMargin = tabRect.top - rect.top;

        newMargin += ind.clientHeight / 2;
        ind.style.MozTransform = "translate(0, " + Math.round(newMargin) + "px)";
        ind.style.MozMarginStart = null;
        ind.style.marginTop = null;
    }

};
