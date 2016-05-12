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
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is
 * SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   SHIMODA Hiroshi <piro@p.club.ne.jp>
 *   Philipp von Weitershausen <philipp@weitershausen.de>
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
 * ***** END LICENSE BLOCK ******/

/**
 * Persistently store tab attributes in the session store service.
 *
 * Heavily inspired by Tree Style Tab's TreeStyleTabUtils.
 */

/* exported EXPORTED_SYMBOLS */
/* global XPCOMUtils:false*/

const EXPORTED_SYMBOLS = ["VTTabDataStore", "VTTabIDs"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let VTTabDataStore = {

    getTabValue: function(aTab, aKey) {
        let value = null;
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
            this.sessionStore.setTabValue(aTab, aKey, "");
            this.sessionStore.deleteTabValue(aTab, aKey);
        } catch(ex) {
            // Ignore
        }
    },

    // workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
    checkCachedSessionDataExpiration: function(aTab) {
        let data = aTab.linkedBrowser.__SS_data;
        if (data &&
            data._tabStillLoading &&
            aTab.getAttribute("busy") !== "true")
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
    this.init();
}
VTTabIDs.prototype = {

    init: function() {
        const tabs = this.tabs;
        tabs.VTTabIDs = this;
        tabs.addEventListener("TabOpen", this, true);
        tabs.addEventListener("SSTabRestoring", this, true);
        for (let i = 0; i < tabs.childNodes.length; i++) {
            this.initTab(tabs.childNodes[i]);
        }
    },

    unload: function unload() {
        const tabs = this.tabs;
        delete tabs.VTTabIDs;
        tabs.removeEventListener("TabOpen", this, true);
        tabs.removeEventListener("SSTabRestoring", this, true);
    },

    kId: "verticaltabs-id",

    id: function(aTab) {
        return aTab.getAttribute(this.kId);
    },

    get: function(aID) {
        let elements = this.tabs.getElementsByAttribute(this.kId, aID);
        return elements.length ? elements[0] : undefined;
    },

    /*** Event handlers ***/

    handleEvent: function(aEvent) {
        switch (aEvent.type) {
        case "TabOpen":
            this.initTab(aEvent.originalTarget);
            return;
        case "SSTabRestoring":
            this.restoreTab(aEvent.originalTarget);
            return;
        }
    },

    makeNewId: function() {
        return this.uuidGen.generateUUID().toString();
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
XPCOMUtils.defineLazyServiceGetter(VTTabIDs.prototype, "uuidGen",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
