/*
 * Persistently store tab attributes in the session store service.
 *
 * Heavily inspired by Tree Style Tab's TreeStyleTabUtils.
 */

var EXPORTED_SYMBOLS = ["VTTabDataStore", "VTTabIDs"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var VTTabDataStore = {

    getTabValue: function(aTab, aKey) {
        var value = null;
        try {
            value = this.sessionStore.getTabValue(aTab, aKey);
        } catch(ex) {
            // Ignore
        }
        return value;
    },
 
    setTabValue: function(aTab, aKey, aValue) {
        if (!aValue) {
            this.deleteTabValue(aTab, aKey);
        }

        aTab.setAttribute(aKey, aValue);
        try {
            this.checkCachedSessionDataExpiration(aTab);
            this.sessionStore.setTabValue(aTab, aKey, aValue);
        } catch(ex) {
            // Ignore
        }
    },
 
    deleteTabValue: function(aTab, aKey) {
        aTab.removeAttribute(aKey);
        try {
            this.checkCachedSessionDataExpiration(aTab);
            this.sessionStore.setTabValue(aTab, aKey, '');
            this.sessionStore.deleteTabValue(aTab, aKey);
        } catch(ex) {
            // Ignore
        }
    },

    // workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
    checkCachedSessionDataExpiration: function(aTab) {
        var data = aTab.linkedBrowser.__SS_data;
        if (data &&
            data._tabStillLoading &&
            aTab.getAttribute('busy') != 'true')
            data._tabStillLoading = false;
    }
};
XPCOMUtils.defineLazyServiceGetter(VTTabDataStore, "sessionStore",
                                   "@mozilla.org/browser/sessionstore;1",
                                   "nsISessionStore");


/*
 * Assign tabs a persistent unique identifier.
 *
 * Necessary until https://bugzilla.mozilla.org/show_bug.cgi?id=529477
 * is implemented.
 */

function VTTabIDs(tabs) {
    this.tabs = tabs;
    tabs.VTTabIDs = this;

    tabs.addEventListener('TabOpen', this, true);
    tabs.addEventListener('SSTabRestoring', this, true);
    for (let i=0; i < tabs.childNodes.length; i++) {
        this.initTab(tabs.childNodes[i]);
    }
}
VTTabIDs.prototype = {

    kId: 'verticaltabs-id',

    id: function(aTab) {
        return aTab.getAttribute(this.kId);
    },

    get: function(aID) {
        return this.tabs.getElementsByAttribute(this.kId, aID)[0];
    },

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case 'TabOpen':
            this.initTab(aEvent.originalTarget);
            return;
        case 'SSTabRestoring':
            this.restoreTab(aEvent.originalTarget);
            return;
        }
    },

    makeNewId: function() {
        return 'tab-<' + Date.now() + '-'
               + parseInt(Math.random() * 65000) + '>';
    },

    initTab: function(aTab) {
        if (aTab.hasAttribute(this.kId)) {
            return;
        }
        // Assign an ID.  This may be temporary if the tab is being restored.
        let id = VTTabDataStore.getTabValue(aTab, this.kId) || this.makeNewId();
        VTTabDataStore.setTabValue(aTab, this.kId, id);
    },

    restoreTab: function(aTab) {
        // Restore the original ID
        let newId = VTTabDataStore.getTabValue(aTab, this.kId);
        if (newId) {
            aTab.setAttribute(this.kId, newId);
        }
    }

};
