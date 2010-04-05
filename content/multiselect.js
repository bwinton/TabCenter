/*
 * Support for "selecting" multiple tabs.
 * 
 * The idea is to this work for tabs exactly like it does for a
 * regular list or tree widget: hold Ctrl/Cmd or Shift and click.
 * To make it work in the UI, tabs with multiselect="true" need to be
 * styled like selected tabs.
 * 
 * Use getMultiSelect() to obtain a list of selected tabs.  This
 * should be the only public API you'll ever need.
 */
var VTMultiSelect = {

    init: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        tabs.addEventListener('mousedown', this, true);
        tabs.addEventListener('TabSelect', this, false);
    },

    toggleMultiSelect: function(aTab) {
        if (aTab.selected) {
            let tab = this.findClosestMultiSelectedTab(aTab);
            let tabs = document.getElementById("tabbrowser-tabs");
            if (tab) {
                // Prevent the tab switch from clearing the multiselection.
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
        var tab = null;
        while ((aTab._tPos - i >= 0) ||
               (aTab._tPos + i < tabs.childNodes.length)) {
            if (aTab._tPos - i >= 0) {
                tab = tabs.childNodes[aTab._tPos - i];
                if (tab.getAttribute("multiselect") == "true") {
                    break;
                }
            }
            if (aTab._tPos + i < tabs.childNodes.length) {
                tab = tabs.childNodes[aTab._tPos + i];
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

    /*
     * Return a list of selected tabs.
     */
    getMultiSelection: function() {
        var tabs = document.getElementById("tabbrowser-tabs");
        var results = [];
        for (let i=0; i < tabs.childNodes.length; i++ ) {
            let tab = tabs.childNodes[i];
            if (tab.selected || (tab.getAttribute("multiselect") == "true")) {
                results.push(tab);
            }
        }
        return results;
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
    },

    onTabSelect: function(aEvent) {
        if (aEvent.target.getAttribute("multiselect-noclear") == "true") {
            aEvent.target.removeAttribute("multiselect");
            aEvent.target.removeAttribute("multiselect-noclear");
            return;
        }
        this.clearMultiSelect();
    }

};
