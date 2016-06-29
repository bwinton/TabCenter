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

 /* global Iterator:false, unload:false, vtInit:false, watchWindows:false,
           VerticalTabs:false, newPayload:false, sendPing:false,
           addPingStats:false, APP_SHUTDOWN:false, AppConstants: false */

 /*exported install, startup, shutdown, uninstall*/

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import('resource://gre/modules/AppConstants.jsm');
Cu.import('resource://gre/modules/Services.jsm');

const RESOURCE_HOST = 'tabcenter';
const DEFAULT_PREFS = {
  'browser.tabs.animate': false,
  'browser.tabs.drawInTitlebar': false
};

/**
 * Load and execute another file.
 */
let GLOBAL_SCOPE = this;
function include(src) {
  Services.scriptloader.loadSubScript(src, GLOBAL_SCOPE);
}

function setDefaultPrefs() {
  for (let [name, value] in Iterator(DEFAULT_PREFS)) {
    switch (typeof value) {
    case 'boolean':
      Services.prefs.setBoolPref(name, value);
      break;
    case 'number':
      Services.prefs.setIntPref(name, value);
      break;
    case 'string':
      Services.prefs.setCharPref(name, value);
      break;
    }
  }

  //set new tabs to open at top as default -- only if undefined
  try {
    Services.prefs.getBoolPref('extensions.verticaltabs.opentabstop');
  } catch (ex) {
    if (ex.result === Components.results.NS_ERROR_UNEXPECTED) {
      Services.prefs.setBoolPref('extensions.verticaltabs.opentabstop', true);
    } else {
      throw(ex);
    }
  }
}

function removeDefaultPrefs() {
  let branch = Services.prefs.getDefaultBranch('');
  for (let [name] in Iterator(DEFAULT_PREFS)) {
    branch.clearUserPref(name);
  }
}

function install() {
}

let timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);

function startup(data, reason) {
  // Load helpers from utils.js.
  include(data.resourceURI.spec + 'utils.js');

  setDefaultPrefs();

  // Register the resource:// alias.
  let resource = Services.io.getProtocolHandler('resource')
                         .QueryInterface(Ci.nsIResProtocolHandler);
  resource.setSubstitution(RESOURCE_HOST, data.resourceURI);
  unload(function () {
    resource.setSubstitution(RESOURCE_HOST, null);
  });

  // Initialize VerticalTabs object for each window.
  Cu.import('resource://tabcenter/verticaltabs.jsm');
  unload(vtInit());
  watchWindows(function (window) {
    if (window.toolbar.visible) {
      let vt = new VerticalTabs(window, {newPayload, addPingStats, AppConstants, setDefaultPrefs});
      unload(vt.unload.bind(vt), window);
    }
  }, 'navigator:browser');
  timer.initWithCallback({notify: () => {
    sendPing();
  }}, 24 * 60 * 60 * 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);  // Every 24h.
  // }}, 20*1000, Ci.nsITimer.TYPE_REPEATING_SLACK);  // Every 20s for debugging.
}

function shutdown(data, reason) {
  sendPing();
  if (reason === APP_SHUTDOWN) {
    return;
  }
  removeDefaultPrefs();
  unload();
}

function uninstall() {
}
