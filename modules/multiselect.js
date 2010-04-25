/*
 * Support for "selecting" multiple tabs.
 * 
 * The idea is to this work for tabs exactly like it does for a
 * regular list or tree widget: hold Ctrl/Cmd or Shift and click.
 * To make it work in the UI, tabs with multiselect="true" need to be
 * styled like selected tabs.
 * 
 * Use getMultiSelect() to obtain a list of selected tabs.  For most
 * cases this will be the only API you ever need.
 */

var EXPORTED_SYMBOLS = ["VTMultiSelect"];

function VTMultiSelect (tabs) {
    this.tabs = tabs;
    tabs.VTMultiSelect = this;

    tabs.addEventListener('mousedown', this, true);
    tabs.addEventListener('TabSelect', this, false);
}
VTMultiSelect.prototype = {

    /*** Public API ***/

    toggleMultiSelect: function(aTab) {
        if (aTab.selected) {
            // Toggling a selected tab means we have to find another
            // tab within the multiselection that we can select instead.
            let tab = this.findClosestMultiSelectedTab(aTab);
            if (tab) {
                // Prevent the tab switch from clearing the multiselection.
                tab.setAttribute("multiselect-noclear", "true");
                this.tabs.tabbrowser.selectedTab = tab;
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
        var i = 1;
        var tab = null;
        while ((aTab._tPos - i >= 0) ||
               (aTab._tPos + i < this.tabs.childNodes.length)) {
            if (aTab._tPos - i >= 0) {
                tab = this.tabs.childNodes[aTab._tPos - i];
                if (tab.getAttribute("multiselect") == "true") {
                    break;
                }
            }
            if (aTab._tPos + i < this.tabs.childNodes.length) {
                tab = this.tabs.childNodes[aTab._tPos + i];
                if (tab.getAttribute("multiselect") == "true") {
                    break;
                }
            }
            i++;
        }
        return tab;
    },

    multiSpanSelect: function(aBeginTab, aEndTab) {
        this.clearMultiSelect();
        var begin = aBeginTab._tPos;
        var end = aEndTab._tPos;
        if (begin > end) {
            [end, begin] = [begin, end];
        }
        for (let i=begin; i <= end; i++) {
            this.tabs.childNodes[i].setAttribute("multiselect", "true");
        }
    },

    clearMultiSelect: function() {
        for (let i=0; i < this.tabs.childNodes.length; i++ ) {
            this.tabs.childNodes[i].removeAttribute("multiselect");
        }
    },

    /*
     * Return a list of selected tabs.
     */
    getMultiSelection: function() {
        var results = [];
        for (let i=0; i < this.tabs.childNodes.length; i++ ) {
            let tab = this.tabs.childNodes[i];
            if (tab.selected || (tab.getAttribute("multiselect") == "true")) {
                results.push(tab);
            }
        }
        return results;
    },

    /*
     * Close all tabs in the multiselection.
     */
    closeMultiSelection: function() {
        var toclose = this.getMultiSelection();
        this.clearMultiSelect();

        var tab;
        for (var i=0; i < toclose.length; i++) {
            tab = toclose[i];
            this.tabs.tabbrowser.removeTab(tab);
        }
    },

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case 'mousedown':
            this.onMouseDown(aEvent);
            return;
        case 'TabSelect':
            this.onTabSelect(aEvent);
            return;
        }
    },

    onMouseDown: function(aEvent) {
        var tab = aEvent.target;
        if (tab.localName != "tab") {
            return;
        }
        if (aEvent.button != 0) {
            return;
        }

        // Check for Ctrl+click (multiselection).  On the Mac it's
        // Cmd+click which is represented by metaKey.  Ctrl+click won't be
        // possible on the Mac because that would be a right click (button 2)
        if (aEvent.ctrlKey || aEvent.metaKey) {
            this.toggleMultiSelect(tab);
            aEvent.stopPropagation();
            return;
        }
        if (aEvent.shiftKey) {
            this.multiSpanSelect(this.tabs.tabbrowser.selectedTab, tab);
            aEvent.stopPropagation();
            return;
        }

        if (!tab.selected) {
            return;
        }
        if (!tab.mOverCloseButton) {
            // Clicking on the already selected tab won't fire a TabSelect
            // event, but we still want to deselect any other tabs.
            this.clearMultiSelect();
            return;
        }

        // Ok, so we're closing the selected tab.  That means we have
        // to find another tab within the multiselection that we can
        // select instead.
        let newtab = this.findClosestMultiSelectedTab(tab);
        if (!newtab) {
            return;
        }
        // Prevent the tab switch from clearing the multiselection.
        newtab.setAttribute("multiselect-noclear", "true");
        this.tabs.tabbrowser.selectedTab = newtab;
    },

    onTabSelect: function(aEvent) {
        var tab = aEvent.target;
        if (tab.getAttribute("multiselect-noclear") == "true") {
            tab.removeAttribute("multiselect");
            tab.removeAttribute("multiselect-noclear");
            return;
        }
        this.clearMultiSelect();
    }

};
