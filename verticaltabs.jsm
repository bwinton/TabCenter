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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://verticaltabs/tabdatastore.jsm");
Components.utils.import("resource://verticaltabs/multiselect.jsm");
Components.utils.import("resource://verticaltabs/groups.jsm");

const EXPORTED_SYMBOLS = ["VerticalTabs"];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";

/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
function VerticalTabs(window) {
    this.window = window;
    this.document = window.document;
    this.unloaders = [];
    this.init();
}
VerticalTabs.prototype = {

    init: function() {
        this.window.VerticalTabs = this;
        this.unloaders.push(function() {
            delete this.window.VerticalTabs;
        });

        this.installStylesheet("resource://verticaltabs/skin/bindings.css");
        this.installStylesheet("resource://verticaltabs/skin/base.css");
        switch (Services.appinfo.OS) {
          case "WINNT":
            this.installStylesheet("resource://verticaltabs/skin/win7/win7.css");
            break;
          case "Darwin":
            this.installStylesheet("resource://verticaltabs/skin/osx/osx.css");
            break;
          case "Linux":
            this.installStylesheet("resource://verticaltabs/skin/linux/linux.css");
            break;
        }

        this.rearrangeXUL();
        this.initContextMenu();
        this.observeRightPref();

        let tabs = this.document.getElementById("tabbrowser-tabs");
        this.vtTabs = new VTTabbrowserTabs(tabs);
        this.tabIDs = new VTTabIDs(tabs);
        this.multiSelect = new VTMultiSelect(tabs);
        this.groups = new VTGroups(tabs);
        this.unloaders.push(function() {
            this.vtTabs.unload();
            this.tabIDs.unload();
            this.multiSelect.unload();
            this.groups.unload();
        });
    },

    installStylesheet: function(uri) {
        const document = this.document;
        let pi = document.createProcessingInstruction(
          "xml-stylesheet", "href=\"" + uri + "\" type=\"text/css\"");
        document.insertBefore(pi, document.documentElement);
        this.unloaders.push(function () {
            document.removeChild(pi);
        });
    },

    rearrangeXUL: function() {
        const window = this.window;
        const document = this.document;

        // Move the bottom stuff (findbar, addonbar, etc.) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        let contentbox = document.getElementById("appcontent");
        let bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);

        // Create a box next to the app content. It will hold the tab
        // bar and the tab toolbar.
        let browserbox = document.getElementById("browser");
        let leftbox = document.createElementNS(NS_XUL, "vbox");
        leftbox.id = "verticaltabs-box";
        browserbox.insertBefore(leftbox, contentbox);
        let spacer = document.createElementNS(NS_XUL, "spacer");
        leftbox.appendChild(spacer);

        let splitter = document.createElementNS(NS_XUL, "splitter");
        splitter.id = "verticaltabs-splitter";
        splitter.className = "chromeclass-extrachrome";
        browserbox.insertBefore(splitter, contentbox);
        // Hook up event handler for splitter so that the width of the
        // tab bar is persisted.
        splitter.addEventListener("mouseup", this, false);

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        if (Services.prefs.getBoolPref("extensions.verticaltabs.right")) {
            browserbox.dir = "reverse";
        }

        let tabs = document.getElementById("tabbrowser-tabs");
        leftbox.insertBefore(tabs, leftbox.firstChild);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary
        tabs.setAttribute("width", Services.prefs.getIntPref("extensions.verticaltabs.width"));

        // Move the tabs toolbar into the tab strip
        let toolbar = document.getElementById("TabsToolbar");
        toolbar._toolbox = null; // reset value set by constructor
        toolbar.setAttribute("toolboxid", "navigator-toolbox");
        leftbox.appendChild(toolbar);

        // Force tabs on bottom (for styling) after backing up the user's
        // setting.
        try {
          Services.prefs.getBoolPref("extensions.verticaltabs.tabsOnTop");
        } catch (ex if (ex.result == Components.results.NS_ERROR_UNEXPECTED)) {
          Services.prefs.setBoolPref("extensions.verticaltabs.tabsOnTop",
                                     window.TabsOnTop.enabled);
        }
        window.TabsOnTop.enabled = false;
        // Hide all menu items for tabs on top.
        let menu_tabsOnTop = document.getElementById("menu_tabsOnTop");
        menu_tabsOnTop.collapsed = true;
        menu_tabsOnTop.nextSibling.collapsed = true; // separator
        let toolbar_context_menu = document.getElementById("toolbar-context-menu");
        toolbar_context_menu.firstChild.collapsed = true;
        toolbar_context_menu.firstChild.nextSibling.collapsed = true; // separator
        let appmenu_tabsOnTop = document.getElementById("appmenu_toggleTabsOnTop");
        if (appmenu_tabsOnTop) {
            appmenu_tabsOnTop.collapsed = true;
        }
        // Disable the command just to be safe.
        let cmd_tabsOnTop = document.getElementById("cmd_ToggleTabsOnTop");
        cmd_tabsOnTop.disabled = true;

        // Fix up each individual tab for vertical layout, including
        // ones that are opened later on.
        tabs.addEventListener("TabOpen", this, false);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }

        this.unloaders.push(function () {
            // Move the bottom back to being the next sibling of contentbox.
            browserbox.insertBefore(bottom, contentbox.nextSibling);

            // Move the tabs toolbar back to where it was
            toolbar._toolbox = null; // reset value set by constructor
            toolbar.removeAttribute("toolboxid");
            let toolbox = document.getElementById("navigator-toolbox");
            toolbox.appendChild(toolbar);

            // Restore the tab strip.
            let new_tab_button = document.getElementById("new-tab-button");
            toolbar.insertBefore(tabs, new_tab_button);
            tabs.orient = "horizontal";
            tabs.mTabstrip.orient = "horizontal";
            tabs.tabbox.orient = "vertical"; // probably not necessary
            tabs.removeAttribute("width");
            tabs.removeEventListener("TabOpen", this, false);

            // Restore tabs on top.
            window.TabsOnTop.enabled = Services.prefs.getBoolPref(
                "extensions.verticaltabs.tabsOnTop");
            menu_tabsOnTop.collapsed = false;
            menu_tabsOnTop.nextSibling.collapsed = false; // separator
            toolbar_context_menu.firstChild.collapsed = false;
            toolbar_context_menu.firstChild.nextSibling.collapsed = false; // separator
            if (appmenu_tabsOnTop) {
                appmenu_tabsOnTop.collapsed = false;
            }
            cmd_tabsOnTop.disabled = false;

            // Restore all individual tabs.
            for (let i = 0; i < tabs.childNodes.length; i++) {
              let tab = tabs.childNodes[i];
              tab.removeAttribute("align");
              tab.maxWidth = tab.minWidth = "";
            }

            // Remove all the crap we added.
            splitter.removeEventListener("mouseup", this, false);
            browserbox.removeChild(leftbox);
            browserbox.removeChild(splitter);
            browserbox.dir = "normal";
            leftbox = splitter = null;
        });
    },

    initContextMenu: function() {
        const document = this.document;
        const tabs = document.getElementById("tabbrowser-tabs");

        let closeMultiple = document.createElementNS(NS_XUL, "menuitem");
        closeMultiple.id = "context_verticalTabsCloseMultiple";
        closeMultiple.setAttribute("label", "Close Selected Tabs"); //TODO l10n
        closeMultiple.setAttribute("tbattr", "tabbrowser-multiple");
        closeMultiple.setAttribute(
          "oncommand", "gBrowser.tabContainer.VTMultiSelect.closeSelected();");
        tabs.contextMenu.appendChild(closeMultiple);

        tabs.contextMenu.addEventListener("popupshowing", this, false);

        this.unloaders.push(function () {
            tabs.contextMenu.removeChild(closeMultiple);
            tabs.contextMenu.removeEventListener("popupshowing", this, false);
        });
    },

    initTab: function(aTab) {
        aTab.setAttribute("align", "stretch");
        aTab.maxWidth = 65000;
        aTab.minWidth = 0;
    },

    onTabbarResized: function() {
        let tabs = this.document.getElementById("tabbrowser-tabs");
        this.window.setTimeout(function() {
            Services.prefs.setIntPref("extensions.verticaltabs.width",
                                      tabs.boxObject.width);
        }, 10);
	},

    observeRightPref: function () {
      Services.prefs.addObserver("extensions.verticaltabs.right", this, false);
      this.unloaders.push(function () {
        Services.prefs.removeObserver("extensions.verticaltabs.right", this, false);
      });
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed" || data != "extensions.verticaltabs.right") {
        return;
      }
      let browserbox = this.document.getElementById("browser");
      if (browserbox.dir != "reverse") {
        browserbox.dir = "reverse";
      } else {
        browserbox.dir = "normal";
      }
    },

    unload: function() {
      this.unloaders.forEach(function(func) {
        func.call(this);
      }, this);
    },

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case "DOMContentLoaded":
            this.init();
            return;
        case "TabOpen":
            this.onTabOpen(aEvent);
            return;
        case "mouseup":
            this.onMouseUp(aEvent);
            return;
        case "popupshowing":
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
        let closeTabs = this.document.getElementById("context_verticalTabsCloseMultiple");
        let tabs = this.multiSelect.getSelected();
        if (tabs.length > 1) {
            closeTabs.disabled = false;
        } else {
            closeTabs.disabled = true;
        }
    }

};

