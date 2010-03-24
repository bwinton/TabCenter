var VerticalTabsTabbrowserTabs = {
    /*
     * Patches for the tabbrowser-tabs object.  Necessary where the
     * original implementation assumes a horizontal layout.
     */

    init: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        tabs._getDropIndex = this._getDropIndex;
        tabs._setEffectAllowedForDataTransfer
            = this._setEffectAllowedForDataTransfer;
        tabs.addEventListener('dragover', this.onDragOver, false);
    },

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
