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
Components.utils.import("resource://verticaltabs/tabdatastore.jsm");
Components.utils.import("resource://verticaltabs/multiselect.jsm");


let console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;

const EXPORTED_SYMBOLS = ["VerticalTabs"];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";

/*
 * Element creation utility function.
 */
function XUL(document, name, attributes, children) {
  let rv = document.createElementNS(NS_XUL, name);
  for (let attr in attributes) {
    rv.setAttribute(attr, attributes[attr]);
  }
  children.forEach(child => {
    rv.appendChild(child);
  });
  return rv;
}

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

        this.sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                    .getService(Components.interfaces.nsIStyleSheetService);
        this.ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);

        this.installStylesheet("resource://verticaltabs/skin/base.css");
        this.applyThemeStylesheet();
        this.unloaders.push(this.removeThemeStylesheet);
        this.rearrangeXUL();
        this.initContextMenu();
        this.observeRightPref();
        this.observeThemePref();

        let tabs = this.document.getElementById("tabbrowser-tabs");
        this.tabIDs = new VTTabIDs(tabs);
        this.unloaders.push(function() {
            this.tabIDs.unload();
        });
    },

    installStylesheet: function(uri) {
        uri = this.ios.newURI(uri, null, null);
        this.sss.loadAndRegisterSheet(uri, this.sss.USER_SHEET);
    },

    applyThemeStylesheet: function() {
      this.theme = Services.prefs.getCharPref("extensions.verticaltabs.theme");
      this.installStylesheet(this.getThemeStylesheet(this.theme));
    },

    removeThemeStylesheet: function() {
      var uri = this.ios.newURI(this.getThemeStylesheet(this.theme), null, null);
      this.sss.unregisterSheet(uri, this.sss.USER_SHEET);
    },

    getThemeStylesheet: function(theme) {
      var stylesheet;
      switch (theme) {
        case "default":
            switch(Services.appinfo.OS) {
              case "WINNT":
                stylesheet = "resource://verticaltabs/skin/win7/win7.css";
                break;
              case "Darwin":
                stylesheet = "resource://verticaltabs/skin/osx/osx.css";
                break;
              case "Linux":
                stylesheet = "resource://verticaltabs/skin/linux/linux.css";
                break;
            }
          break;
        case "dark":
          stylesheet = "resource://verticaltabs/skin/dark/dark.css";
          break;
        case "light":
          stylesheet = "resource://verticaltabs/skin/light/light.css";
          break;
      }

      return stylesheet;
    },

    rearrangeXUL: function() {
        const window = this.window;
        const document = this.document;

        let contentbox = document.getElementById("appcontent");
        // Create a box next to the app content. It will hold the tab
        // bar and the tab toolbar.
        let browserbox = document.getElementById("browser");

        let browserPanel = document.getElementById("browser-panel");
        // browserPanel.setAttribute("flex", "1");
        let tabDeck = document.getElementById("tab-view-deck");
        let leftbox = XUL(document, "hbox", {"id": "wrapper-container"}, [
          XUL(document, "vbox", {"id":"tab-box"}, [
            XUL(document, "hbox", {"id": "pinned-tabs", "height": "60"}, []),
            XUL(document, "vbox", {"id": "unpinned-tabs", "flex": "1"}, [])
          ]),
          XUL(document, "vbox", {"id": "browser-box"}, [browserPanel])
        ]);
        tabDeck.insertBefore(leftbox, tabDeck.firstChild);

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        if (Services.prefs.getBoolPref("extensions.verticaltabs.right")) {
            browserbox.dir = "reverse";
        }

        let tabs = document.getElementById("tabbrowser-tabs");
        // tabs.setAttribute("hidden", "true");
        // tabs.selectedIndex = 0;

        // Move the tabs toolbar into the tab strip
        // let toolbar = document.getElementById("TabsToolbar");
        // toolbar.setAttribute("collapsed", "true");

        // Not sure what this does, it and all related code might be unnecessary
        window.TabsOnTop = window.TabsOnTop ? window.TabsOnTop : {};
        window.TabsOnTop.enabled = false;

        let toolbar_context_menu = document.getElementById("toolbar-context-menu");
        toolbar_context_menu.firstChild.collapsed = true;
        toolbar_context_menu.firstChild.nextSibling.collapsed = true; // separator

        tabs.addEventListener("TabOpen", this, false);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }

        this.window.addEventListener("resize", this, false);

        this.unloaders.push(function () {
            // toolbar.setAttribute("collapsed", "false");
            // tabs.setAttribute("hidden", "false");

            // Restore tabs on top.
            window.TabsOnTop.enabled = Services.prefs.getBoolPref(
                "extensions.verticaltabs.tabsOnTop");
            toolbar_context_menu.firstChild.collapsed = false;
            toolbar_context_menu.firstChild.nextSibling.collapsed = false; // separator

            // Restore all individual tabs.
            for (let i = 0; i < tabs.childNodes.length; i++) {
              let tab = tabs.childNodes[i];
              tab.removeAttribute("align");
              tab.maxWidth = tab.minWidth = "";
            }

            // Remove all the crap we added.
            browserbox.removeChild(leftbox);
            browserbox.dir = "normal";
            leftbox = null;
        });
    },

    initContextMenu: function() {
        const document = this.document;
        const tabs = document.getElementById("tabbrowser-tabs");

        let closeMultiple = null;
        if (this.multiSelect) {
            closeMultiple = XUL(document, "menuitem", {
              "id": "context_verticalTabsCloseMultiple",
              "label": "Close Selected Tabs",
              "tbattr": "tabbrowser-multiple",
              "oncommand": "gBrowser.tabContainer.VTMultiSelect.closeSelected();"
            }, []);
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
        aTab.setAttribute("align", "stretch");
        aTab.maxWidth = 65000;
        aTab.minWidth = 0;
        let document = this.document;
        let tabs = document.getElementById("unpinned-tabs");
        console.log(aTab.getAttribute("visibleLabel") || "Unknown",
          aTab.getAttribute("image") || "chrome://mozapps/skin/places/defaultFavicon@2x.png",
          aTab);
        tabs.appendChild(XUL(document, "hbox", {"class": "sidetab"}, [
          XUL(document, "image", {
            "class": "tab-icon-image",
            "fadein": "true",
            "src": aTab.getAttribute("image") || "chrome://mozapps/skin/places/defaultFavicon@2x.png"}, []),
          XUL(document, "label", {
            "class": "tab-text tab-label",
            "crop": "end",
            "fadein": "true",
            "flex": "1",
            "value": aTab.getAttribute("label") || "Unknown"}, [])
        ]));
    },

    setPinnedSizes: function() {
        let tabs = this.document.getElementById("tabbrowser-tabs");
        // awfulness
        let numPinned = tabs.tabbrowser._numPinnedTabs;

        if (tabs.getAttribute("positionpinnedtabs")) {
            let width = tabs.boxObject.width;
            for (let i = 0; i < numPinned; ++i) {
                tabs.childNodes[i].style.width = tabs.boxObject.width + "px";
            }
        } else {
            for (let i = 0; i < numPinned; ++i) {
                tabs.childNodes[i].style.width = "";
            }
        }
    },

    onTabbarResized: function() {
        let tabs = this.document.getElementById("tabbrowser-tabs");
        this.setPinnedSizes();
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

    observeThemePref: function() {
      Services.prefs.addObserver("extensions.verticaltabs.theme", this, false);
      this.unloaders.push(function() {
        Services.prefs.removeObserver("extensions.verticaltabs.theme", this, false);
      });
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") {
        return;
      }

      switch (data) {
        case "extensions.verticaltabs.right":
          let browserbox = this.document.getElementById("browser");
          if (browserbox.dir != "reverse") {
            browserbox.dir = "reverse";
          } else {
            browserbox.dir = "normal";
          }
          break;
        case "extensions.verticaltabs.theme":
          console.log("updating theme");
          this.removeThemeStylesheet();
          this.applyThemeStylesheet();
          break;
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
            this.setPinnedSizes();
            return;
        case "popupshowing":
            this.onPopupShowing(aEvent);
            return;
        case "resize":
            this.setPinnedSizes();
            return;
        }
    },

    onTabOpen: function(aEvent) {
        this.initTab(aEvent.target);
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
    }

};
