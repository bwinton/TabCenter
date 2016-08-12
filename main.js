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

/* global require, exports:false */
'use strict';


const {prefixURI} = require('@loader/options');
const prefs = require('sdk/simple-prefs');
const {setInterval} = require('sdk/timers');
const {mount, unmount} = require('sdk/uri/resource');
const {viewFor} = require('sdk/view/core');
const {browserWindows} = require('sdk/windows');
const {isBrowser, isDocumentLoaded} = require('sdk/window/utils');

const utils = require('./utils');
const {addVerticalTabs} = require('./verticaltabs');

let self = require('sdk/self');
const RESOURCE_HOST = 'tabcenter';

function initWindow(window) {
  // get the XUL window that corresponds to this high-level window
  let win = viewFor(window);
  function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    let byteCharacters = win.atob(b64Data);
    let byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      let slice = byteCharacters.slice(offset, offset + sliceSize);

      let byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      let byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    return new win.Blob(byteArrays, {type: contentType});
  }

  let data = b64toBlob(self.data.load('newtab.b64'), 'image/png');

  // check for browser windows with visible toolbars
  if (!win.toolbar.visible || !isBrowser(win)) {
    return;
  }

  // if the dcoument is loaded
  if (isDocumentLoaded(win)) {
    addVerticalTabs(win, data);
  } else {
    // Listen for load event before checking the window type
    win.addEventListener('load', () => {
      addVerticalTabs(win, data);
    }, {once: true});
  }
}

function sendPayload() {
  for (let window of browserWindows) {
    let win = viewFor(window);
    if (win.VerticalTabs) {
      utils.addPingStats(win.VerticalTabs.stats);
    }
  }
  utils.setPayload('tab_center_tabs_on_top', prefs.prefs.opentabstop);
  utils.sendPing();
}

function largeTabsChange() {
  for (let window of browserWindows) {
    let win = viewFor(window);
    if (win.VerticalTabs) {
      win.VerticalTabs.resizeTabs();
    }
  }
}

exports.main = function (options, callbacks) {
  // Listen for preference changes
  prefs.on('largetabs', largeTabsChange);

  // Register the resource:// alias.
  mount(RESOURCE_HOST, prefixURI);

  // Override default preferences
  utils.setDefaultPrefs();

  // Install the stylesheets
  utils.installStylesheets();

  // Startup VerticalTabs object for each window.
  browserWindows.on('open', initWindow);
  for (let window of browserWindows) {
    initWindow(window);
  }
  setInterval(sendPayload, 24 * 60 * 60 * 1000);  // Every 24h.
  //setInterval(sendPayload, 20*1000);  // Every 20s for debugging.
};

exports.onUnload = function (reason) {
  // Send out the ping
  sendPayload();

  // If the app is shutting down, skip the rest
  if (reason === 'shutdown') {
    return;
  }

  // Shutdown the VerticalTabs object for each window.
  for (let window of browserWindows) {
    let win = viewFor(window);
    if (win.VerticalTabs) {
      win.VerticalTabs.unload();
    }

    let tabs = win.document.getElementById('tabbrowser-tabs');
    if (tabs) {
      tabs.removeAttribute('overflow');
      tabs._positionPinnedTabs();
    }
  }

  // Remove the stylesheets
  utils.removeStylesheets();

  // Restore default preferences
  utils.removeDefaultPrefs();

  // Unregister the resource:// alias.
  unmount(RESOURCE_HOST, null);
};
