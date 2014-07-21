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

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

const RESOURCE_HOST = "verticaltabs";
const PREF_BRANCH = "extensions.verticaltabs.";
const DEFAULT_PREFS = {
  "extensions.verticaltabs.width": 250,
  "extensions.verticaltabs.right": false,
  "extensions.verticaltabs.tabsOnTop": false,
  "browser.tabs.drawInTitlebar": false,
  "extensions.verticaltabs.theme": 'dark'
};

/**
 * Load and execute another file.
 */
let GLOBAL_SCOPE = this;
function include(src) {
  Services.scriptloader.loadSubScript(src, GLOBAL_SCOPE);
}

/**
 * Declare a bunch of default preferences.
 */
function setDefaultPrefs() {
  let branch = Services.prefs.getDefaultBranch("");
  for (let [name, value] in Iterator(DEFAULT_PREFS)) {
    switch (typeof value) {
      case "boolean":
        branch.setBoolPref(name, value);
        break;
      case "number":
        branch.setIntPref(name, value);
        break;
      case "string":
        branch.setCharPref(name, value);
        break;
    }
  }
}

function install() {
}

function startup(data, reason) {
  // Load helpers from utils.js.
  include(data.resourceURI.spec + "utils.js");

  // Back up 'browser.tabs.animate' pref before overwriting it.
  try {
    Services.prefs.getBoolPref("extensions.verticaltabs.animate");
  } catch (ex if (ex.result == Components.results.NS_ERROR_UNEXPECTED)) {
    let animate = Services.prefs.getBoolPref("browser.tabs.animate");
    Services.prefs.setBoolPref("extensions.verticaltabs.animate", animate);
    Services.prefs.setBoolPref("browser.tabs.animate", false);
  }
  unload(function () {
    let animate = Services.prefs.getBoolPref("extensions.verticaltabs.animate");
    Services.prefs.setBoolPref("browser.tabs.animate", animate);
  });

  // Set default preferences.
  setDefaultPrefs();

  // Register the resource:// alias.
  let resource = Services.io.getProtocolHandler("resource")
                         .QueryInterface(Ci.nsIResProtocolHandler);
  resource.setSubstitution(RESOURCE_HOST, data.resourceURI);
  unload(function () {
    resource.setSubstitution(RESOURCE_HOST, null);
  });

  // Initialize VerticalTabs object for each window.
  Cu.import("resource://verticaltabs/verticaltabs.jsm");
  watchWindows(function(window) {
    let vt = new VerticalTabs(window);
    unload(vt.unload.bind(vt), window);
  }, "navigator:browser");
};

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }
  unload();
  // Unloaders might want access to prefs, so do this last
  Services.prefs.getDefaultBranch(PREF_BRANCH).deleteBranch("");
}