/**
 * Patches for the tabbrowser-tabs object.
 * 
 * These are necessary where the original implementation assumes a
 * horizontal layout. Pretty much only needed for drag'n'drop to work
 * correctly.
 * 
 * WARNING: Do not continue reading unless you want to feel sick. You
 * have been warned.
 * 
 */
function VTTabbrowserTabs(tabs) {
    this.tabs = tabs;
    this.init();
}
VTTabbrowserTabs.prototype = {

    init: function() {
        this.swapMethods();
    },

    unload: function() {
        this.swapMethods();
    },

    _patchedMethods: ["_positionPinnedTabs",
                      "_positionDropIndicator",
                      "_handleTabDrag",
                      "_slideTab",
                      "_getDragTargetTab",
                      "_getDropIndex",
                      ],
    swapMethods: function swapMethods() {
        const tabs = this.tabs;
        this._patchedMethods.forEach(function(methodname) {
            this.swapMethod(tabs, this, methodname);
        }, this);
    },

    swapMethod: function(obj1, obj2, methodname) {
      let method1 = obj1[methodname];
      let method2 = obj2[methodname];
      obj1[methodname] = method2;
      obj2[methodname] = method1;
    },

    // Modified methods below.

    _positionPinnedTabs: function() {
        // TODO we might want to do something here. For now we just
        // don't do anything which is better than doing something stupid.
    },

    _positionDropIndicator: function _positionDropIndicator(event, scrollOnly) {
        const window = event.view;
        const document = window.document;

          var effects = event.dataTransfer ? this._setEffectAllowedForDataTransfer(event) : "";

          var ind = this._tabDropIndicator;
          if (effects == "none") {
            ind.collapsed = true;
            return;
          }
          event.preventDefault();
          event.stopPropagation();

          var tabStrip = this.mTabstrip;
          var ltr = true;

          // Autoscroll the tab strip if we drag over the scroll
          // buttons, even if we aren't dragging a tab, but then
          // return to avoid drawing the drop indicator.
          var pixelsToScroll = 0;
          var target = event.originalTarget;
          if (target.ownerDocument == document &&
              this.getAttribute("overflow") == "true") {
            let targetAnonid = target.getAttribute("anonid");
            switch (targetAnonid) {
              case "scrollbutton-up":
                pixelsToScroll = tabStrip.scrollIncrement * -1;
                break;
              case "scrollbutton-down":
                pixelsToScroll = tabStrip.scrollIncrement;
                break;
            }
            if (pixelsToScroll) {
              if (effects)
                tabStrip.scrollByPixels((ltr ? 1 : -1) * pixelsToScroll);
              else
                tabStrip._startScroll(pixelsToScroll < 0 ? -1 : 1);
            }
          }

          if (scrollOnly) {
            ind.collapsed = true;
            return;
          }

          if (effects == "link") {
            let tab = this._getDragTargetTab(event);
            if (tab) {
              if (!this._dragTime)
                this._dragTime = Date.now();
              if (Date.now() >= this._dragTime + this._dragOverDelay)
                this.selectedItem = tab;
              ind.collapsed = true;
              return;
            }
          }

          var newIndex = this._getDropIndex(event);
          var scrollRect = tabStrip.scrollClientRect;
          var rect = this.getBoundingClientRect();
          var minMargin = scrollRect.top - rect.top;
          var maxMargin = Math.min(minMargin + scrollRect.height,
                                   scrollRect.bottom);

          var newMargin;
          if (pixelsToScroll) {
            // If we are scrolling, put the drop indicator at the edge,
            // so that it doesn't jump while scrolling.
            newMargin = (pixelsToScroll > 0) ? maxMargin : minMargin;
          }
          else {
            if (newIndex == this.childNodes.length) {
              let tabRect = this.childNodes[newIndex-1].getBoundingClientRect();
              newMargin = tabRect.top - rect.bottom;
            }
            else {
              let tabRect = this.childNodes[newIndex].getBoundingClientRect();
              newMargin = tabRect.top - rect.top;
            }
          }

          ind.collapsed = false;

          newMargin += ind.clientHeight / 2;
          ind.style.MozTransform = "translate(0, " + Math.round(newMargin) + "px)";
          ind.style.MozMarginStart = (-ind.clientHeight) + "px";
    },

    _handleTabDrag: function _handleTabDrag(event) {
          let draggedTab = this.draggedTab;
          if (!draggedTab)
            return;

          if (event)
            draggedTab._dragData._savedEvent = event;
          else
            event = draggedTab._dragData._savedEvent;

          let window = event.view;

          if (this._updateTabDetachState(event, draggedTab))
            return;

          // Keep the dragged tab visually within the region of like tabs.
          let tabs = this.tabbrowser.visibleTabs;
          let numPinned = this.tabbrowser._numPinnedTabs;
          let leftmostTab = draggedTab.pinned ? tabs[0] : tabs[numPinned];
          let rightmostTab = draggedTab.pinned ? tabs[numPinned-1] : tabs[tabs.length-1];
          let tabHeight = draggedTab.getBoundingClientRect().height;
          let ltr = true;
          let left = leftmostTab.boxObject.screenY;
          let right = rightmostTab.boxObject.screenY + tabHeight;
        // HACK: This property should ideally be computed in the 'dragstart'
        // event, but we can just fake it here. It might be off by a little
        // bit, but we're willing to take that risk.
        let data = draggedTab._dragData;
        if (!data._dragStartY) {
            data._dragStartY = event.screenY;
            if (!draggedTab.pinned) {
               data._dragStartY += this.mTabstrip.scrollPosition;
            }
        }
        // END HACK
          let transformY = event.screenY - draggedTab._dragData._dragStartY;
          if (!draggedTab.pinned)
            transformY += this.mTabstrip.scrollPosition;
          let tabY = draggedTab.boxObject.screenY + transformY;
          draggedTab._dragData._dragDistY = transformY;
          if (tabY < left)
            transformY += left - tabY;
          // Prevent unintended overflow, especially in RTL mode.
          else if (tabY + tabHeight > right)
            transformY += right - tabY - tabHeight - (ltr ? 0 : 1);
          draggedTab.style.MozTransform = "translate(0, " + transformY + "px)";

          let newIndex = this._getDropIndex(event, draggedTab);
          let tabAtNewIndex = this.childNodes[newIndex > draggedTab._tPos ?
                                              newIndex-1 : newIndex];
          this._positionDropIndicator(event, tabAtNewIndex.pinned == draggedTab.pinned);

          if (newIndex == draggedTab._dragData._dropIndex)
            return;
          draggedTab._dragData._dropIndex = newIndex;

          tabs.forEach(function(tab) {
            if (tab == draggedTab || tab.pinned != draggedTab.pinned)
              return;
            else if (tab._tPos < draggedTab._tPos && tab._tPos >= newIndex)
              tab.style.MozTransform = "translate(0, " + tabHeight + "px)";
            else if (tab._tPos > draggedTab._tPos && tab._tPos < newIndex)
              tab.style.MozTransform = "translate(0, " + -tabHeight + "px)";
            else
              tab.style.MozTransform = "";
          });
    },

    _slideTab: function _slideTab(event, draggedTab) {
        const window = event.view;
        const Event = window.Event;

          let oldIndex = draggedTab._tPos;
          let newIndex = draggedTab._dragData._dropIndex;
          if (newIndex > oldIndex)
            newIndex--;
          this.removeAttribute("drag");
          this._endTabDrag();

          if (!draggedTab.pinned && newIndex < this.tabbrowser._numPinnedTabs)
            this.tabbrowser.pinTab(draggedTab);
          else if (draggedTab.pinned && newIndex >= this.tabbrowser._numPinnedTabs)
            this.tabbrowser.unpinTab(draggedTab);
          else if (Services.prefs.getBoolPref("browser.tabs.animate")) {
            let difference = 0;
            // Calculate number of visible tabs between start and destination.
            if (newIndex != oldIndex) {
              let tabs = this.tabbrowser.visibleTabs;
              for (let i = 0; i < tabs.length; i++) {
                let position = tabs[i]._tPos;
                if (position <= newIndex && position > oldIndex)
                  difference++;
                else if (position >= newIndex && position < oldIndex)
                  difference--;
              }
            }
            let displacement = difference * draggedTab.getBoundingClientRect().height;
            let destination = "translate(0, " + displacement + "px)";
            if (draggedTab.style.MozTransform != destination) {
              this.setAttribute("drag", "finish");
              draggedTab.style.MozTransform = destination;
              draggedTab.addEventListener("transitionend", function finish(event) {
                if (event.eventPhase != Event.AT_TARGET ||
                    event.propertyName != "-moz-transform")
                  return;
                draggedTab.removeEventListener("transitionend", finish);
                draggedTab.removeAttribute("dragged");
                let that = draggedTab.parentNode;
                that.removeAttribute("drag");
                that._clearDragTransforms();
                that.tabbrowser.moveTabTo(draggedTab, newIndex);
              });
              return;
            }
          }
          draggedTab.removeAttribute("dragged");
          this._clearDragTransforms();
          this.tabbrowser.moveTabTo(draggedTab, newIndex);
    },

    _getDragTargetTab: function _getDragTargetTab(event) {
        const window = event.view;

          let tab = event.target.localName == "tab" ? event.target : null;
          if (tab &&
              (event.type == "drop" || event.type == "dragover") &&
              event.dataTransfer.dropEffect == "link") {
            let boxObject = tab.boxObject;
            if (event.screenY < boxObject.screenY + boxObject.height * .25 ||
                event.screenY > boxObject.screenY + boxObject.height * .75)
              return null;
          }
          return tab;
    },

    _getDropIndex: function _getDropIndex(event, draggedTab) {
        const window = event.view;

          function compare(a, b, lessThan) { return lessThan ? a < b : a > b; };
          let ltr = true;
          let eY = event.screenY;
          let tabs = this.tabbrowser.visibleTabs;

          if (draggedTab) {
            let dist = draggedTab._dragData._dragDistY;
            let tabY = draggedTab.boxObject.screenY + dist;
            let draggingRight = dist > 0;
            if (draggingRight)
              tabY += draggedTab.boxObject.height;
            // iterate through app tabs first, since their z-index is higher
            else if (!draggedTab.pinned)
              for (let i = 0, numPinned = this.tabbrowser._numPinnedTabs; i < numPinned; i++)
                if (compare(eY, tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2, ltr))
                  return i;

            let i = tabs.indexOf(draggedTab), tab = draggedTab, next;
            while (next = ltr ^ draggingRight ? tabs[--i] : tabs[++i]) {
              let y = next.pinned == draggedTab.pinned ? tabY : eY;
              let middleOfNextTab = next.boxObject.screenY + next.boxObject.height / 2;
              if (!compare(y, middleOfNextTab, !draggingRight))
                break;
              // ensure an app tab is actually inside the normal tab region
              if (draggedTab.pinned && !next.pinned &&
                  y < this.mTabstrip._scrollButtonUp.boxObject.screenY)
                break;
              tab = next;
            }
            return tab._tPos + (ltr ^ draggingRight ? 0 : 1);
          }

          let tab = this._getDragTargetTab(event);
          for (let i = tab ? tab._tPos : 0; i < tabs.length; i++)
            if (compare(eY, tabs[i].boxObject.screenY + tabs[i].boxObject.height / 2, ltr))
              return tabs[i]._tPos;
          return this.childElementCount;
    }
};
