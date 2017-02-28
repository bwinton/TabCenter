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
const {get, set, reset} = require('sdk/preferences/service');
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const self = require('sdk/self');
const {studyConfig} = require('shield-config.js');
const {AddonManager} = require('resource://gre/modules/AddonManager.jsm');

const shield = require('shield-studies-addon-utils');
const INCOMPATIBLE_ADDONS = {
  'TooManyTabs@visibotech.com': 'Too Many Tabs',
  'firebug@software.joehewitt.com': 'Firebug',
  'hidecaptionplus-dp@dummy.addons.mozilla.org': 'Hide Caption Titlebar Plus',
  'tabgroups@quicksaver': 'Tab Groups',
  'tabgroupshelper@kevinallasso.org': 'Tab Groups Helper',
  'treestyletab@piro.sakura.ne.jp': 'Tree-Style Tab',
  '{097d3191-e6fa-4728-9826-b533d755359d}': 'All-In-One Sidebar',
  '{c6448328-31f7-4b12-a2e0-5c39d0290307}': 'HTitle',
  '{dc572301-7619-498c-a57d-39143191b318}': 'Tab Mix Plus',
  'multipletab@piro.sakura.ne.jp': 'Multiple Tab Handler',
  'tabscope@xuldev.org': 'Tab Scope',
  'bug566510@vovcacik.addons.mozilla.org': 'Allow multiselect operations on tabs',
  'jid1-rOGUyxs2TvBBuA@jetpack': 'Previous tab highlighting',
  '{fc2b8f80-d9a5-4f51-8076-7c7ce3c67ee3}': 'Diigo Toolbar',
  'tabcentertest1@mozilla.com': 'Tab Center',
  '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}': 'Tab Tree',
  '@testpilot-addon': 'Test Pilot',
  '{0545b830-f0aa-4d7e-8820-50a4629a56fe}': 'ColorfulTabs',
  'rightbar@realmtech.net': 'RightBar',
  'tabsonbottom@piro.sakura.ne.jp':'Tabs on Bottom',
  'extension@one-tab.com':'OneTab',
  'bartablitex@szabolcs.hubai':'BarTab Lite X',
  'jid0-AjzBVlpzVAaBqxcar9QDqMWWAVQ@jetpack':'Side Tabs',
  'TabsTree@traxium':'Tab Tree',
  '{e5bbc237-c99b-4ced-a061-0be27703295f}':'Hide Tab Bar With One Tab',
  'tiletabs@DW-dev':'Tile Tabs',
  'bartabheavy@philikon.de':'BarTab Heavy',
};

class tabCenterStudy extends shield.Study {
  constructor(config, unloadFn) {
    super(config);
    this.unloadFn = unloadFn;
  }

  isEligible() {
    // Bool, does not already have similar feature or things that interfere with tabs

    let conflictingAddons = [];
    AddonManager.getAllAddons(function (aAddons) {
      let activeAddonIds = aAddons.filter(a => a.isActive && !a.appDisabled && !a.userDisabled).map(a => a.id);
      conflictingAddons = Object.keys(INCOMPATIBLE_ADDONS).filter(guid => (activeAddonIds.indexOf(guid) !== -1));
    });

    return super.isEligible() && !conflictingAddons.length;
  }

  cleanup() {
    // code to run on any uninstall
    super.cleanup();
    this.unloadFn();
  }
}

let TCStudy;

exports.makeStudy = function (unload) {
  TCStudy = new tabCenterStudy(studyConfig, unload);
  TCStudy.startup(self.loadReason);
};

const PAYLOAD_KEYS = [
  'tabs_created',
  'tabs_destroyed',
  'tabs_pinned',
  'tabs_unpinned',
  'tab_center_pinned',
  'tab_center_unpinned',
  'tab_center_expanded',
  'tab_center_toggled_off',
  'tab_center_toggled_on',
  'tour_began',
  'tour_accepted',
  'tour_continue',
  'tour_complete',
  'tour_dismissed'
];

function sendPing(key, window, details) {
  if (!PAYLOAD_KEYS.includes(key)) {
    // console.log(`Could not find ${key} in payload keys.`);
    return false;
  }

  let payload = {
    version: 2,
    tab_center_tabs_on_top: prefs.prefs.opentabstop,
    tab_center_show_thumbnails: prefs.prefs.largetabs,
    tab_center_window_id: window.VerticalTabsWindowId,
    tab_center_currently_toggled_on: window.document.getElementById('main-window').getAttribute('toggledon') === 'true',
    tour_completed: !!get('extensions.tabcentertest1@mozilla.com.tourComplete')
  };
  payload[key] = 1;
  Object.assign(payload, details);

  // Send metrics to shield telemetry
  TCStudy.report(payload);

  return true;
}
exports.sendPing = sendPing;


/* Preferences */

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
    installStylesheet(win, uri);
  }
}
exports.installStylesheets = installStylesheets;

function removeStylesheets(win) {
  for (let uri of STYLESHEETS) {
    removeStylesheet(win, uri);
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

function createElement(doc, label, attrs) {
  let rv = doc.createElementNS(NS_XUL, label);
  if (attrs) {
    for (let attr in attrs) {
      rv.setAttribute(attr, attrs[attr]);
    }
  }
  return rv;
}

exports.createElement = createElement;
