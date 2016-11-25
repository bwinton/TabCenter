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
const {Hotkey} = require('sdk/hotkeys');

const {Cc, Ci, Cu} = require('chrome');
const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                       getService(Ci.nsIWindowWatcher);
const ss = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);

const strings = require('./get-locale-strings').getLocaleStrings();
const utils = require('./utils');
const {addVerticalTabs} = require('./verticaltabs');

let self = require('sdk/self');
const RESOURCE_HOST = 'tabcenter';

let observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
let startupFinishedObserver = null;

let hotkey;
let VerticalTabsWindowId = 1;

function firstInstallTour(win) {
  if (win.activeInstall) {
    win.activeInstall = false;
    let document = win.document;
    let button = document.getElementById('side-tabs-button');
    let panel = document.createElement('panel');
    let outerbox = document.createElement('vbox', 'onboard-panel-box');
    let instructions = document.createElement('description');
    let progressButton = document.createElement('button', 'step-one-button');
    document.getElementById('mainPopupSet').appendChild(panel); //attach to DOM anywhere
    panel.setAttribute('id', 'tour-panel');
    panel.setAttribute('type', 'arrow');
    panel.setAttribute('flip', 'slide');
    panel.style.width = '200px';
    panel.style.height = '400px';
    instructions.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum';
    instructions.style.width = '200px';
    progressButton.setAttribute('label', 'Show me how');
    progressButton.style.display = 'block';
    progressButton.style.width = '200px';
    progressButton.style.height = '50px';
    let xpos;
    let outerRect = {};


    let movePanelToFind = () => {
      xpos -= 2;
      panel.moveTo(xpos, outerRect.y);
      //move amount of pixels center of find-input is away from center of pin-button
      if (xpos > outerRect.x - 104) {
        win.requestAnimationFrame(movePanelToFind);
      }
    };

    let movePanelToTop = () => {
      xpos += 2;
      panel.moveTo(xpos, outerRect.y);
      //move amount of pixels center of top-tabs-button is away from center of find-input
      if (xpos < outerRect.x + 69) {
        win.requestAnimationFrame(movePanelToTop);
      }
    };

    progressButton.onclick = (e) => {
      panel.hidePopup();
      document.getElementById('side-tabs-button').onclick(e); //will only accept left click...
      document.getElementById('mainPopupSet').appendChild(panel); //reattach to DOM after running unload
      progressButton.setAttribute('label', 'Next');
      panel.openPopup(document.getElementById('pin-button'), 'bottomcenter topleft', 0, 0, false, false);
      progressButton.onclick = (e) => {
        outerRect = panel.getOuterScreenRect();
        xpos = outerRect.x;
        win.requestAnimationFrame(movePanelToFind);
        progressButton.onclick = (e) => {
          outerRect = panel.getOuterScreenRect();
          xpos = outerRect.x;
          win.requestAnimationFrame(movePanelToTop);
          progressButton.setAttribute('label', 'Finish');
          progressButton.onclick = (e) => {
            panel.hidePopup();
          };
        };
      };
    };

    panel.appendChild(outerbox);
    outerbox.appendChild(instructions);
    outerbox.appendChild(progressButton);
    panel.openPopup(button, 'bottomcenter topright', 0, 0, false, true);
  }
}

