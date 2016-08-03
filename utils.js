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
  'tab_center_expanded'
];

function Stats() {
  for (let key of PAYLOAD_KEYS) {
    this[key] = 0;
  }
}
exports.Stats = Stats;

let payload = new Stats;
payload.version = 1;

function addPingStats(stats) {
  for (let key of PAYLOAD_KEYS) {
    payload[key] += stats[key] || 0;
  }
}
exports.addPingStats = addPingStats;

function setPayload(key, value) {
  payload[key] = value;
}
exports.setPayload = setPayload;

function sendPing() {
  // This looks strange, but it's required to send over the test ID.
  const subject = {
    wrappedJSObject: {
      observersModuleSubjectWrapper: true,
      object: 'tabcentertest1@mozilla.com'
    }
  };

  let ping = JSON.stringify(payload);

  // Send metrics to the main Test Pilot add-on.
  notifyObservers(subject, 'testpilot::send-metric', ping);

  // Clear out the metrics for next time…
  for (let key of PAYLOAD_KEYS) {
    payload[key] = 0;
  }
}
exports.sendPing = sendPing;


/* Preferences */

const {set, reset} = require('sdk/preferences/service');

const DEFAULT_PREFS = new Map([
  ['browser.tabs.animate', false],
  ['browser.tabs.drawInTitlebar', false]
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
const {loadAndRegisterSheet, unregisterSheet, USER_SHEET} = Cc['@mozilla.org/content/style-sheet-service;1'].
                                                              getService(Ci.nsIStyleSheetService);

const STYLESHEETS = [
  'resource://tabcenter/override-bindings.css',
  'resource://tabcenter/skin/base.css',
  'chrome://tabcenter/skin/platform.css'
];

function installStylesheets() {
  for (let uri of STYLESHEETS) {
    loadAndRegisterSheet(newURI(uri), USER_SHEET);
  }
}
exports.installStylesheets = installStylesheets;

function removeStylesheets() {
  for (let uri of STYLESHEETS) {
    unregisterSheet(newURI(uri), USER_SHEET);
  }
}
exports.removeStylesheets = removeStylesheets;
