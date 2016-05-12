/* -*- Mode: javascript; indent-tabs-mode: nil -*- */
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
Components.utils.import("resource://tabcenter/tabdatastore.jsm");
Components.utils.import("resource://tabcenter/multiselect.jsm");
Components.utils.import("resource://tabcenter/groups.jsm");

let console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;

const EXPORTED_SYMBOLS = ["VerticalTabs", "vtInit"];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";

function vtInit() {
  let sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
              .getService(Components.interfaces.nsIStyleSheetService);
  let ios = Components.classes["@mozilla.org/network/io-service;1"]
              .getService(Components.interfaces.nsIIOService);

  let installStylesheet = function(uri) {
    uri = ios.newURI(uri, null, null);
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  };

  let removeStylesheet = function(uri) {
    uri = ios.newURI(uri, null, null);
    sss.unregisterSheet(uri, sss.USER_SHEET);
  };

  installStylesheet("resource://tabcenter/override-bindings.css");
  installStylesheet("resource://tabcenter/skin/bindings.css");
  installStylesheet("resource://tabcenter/skin/base.css");
  installStylesheet("resource://tabcenter/skin/light/light.css");
  return () => {
    removeStylesheet("resource://tabcenter/skin/light/light.css");
    removeStylesheet("resource://tabcenter/override-bindings.css");
    removeStylesheet("resource://tabcenter/skin/bindings.css");
    removeStylesheet("resource://tabcenter/skin/base.css");
    let windows = Services.wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      let window = windows.getNext();
      let tabs = window.document.getElementById("tabbrowser-tabs");
      if (tabs) {
        tabs.removeAttribute("overflow");
        tabs._positionPinnedTabs();
      }
    }
  };
}

