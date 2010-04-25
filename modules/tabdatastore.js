var EXPORTED_SYMBOLS = ['VTTabDataStore'];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/*
 * Persistently store tab attributes in the session store service.
 *
 * Heavily inspired by Tree Style Tab's TreeStyleTabUtils.
 */
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
