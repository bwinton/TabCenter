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
 * The Original Code is Home Dash Utility.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Edward Lee <edilee@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
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

 /* global require, exports:false */
'use strict';

const {Cc, Ci} = require('chrome');
const prefs = require('sdk/simple-prefs');


/* Payload */

const {notifyObservers} = Cc['@mozilla.org/observer-service;1'].
                            getService(Ci.nsIObserverService);

const PAYLOAD_KEYS = [
  'tabs_created',
  'tabs_destroyed',
  'tabs_pinned',
  'tabs_unpinned',
  'tab_center_pinned',
  'tab_center_unpinned',
  'tab_center_expanded',
  'tab_center_toggled_off',
  'tab_center_toggled_on'
];

function sendPing(key, window) {
  if (!PAYLOAD_KEYS.includes(key)) {
    // console.log(`Could not find ${key} in payload keys.`);
    return false;
  }
  // This looks strange, but it's required to send over the test ID.
  const subject = {
    wrappedJSObject: {
      observersModuleSubjectWrapper: true,
      object: 'tabcentertest1@mozilla.com'
    }
  };

  let payload = {
    version: 1,
    tab_center_tabs_on_top: prefs.prefs.opentabstop,
    tab_center_show_thumbnails: prefs.prefs.largetabs,
    tab_center_window_id: window.VerticalTabsWindowId,
    tab_center_currently_toggled_on: window.document.getElementById('main-window').getAttribute('toggledon') === 'true'
  };
  payload[key] = 1;

  let ping = JSON.stringify(payload);

  // Send metrics to the main Test Pilot add-on.
  notifyObservers(subject, 'testpilot::send-metric', ping);
  return true;
}
exports.sendPing = sendPing;


/* Preferences */

const {set, reset} = require('sdk/preferences/service');

const DEFAULT_PREFS = new Map([
  ['browser.tabs.animate', false]
]);

function setDefaultPrefs() {
  for (let [name, value] of DEFAULT_PREFS) {
    set(name, value);
  }
}
exports.setDefaultPrefs = setDefaultPrefs;

function removeDefaultPrefs() {
  for (let [name] of DEFAULT_PREFS) {
    reset(name);
  }
}
exports.removeDefaultPrefs = removeDefaultPrefs;

/* Stylesheets */

const {newURI} = require('sdk/url/utils');
const {loadSheet, removeSheet} = require('sdk/stylesheet/utils');

const STYLESHEETS = [
  'resource://tabcenter/override-bindings.css',
  'resource://tabcenter/skin/base.css',
  'chrome://tabcenter/skin/platform.css'
];

function installStylesheets(win) {
  for (let uri of STYLESHEETS) {
    loadSheet(win, uri, 'author');
  }
}
exports.installStylesheets = installStylesheets;

function removeStylesheets(win) {
  for (let uri of STYLESHEETS) {
    removeSheet(win, uri, 'author');
  }
}
exports.removeStylesheets = removeStylesheets;

function installStylesheet(win, uri) {
  loadSheet(win, uri, 'author');
}
exports.installStylesheet = installStylesheet;

function removeStylesheet(win, uri) {
  removeSheet(win, uri, 'author');
}
exports.removeStylesheet = removeStylesheet;