function b64toBlob(win, b64Data, contentType, sliceSize) {
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

function setPersistantAttrs(win) {
  let mainWindow = win.document.getElementById('main-window');
  mainWindow.setAttribute('persist', mainWindow.getAttribute('persist') + ' tabspinned tabspinnedwidth toggledon');
  try {
    if(ss.getWindowValue(win, 'TCtoggledon') !== ''){ // on win/linux this does not throw an error, so check for value
      mainWindow.setAttribute('toggledon', ss.getWindowValue(win, 'TCtoggledon'));
      mainWindow.setAttribute('tabspinnedwidth', ss.getWindowValue(win, 'TCtabspinnedwidth'));
      mainWindow.setAttribute('tabspinned', ss.getWindowValue(win, 'TCtabspinned'));
    }
    //set default Session values
    ss.setWindowValue(win, 'TCtabspinnedwidth', mainWindow.getAttribute('tabspinnedwidth'));
    ss.setWindowValue(win, 'TCtabspinned', mainWindow.getAttribute('tabspinned'));
    ss.setWindowValue(win, 'TCtoggledon', mainWindow.getAttribute('toggledon'));
  } catch (e) {
    if (e.name !== 'NS_ERROR_ILLEGAL_VALUE') {
      throw e;
    }
    // on fresh windows getWindowValue throws an exception. Ignore this.
  }
  mainWindow.setAttribute('toggledon', 'false'); //TODO: temporary for testing
}

function initWindow(window) {
  // get the XUL window that corresponds to this high-level window
  let win = viewFor(window);

  if (!('__SSi' in win)) {
    startupFinishedObserver = {
      observe : function (aSubject, aTopic, aData) {
        observerService.removeObserver(this, 'browser-delayed-startup-finished');
        setPersistantAttrs(win);
        startupFinishedObserver = null;
      }
    };
    observerService.addObserver(startupFinishedObserver, 'browser-delayed-startup-finished', false);
  } else {
    setPersistantAttrs(win);
  }

  win.tabCenterEventListener = {};

  win.addEventListener('TabOpen', win.tabCenterEventListener, false);
  win.addEventListener('TabClose', win.tabCenterEventListener, false);
  win.addEventListener('TabPinned', win.tabCenterEventListener, false);
  win.addEventListener('TabUnpinned', win.tabCenterEventListener, false);

  win.tabCenterEventListener.handleEvent = function (aEvent) {
    switch (aEvent.type) {
    case 'TabOpen':
      utils.sendPing('tabs_created', win);
      return;
    case 'TabClose':
      utils.sendPing('tabs_destroyed', win);
      return;
    case 'TabPinned':
      utils.sendPing('tabs_pinned', win);
      return;
    case 'TabUnpinned':
      utils.sendPing('tabs_unpinned', win);
      return;
    }
  };

  win.VerticalTabsWindowId = VerticalTabsWindowId;
  VerticalTabsWindowId++;

  let data = b64toBlob(win, self.data.load('newtab.b64'), 'image/png');

  // check for browser windows with visible toolbars
  if (!win.toolbar.visible || !isBrowser(win)) {
    return;
  }

  // if the dcoument is loaded
  if (isDocumentLoaded(win)) {
    addVerticalTabs(win, data);
    firstInstallTour(win);
  } else {
    // Listen for load event before checking the window type
    win.addEventListener('load', () => {
      addVerticalTabs(win, data);
      firstInstallTour(win);
    }, {once: true});
  }
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

  // Startup VerticalTabs object for each window.
  for (let window of browserWindows) {
    //cause no disruption to users when changing the way we handle
    //the tabsontop pref between v1.26 and v1.27
    let win = viewFor(window);
    let mainWindow = win.document.getElementById('main-window');
    let tabbrowser = win.document.getElementById('tabbrowser-tabs');
    if (mainWindow.getAttribute('doNotReverse') !== 'true' && options.loadReason === 'upgrade' && prefs.prefs.opentabstop === true) {
      let reversedTabs = Array.prototype.slice.call(tabbrowser.children).reverse();
      for (let tab of reversedTabs) {
        tabbrowser.appendChild(tab, tabbrowser.firstChild);
      }
    }
    //show onboarding experience in the active on "install"
    if (browserWindows.activeWindow === window && options.loadReason === 'install') {
      win.activeInstall = true;
    }
    initWindow(window);
  }

  windowWatcher.registerNotification({
    observe: function observe(subject, topic, data) {
      try {
        let window = subject.QueryInterface(Ci.nsIDOMWindow);
        if (topic === 'domwindowopened') {
          window.addEventListener('load', () => {
            initWindow(window);
          }, {once: true});
        }
      }
      catch(e) {
        console.exception(e); // eslint-disable-line no-console
      }
    }
  });

  hotkey = Hotkey({
    combo: 'accel-shift-l',
    onPress: function () {
      let window = viewFor(browserWindows.activeWindow);
      let input = window.document.getElementById('find-input');
      if (input) {
        let mainWindow = window.document.getElementById('main-window');
        let sidebar = window.document.getElementById('verticaltabs-box');
        if (mainWindow.getAttribute('tabspinned') === 'true' &&
          input.style.visibility === 'collapse') {
          return;
        }
        if (sidebar.getAttribute('search_expanded') === 'true') {
          sidebar.removeAttribute('search_expanded');
          input.blur();
          if (mainWindow.getAttribute('tabspinned') !== 'true') {
            sidebar.removeAttribute('expanded');
            window.VerticalTabs.clearFind();
          }
        } else {
          sidebar.setAttribute('search_expanded', 'true');
          sidebar.setAttribute('expanded', 'true');
          window.setTimeout(() => {
            input.focus();
          }, 150);
          if (mainWindow.getAttribute('tabspinned') !== 'true') {
            window.VerticalTabs.recordExpansion();
            window.VerticalTabs.adjustCrop();
          }
        }
      }
    }
  });
};

exports.onUnload = function (reason) {
  // If the app is shutting down, skip the rest
  if (reason === 'shutdown') {
    return;
  }
  if (startupFinishedObserver) {
    observerService.removeObserver(startupFinishedObserver, 'browser-delayed-startup-finished');
    startupFinishedObserver = null;
  }
  hotkey.destroy();

  // Shutdown the VerticalTabs object for each window.
  for (let window of browserWindows) {
    let win = viewFor(window);
    if (win.VerticalTabs) {
      win.VerticalTabs.unload();
      let mainWindow = win.document.getElementById('main-window');
      mainWindow.setAttribute('doNotReverse', 'true');
      mainWindow.removeAttribute('tabspinned');
      mainWindow.removeAttribute('tabspinnedwidth');
      mainWindow.removeAttribute('toggledon');
      mainWindow.setAttribute('persist',
        mainWindow.getAttribute('persist').replace(' tabspinned', '').replace(' tabspinnedwidth', '').replace(' toggledon', ''));

      win.removeEventListener('TabOpen', win.tabCenterEventListener, false);
      win.removeEventListener('TabClose', win.tabCenterEventListener, false);
      win.removeEventListener('TabPinned', win.tabCenterEventListener, false);
      win.removeEventListener('TabUnpinned', win.tabCenterEventListener, false);
      delete win.VerticalTabs;
    }
  }

  // Restore default preferences
  utils.removeDefaultPrefs();

  // Unregister the resource:// alias.
  unmount(RESOURCE_HOST, null);
};