/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
function VerticalTabs(window, {newPayload, addPingStats}) {
    this.window = window;
    this.document = window.document;
    this.unloaders = [];
    this.addPingStats = addPingStats;
    this.newPayload = newPayload;
    this.stats = this.newPayload();
    this.init();
}
VerticalTabs.prototype = {

    init: function() {
        this.window.VerticalTabs = this;
        this.unloaders.push(function() {
            delete this.window.VerticalTabs;
        });
        this.window.onunload = () => {
          this.sendStats();
        }

        this.rearrangeXUL();
        this.initContextMenu();

        let tabs = this.document.getElementById("tabbrowser-tabs");
        let results = this.document.getElementById("PopupAutoCompleteRichResult");

        if (results) {
          results.removeAttribute("width");
        }
        this.tabIDs = new VTTabIDs(tabs);
        this.tabObserver = new this.document.defaultView.MutationObserver((mutations) => {
          this.tabObserver.disconnect();
          mutations.forEach((mutation) => {
            if (mutation.type === "attributes" &&
                mutation.target.localName === "tab") {
              let tab = mutation.target;
              if (mutation.attributeName === "crop" && !tabs.expanded) {
                tab.removeAttribute("crop");
              } else if (mutation.attributeName === "progress" &&
                  !tab.getAttribute("progress")) {
                if (tab.linkedBrowser.contentDocument.URL === "about:newtab") {
                  this.window.gBrowser.moveTabTo(tab, 0);
                }
              }
            } else if (mutation.type === "attributes" &&
                       mutation.target.id === "PopupAutoCompleteRichResult" &&
                       mutation.attributeName === "width") {
              results.removeAttribute("width");
            } else if (mutation.type === "childList" &&
                !tabs.expanded) {
              for (let node of mutation.addedNodes) {
                node.removeAttribute("crop");
              }
            }
          });
          this.tabObserver.observe(tabs, {childList: true, attributes: true, subtree: true});
          if (results) {
            this.tabObserver.observe(results, {attributes: true});
          }
        });
        this.tabObserver.observe(tabs, {childList: true, attributes: true, subtree: true});
        if (results) {
          this.tabObserver.observe(results, {attributes: true});
        }

        this.unloaders.push(function() {
            this.tabIDs.unload();
            this.tabObserver.disconnect();
        });
    },

    createElement: function (label, attrs) {
      let rv = this.document.createElementNS(NS_XUL, label);
      if (attrs) {
        for (attr in attrs) {
          rv.setAttribute(attr, attrs[attr]);
        }
      }
      return rv;
    },

    rearrangeXUL: function() {
        const window = this.window;
        const document = this.document;

        // Move the bottom stuff (findbar, addonbar, etc.) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        let mainWindow = document.getElementById("main-window");
        let contentbox = document.getElementById("appcontent");
        let bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);
        let top = document.getElementById("navigator-toolbox");

        // save the label of the first tab, and the toolbox palette for later…
        let tabs = document.getElementById("tabbrowser-tabs");
        let label = tabs.firstChild.label;
        let palette = top.palette;

        // Create a box next to the app content. It will hold the tab
        // bar and the tab toolbar.
        let browserbox = document.getElementById("browser");
        let leftbox = this.createElement("vbox", {"id": "verticaltabs-box"});
        browserbox.insertBefore(leftbox, contentbox);
        mainWindow.setAttribute("persist",
          mainWindow.getAttribute("persist") + " tabspinned");

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        tabs.setAttribute("vertical", true);
        leftbox.insertBefore(tabs, leftbox.firstChild);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary

        // And restore the label and palette here.
        tabs.firstChild.label = label;
        top.palette = palette;

        // Move the tabs toolbar into the tab strip
        let toolbar = document.getElementById("TabsToolbar");
        toolbar.setAttribute("collapsed", "false"); // no more vanishing new tab toolbar
        toolbar._toolbox = null; // reset value set by constructor
        toolbar.setAttribute("toolboxid", "navigator-toolbox");
        let spacer = this.createElement("spacer", {"id": "new-tab-spacer"});
        toolbar.appendChild(spacer);
        let pin_button = this.createElement("toolbarbutton", {
          "id": "pin-button",
          "tooltiptext": "Keep sidebar open",
          "onclick": `let box = document.getElementById('main-window');
            let newstate = box.getAttribute('tabspinned') == 'true' ? 'false' : 'true';
            box.setAttribute('tabspinned', newstate);
            if (newstate == 'true') {
              window.VerticalTabs.stats.tab_center_pinned++;
            } else {
              window.VerticalTabs.stats.tab_center_unpinned++;
            }
            `
        });
        toolbar.appendChild(pin_button);
        leftbox.insertBefore(toolbar, leftbox.firstChild);

        let enter = (event) => {
          if (event.type === "mouseenter" && !tabs.expanded) {
            this.stats.tab_center_expanded++;
          }
          tabs.expanded = true;
          if (event.pageX <= 4) {
            leftbox.style.transition = "box-shadow 150ms ease-out, width 150ms ease-out";
            window.setTimeout(() => {
              leftbox.style.transition = "";
            }, 300);
          }
          window.setTimeout(() => {
            for (let i=0; i < tabs.childNodes.length; i++) {
              tabs.childNodes[i].setAttribute("crop", "end");
            }
          }, 300);
        };
        leftbox.addEventListener("mouseenter", enter);
        leftbox.addEventListener("mousemove", enter);
        leftbox.addEventListener("mouseleave", () => {
          if (mainWindow.getAttribute("tabspinned") !== "true") {
            tabs.expanded = false;
            let tabsPopup = document.getElementById("alltabs-popup");
            if (tabsPopup.state === "open") {
              tabsPopup.hidePopup();
            }
          }
        });

        tabs.addEventListener("TabOpen", this, false);
        tabs.addEventListener("TabSelect", this, false);
        tabs.addEventListener("TabClose", this, false);
        tabs.addEventListener("TabPinned", this, false);
        tabs.addEventListener("TabUnpinned", this, false);
        window.setTimeout(() => {
          if (mainWindow.getAttribute("tabspinned") === "true") {
            tabs.expanded = true;
          }
          for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
          }
        }, 150);

        this.unloaders.push(function () {
            // Move the tabs toolbar back to where it was
            toolbar._toolbox = null; // reset value set by constructor
            toolbar.removeAttribute("toolboxid");
            toolbar.removeAttribute("collapsed");
            toolbar.removeChild(spacer);
            toolbar.removeChild(pin_button);
            let toolbox = document.getElementById("navigator-toolbox");
            let navbar = document.getElementById("nav-bar");
            let browserPanel = document.getElementById("browser-panel");
            let new_tab_button = document.getElementById("new-tab-button");

            // Put the tabs back up top
            tabs.orient = "horizontal";
            tabs.mTabstrip.orient = "horizontal";
            tabs.tabbox.orient = "vertical"; // probably not necessary
            tabs.removeAttribute("width");
            tabs.removeEventListener("TabOpen", this, false);
            tabs.removeEventListener("TabSelect", this, false);
            tabs.removeEventListener("TabClose", this, false);
            tabs.removeEventListener("TabPinned", this, false);
            tabs.removeEventListener("TabUnpinned", this, false);
            tabs.removeAttribute("vertical");

            // Restore all individual tabs.
            for (let i = 0; i < tabs.childNodes.length; i++) {
              let tab = tabs.childNodes[i];
              tab.setAttribute("crop", "end");
              tab.removeAttribute("verticaltabs-id");
            }

            // Remove all the crap we added.
            browserbox.removeChild(leftbox);
            browserbox.removeAttribute("dir");
            mainWindow.removeAttribute("tabspinned");
            mainWindow.setAttribute("persist",
              mainWindow.getAttribute("persist").replace(" tabspinnned", ""));
            leftbox = null;

            // Restore the tab strip.
            toolbar.insertBefore(tabs, new_tab_button);
            toolbox.insertBefore(toolbar, navbar);
            browserPanel.insertBefore(bottom, document.getElementById("fullscreen-warning").nextSibling);
            this.window.TabsInTitlebar.updateAppearance(true);
        });
    },

    initContextMenu: function() {
        const document = this.document;
        const tabs = document.getElementById("tabbrowser-tabs");

        let closeMultiple = null;
        if (this.multiSelect) {
            closeMultiple = this.createElement("menuitem", {
              "id": "context_verticalTabsCloseMultiple",
              "label": "Close Selected Tabs",
              "tbattr": "tabbrowser-multiple",
              "oncommand": "gBrowser.tabContainer.VTMultiSelect.closeSelected();"
            });
            tabs.contextMenu.appendChild(closeMultiple);
        }

        tabs.contextMenu.addEventListener("popupshowing", this, false);

        this.unloaders.push(function () {
            if (closeMultiple)
                tabs.contextMenu.removeChild(closeMultiple);
            tabs.contextMenu.removeEventListener("popupshowing", this, false);
        });
    },

    initTab: function(aTab) {
      if (this.document.getElementById("main-window").getAttribute("tabspinned") !== "true") {
        aTab.removeAttribute("crop");
      } else {
        aTab.setAttribute("crop", "end");
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
        case "TabClose":
            this.onTabClose(aEvent);
            return;
        case "TabPinned":
            this.onTabPinned(aEvent);
            return;
        case "TabUnpinned":
            this.onTabUnpinned(aEvent);
            return;
        case "mouseup":
            this.onMouseUp(aEvent);
            return;
        case "popupshowing":
            this.onPopupShowing(aEvent);
            return;
        case "TabSelect":
            this.onTabSelect(aEvent);
            return;
        }
    },

    onTabSelect: function(aEvent) {
      let tab = aEvent.target;
      tab.scrollIntoView();
    },

    onTabOpen: function(aEvent) {
      let tab = aEvent.target;
      this.stats.tabs_created++;
      this.initTab(tab);
    },

    onTabClose: function(aEvent) {
      this.stats.tabs_destroyed++;
    },

    onTabPinned: function(aEvent) {
      this.stats.tabs_pinned++;
    },

    onTabUnpinned: function(aEvent) {
      this.stats.tabs_unpinned++;
    },

    onPopupShowing: function(aEvent) {
        if (!this.multiSelect)
            return;

        let closeTabs = this.document.getElementById("context_verticalTabsCloseMultiple");
        let tabs = this.multiSelect.getSelected();
        if (tabs.length > 1) {
            closeTabs.disabled = false;
        } else {
            closeTabs.disabled = true;
        }
    },

  sendStats: function(payload) {
    this.addPingStats(this.stats);
    this.stats = this.newPayload();
  }

};
