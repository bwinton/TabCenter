Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://verticaltabs/content/tabbrowser.js");
Components.utils.import("resource://verticaltabs/content/tabdatastore.jsm");
Components.utils.import("resource://verticaltabs/content/multiselect.jsm");
Components.utils.import("resource://verticaltabs/content/groups.jsm");

const EXPORTED_SYMBOLS = ["VerticalTabs"];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
function VerticalTabs(window) {
    this.window = window;
    this.document = window.document;
    window.VerticalTabs = this;
    this.init();
}
VerticalTabs.prototype = {

    init: function() {
        const window = this.window;
        const document = this.document;

        this.installStylesheet("resource://verticaltabs/content/bindings.css");
        this.installStylesheet("resource://verticaltabs/skin/base.css");
        switch (Services.appinfo.OS) {
          case "WINNT":
            this.installStylesheet("resource://verticaltabs/skin/win7/win7.css");
            break;
          case "Darwin":
            this.installStylesheet("resource://verticaltabs/skin/osx/osx.css");
            break;
          case "Linux":
            this.installStylesheet("resource://verticaltabs/skin/osx/osx.css");
            break;
        }

        // Move the bottom stuff (findbar, addonbar, etc.) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        let contentbox = document.getElementById("appcontent");
        let bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);

        // Create a box next to the app content. It will hold the tab
        // bar and the tab toolbar.
        let leftbox = document.createElementNS(NS_XUL, "vbox");
        leftbox.id = "verticaltabs-box";
        contentbox.parentNode.insertBefore(leftbox, contentbox);
        let spacer = document.createElementNS(NS_XUL, "spacer");
        leftbox.appendChild(spacer);

        let splitter = document.createElementNS(NS_XUL, "splitter");
        splitter.id = "verticaltabs-splitter";
        splitter.className = "chromeclass-extrachrome";
        contentbox.parentNode.insertBefore(splitter, contentbox);
        // Hook up event handler for splitter so that the width of the
        // tab bar is persisted.
        splitter.addEventListener("mouseup", this, false);

        // Move the tabs next to the app content, make them vertical,
        // and restore their width from previous session
        if (Services.prefs.getBoolPref("extensions.verticaltabs.right")) {
            leftbox.parentNode.dir = "reverse";
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

        // Force tabs on bottom (for styling).
        window.TabsOnTop.enabled = false;
        // Remove all menu items for tabs on top.
        let menuitem = document.getElementById("menu_tabsOnTop");
        menuitem.collapsed = true;
        menuitem.nextSibling.collapsed = true;
        let contextmenu = document.getElementById("toolbar-context-menu");
        contextmenu.removeChild(contextmenu.firstChild);
        contextmenu.removeChild(contextmenu.firstChild);
        let appmenuitem = document.getElementById("appmenu_toggleTabsOnTop");
        if (appmenuitem) {
            appmenuitem.collapsed = true;
        }
        // Make the command a no-op just to be safe.
        document.getElementById("cmd_ToggleTabsOnTop").setAttribute(
            "oncommand", "");

        this.vtTabs = new VTTabbrowserTabs(window);
        this.tabIDs = new VTTabIDs(tabs);
        this.multiSelect = new VTMultiSelect(tabs);
        this.groups = new VTGroups(tabs);

        // Fix up each individual tab for vertical layout, including
        // ones that are opened later on.
        tabs.addEventListener("TabOpen", this, true);
        for (let i=0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }

        this.initContextMenu();
    },

    installStylesheet: function(uri) {
        const document = this.document;
        let pi = document.createProcessingInstruction(
          "xml-stylesheet", "href=\"" + uri + "\" type=\"text/css\"");
        document.insertBefore(pi, document.firstChild);

        //TODO remember pi for unload
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

        tabs.contextMenu.appendChild(
          document.createElementNS(NS_XUL, "menuseparator"));

        let groupTabs = document.createElementNS(NS_XUL, "menuitem");
        groupTabs.id = "context_verticalTabsCloseMultiple";
        groupTabs.setAttribute("label", "Group"); //TODO l10n
        groupTabs.setAttribute("tbattr", "tabbrowser-multiple");
        groupTabs.setAttribute(
          "oncommand", "gBrowser.tabContainer.VTGroups.createGroupFromMultiSelect();");
        tabs.contextMenu.appendChild(groupTabs);

        tabs.contextMenu.addEventListener("popupshowing", this, false);
    },

    initTab: function(aTab) {
        aTab.setAttribute("align", "stretch");
        aTab.removeAttribute("maxwidth");
        aTab.removeAttribute("minwidth");
        aTab.removeAttribute("width");
        aTab.removeAttribute("flex");
        aTab.maxWidth = 65000;
        aTab.minWidth = 0;
    },

    unload: function() {
        //TODO
        this.vtTabs.unload();
    },

    onTabbarResized: function() {
        let tabs = this.document.getElementById("tabbrowser-tabs");
        setTimeout(function() {
            Services.prefs.setIntPref("extensions.verticaltabs.width",
                                      tabs.boxObject.width);
        }, 10);
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
