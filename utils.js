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

/* global Cc:false, Ci:false */
/*exported sendPing, addPingStats, watchWindows*/
'use strict';

/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
  // Initialize the array of unloaders on the first usage
  let unloaders = unload.unloaders;
  if (unloaders == null)
    unloaders = unload.unloaders = [];

  // Calling with no arguments runs all the unloader callbacks
  if (callback == null) {
    unloaders.slice().forEach(function(unloader) { unloader(); });
    unloaders.length = 0;
    return;
  }

  // The callback is bound to the lifetime of the container if we have one
  if (container != null) {
    // Remove the unloader when the container unloads
    container.addEventListener('unload', removeUnloader, false);

    // Wrap the callback to additionally remove the unload listener
    let origCallback = callback;
    callback = function() {
      container.removeEventListener('unload', removeUnloader, false);
      origCallback();
    };
  }

  // Wrap the callback in a function that ignores failures
  function unloader() {
    try {
      callback();
    }
    catch(ex) {
      // console.error(ex);
    }
  }
  unloaders.push(unloader);

  // Provide a way to remove the unloader
  function removeUnloader() {
    let index = unloaders.indexOf(unloader);
    if (index !== -1)
      unloaders.splice(index, 1);
  }
  return removeUnloader;
}

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback) {
  // Wrap the callback in a function that ignores failures
  function watcher(window) {
    try {
      // Now that the window has loaded, only handle browser windows
      let {documentElement} = window.document;
      if (documentElement.getAttribute('windowtype') === 'navigator:browser')
        callback(window);
    }
    catch(ex) {
      // console.error(ex);
    }
  }

  // Wait for the window to finish loading before running the callback
  function runOnLoad(window) {
    // Listen for one load event before checking the window type
    window.addEventListener('load', function runOnce() {
      window.removeEventListener('load', runOnce, false);
      watcher(window);
    }, false);
  }

  // Add functionality to existing windows
  let windows = Services.wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    // Only run the watcher immediately if the window is completely loaded
    let window = windows.getNext();
    if (window.document.readyState === 'complete')
      watcher(window);
    // Wait for the window to load before continuing
    else
      runOnLoad(window);
  }

  // Watch for new browser windows opening then wait for it to load
  function windowWatcher(subject, topic) {
    if (topic === 'domwindowopened')
      runOnLoad(subject);
  }
  Services.ww.registerNotification(windowWatcher);

  // Make sure to stop watching for windows if we're unloading
  unload(function() { Services.ww.unregisterNotification(windowWatcher); });
}

const PAYLOAD_KEYS = [
  'tabs_created',
  'tabs_destroyed',
  'tabs_pinned',
  'tabs_unpinned',
  'tab_center_pinned',
  'tab_center_unpinned',
  'tab_center_expanded'
];

function newPayload() {
  let rv = {};
  PAYLOAD_KEYS.forEach(key => {
    rv[key] = 0;
  });
  return rv;
}

let payload = newPayload();

function addPingStats(stats) {
  PAYLOAD_KEYS.forEach(key => {
    payload[key] += stats[key] || 0;
  });
}

function sendPing() {
  const observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  // This looks strange, but it's required to send over the test ID.
  const subject = {
    wrappedJSObject: {
      observersModuleSubjectWrapper: true,
      object: 'tabcentertest1@mozilla.com'
    }
  };

  let userAgent = Cc['@mozilla.org/network/protocol;1?name=http']
                    .getService(Ci.nsIHttpProtocolHandler).userAgent;

  let windows = Services.wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    let vt = windows.getNext().VerticalTabs;
    if (vt) {
      vt.sendStats();
    }
  }

  let ping = JSON.stringify({
    'test': 'tabcentertest1@mozilla.com',  // The em:id field from the add-on
    'agent': userAgent,
    'version': 1,  // Just in case we need to drastically change the format later
    'payload': payload
  });
  payload = newPayload();
  // Send metrics to the main Test Pilot add-on.
  // let console = (Components.utils.import('resource://gre/modules/devtools/Console.jsm', {})).console;
  // console.log('Sending ping', ping);
  observerService.notifyObservers(subject, 'testpilot::send-metric', ping);
  // Clear out the metrics for next time…
}
