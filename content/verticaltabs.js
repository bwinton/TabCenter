Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://verticaltabs/content/tabdatastore.jsm");
Components.utils.import("resource://verticaltabs/content/multiselect.jsm");
Components.utils.import("resource://verticaltabs/content/groups.jsm");

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
            this.installStylesheet("resource://verticaltabs/skin/linux/linux.css");
            break;
        }

        this.rearrangeXUL();
        this.initContextMenu();

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
        tabs.addEventListener("TabOpen", this, true);
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

    unload: function() {
        this.unloaders.forEach(function(func) {
          func.call(this);
        }, this);
    },

    onTabbarResized: function() {
        let tabs = this.document.getElementById("tabbrowser-tabs");
        this.window.setTimeout(function() {
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

/**
 * Patches for the tabbrowser-tabs object.
 * 
 * These are necessary where the original implementation assumes a
 * horizontal layout.
 */
function VTTabbrowserTabs(tabs) {
    this.tabs = tabs;
    this.init();
}
VTTabbrowserTabs.prototype = {

    init: function() {
        const tabs = this.tabs;
        ["_positionPinnedTabs",
         "_getDropIndex",
         "_isAllowedForDataTransfer",
         "_setEffectAllowedForDataTransfer"].forEach(function(methodname) {
            this.swapMethod(tabs, this, methodname);
        }, this);

        this.onDragOver = this.onDragOver.bind(this);
        tabs.addEventListener('dragover', this.onDragOver, false);
    },

    unload: function() {
        const tabs = this.tabs;
        ["_positionPinnedTabs",
         "_getDropIndex",
         "_isAllowedForDataTransfer",
         "_setEffectAllowedForDataTransfer"].forEach(function(methodname) {
            this.swapMethod(tabs, this, methodname);
        }, this);

        tabs.removeEventListener('dragover', this.onDragOver, false);
    },

    swapMethod: function(obj1, obj2, methodname) {
      let method1 = obj1[methodname];
      let method2 = obj2[methodname];
      obj1[methodname] = method2;
      obj2[methodname] = method1;
    },

    _positionPinnedTabs: function() {
        // TODO we might want to do something here.
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
        const window = node.ownerDocument.defaultView;
        return (node instanceof window.XULElement
                && node.localName == "tab"
                && (node.parentNode == this
                    || (node.ownerDocument.defaultView instanceof window.ChromeWindow
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

        if (browserDragAndDrop.canDropLink(event)) {
            // Here we need to do this manually
            return dt.effectAllowed = dt.dropEffect = "link";
        }
        return dt.effectAllowed = "none";
    },

    // Calculate the drop indicator's position for vertical tabs.
    // Overwrites what the original 'dragover' event handler does
    // towards the end.
    onDragOver: function(aEvent) {
        const tabs = this.tabs;
        let ind = tabs._tabDropIndicator;
        let newIndex = tabs._getDropIndex(aEvent);
        let rect = tabs.getBoundingClientRect();
        let newMargin;

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
