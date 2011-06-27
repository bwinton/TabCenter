/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Vertical Tabs.
 *
 * The Initial Developer of the Original Code is
 * Philipp von Weitershausen.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
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

const EXPORTED_SYMBOLS = ["VTMultiSelect"];

function VTMultiSelect (tabs) {
    this.tabs = tabs;
    this.init();
}
VTMultiSelect.prototype = {

    init: function() {
        const tabs = this.tabs;
        tabs.VTMultiSelect = this;
        tabs.addEventListener("mousedown", this, true);
        tabs.addEventListener("TabSelect", this, false);
    },

    unload: function() {
        const tabs = this.tabs;
        delete tabs.VTMultiSelect;
        tabs.removeEventListener("mousedown", this, true);
        tabs.removeEventListener("TabSelect", this, false);
    },

    /*** Public API ***/

    toggleSelect: function(aTab) {
        if (aTab.selected) {
            // Toggling a selected tab means we have to find another
            // tab within the multiselection that we can select instead.
            let tab = this.findClosestSelectedTab(aTab);
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

    findClosestSelectedTab: function(aTab) {
        let selected = this.tabs.getElementsByAttribute("multiselect", "true");
        if (!selected.length) {
            return null;
        }
        return Array.sort(selected, function (a, b) {
            return Math.abs(a._tPos - aTab._tPos)
                   - Math.abs(b._tPos - aTab._tPos);
        })[0];
    },

    spanSelect: function(aBeginTab, aEndTab) {
        this.clear();
        let begin = aBeginTab._tPos;
        let end = aEndTab._tPos;
        if (begin > end) {
            [end, begin] = [begin, end];
        }
        for (let i=begin; i <= end; i++) {
            this.tabs.childNodes[i].setAttribute("multiselect", "true");
        }
    },

    clear: function() {
        for (let i=0; i < this.tabs.childNodes.length; i++) {
            this.tabs.childNodes[i].removeAttribute("multiselect");
        }
    },

    /*
     * Return a list of selected tabs.
     */
    getSelected: function() {
        let results = [];
        for (let i=0; i < this.tabs.childNodes.length; i++) {
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
    closeSelected: function() {
        let toclose = this.getSelected();
        this.clear();

        let tab;
        for (let i=0; i < toclose.length; i++) {
            tab = toclose[i];
            this.tabs.tabbrowser.removeTab(tab);
        }
    },

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case "mousedown":
            this.onMouseDown(aEvent);
            return;
        case "TabSelect":
            this.onTabSelect(aEvent);
            return;
        }
    },

    onMouseDown: function(aEvent) {
        let tab = aEvent.target;
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
            this.toggleSelect(tab);
            aEvent.stopPropagation();
            return;
        }
        if (aEvent.shiftKey) {
            this.spanSelect(this.tabs.tabbrowser.selectedTab, tab);
            aEvent.stopPropagation();
            return;
        }

        if (!tab.selected) {
            return;
        }
        if (!tab.mOverCloseButton) {
            // Clicking on the already selected tab won't fire a TabSelect
            // event, but we still want to deselect any other tabs.
            this.clear();
            return;
        }

        // Ok, so we're closing the selected tab.  That means we have
        // to find another tab within the multiselection that we can
        // select instead.
        let newtab = this.findClosestSelectedTab(tab);
        if (!newtab) {
            return;
        }
        // Prevent the tab switch from clearing the multiselection.
        newtab.setAttribute("multiselect-noclear", "true");
        this.tabs.tabbrowser.selectedTab = newtab;
    },

    onTabSelect: function(aEvent) {
        let tab = aEvent.target;
        if (tab.getAttribute("multiselect-noclear") == "true") {
            tab.removeAttribute("multiselect");
            tab.removeAttribute("multiselect-noclear");
            return;
        }
        this.clear();
    }

};
