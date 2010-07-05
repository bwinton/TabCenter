/*
 * Patches for the tabbrowser-tabs object.
 * 
 * These are necessary where the original implementation assumes a
 * horizontal layout.
 */
var VTTabbrowserTabs = {

    patch: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        tabs._getDropIndex = this._getDropIndex;
        tabs._isAllowedForDataTransfer = this._isAllowedForDataTransfer;
        tabs._setEffectAllowedForDataTransfer
            = this._setEffectAllowedForDataTransfer;
        tabs.addEventListener('dragover', this.onDragOver, false);
    },

    _getDropIndex: function(event) {
        var tabs = this.childNodes;
        var tab = this._getDragTargetTab(event);
        // CHANGE for Vertical Tabs: no ltr handling, X -> Y, width -> height
        // and group support.
        for (let i = tab ? tab._tPos : 0; i < tabs.length; i++) {
            // Dropping on a group will append to that group's children.
            if (tabs[i] == tab && this.VTGroups.isGroup(tabs[i])) {
                return i + 1 + this.VTGroups.getChildren(tab).length;
            }
            if (event.screenY < tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2) 
                return i;
        }
        return tabs.length;
    },

    _isAllowedForDataTransfer: function(node) {
        return (node instanceof XULElement
                && node.localName == "tab"
                && (node.parentNode == this
                    || (node.ownerDocument.defaultView instanceof ChromeWindow
                        && node.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser")));

    },

    _setEffectAllowedForDataTransfer: function(event) {
        var dt = event.dataTransfer;
        // Disallow dropping multiple items
        if (dt.mozItemCount > 1)
            return dt.effectAllowed = "none";

        var types = dt.mozTypesAt(0);
        // tabs are always added as the first type
        if (types[0] == TAB_DROP_TYPE) {
            let sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
            if (this._isAllowedForDataTransfer(sourceNode)) {
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

    // Calculate the drop indicator's position for vertical tabs.
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
