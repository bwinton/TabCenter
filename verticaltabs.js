/* -*- Mode: javascript; indent-tabs-mode: nil -*- */
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

/* global require, exports:false, PageThumbs:false, CustomizableUI:false PluralForm:false*/
'use strict';

const {Cc, Ci, Cu} = require('chrome');
const {platform} = require('sdk/system');
const {prefs} = require('sdk/simple-prefs');
const {get, set} = require('sdk/preferences/service');

const {sendPing, setDefaultPrefs, removeStylesheets, installStylesheets} = require('./utils');
const {createExposableURI} = Cc['@mozilla.org/docshell/urifixup;1'].
                               createInstance(Ci.nsIURIFixup);
const strings = require('./get-locale-strings').getLocaleStrings();
const ss = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);
const utils = require('./utils');

Cu.import('resource://gre/modules/PageThumbs.jsm');
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/PluralForm.jsm');

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const TAB_DROP_TYPE = 'application/x-moz-tabbrowser-tab';

// Wait these many milliseconds before resizing tabs
// after mousing out
const WAIT_BEFORE_RESIZE = 1000;
/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
function VerticalTabs(window, data) {
  this.window = window;
  this.document = window.document;
  this.sendPing = sendPing;
  this.unloaders = [];

  window.createImageBitmap(data).then((response) => {
    this.newTabImage = response;
  });

  this.init();
}
VerticalTabs.prototype = {

  init: function () {
    let window = this.window;
    let document = this.document;
    this.window.VerticalTabs = this;
    this.resizeTimeout = 0;
    this.mouseInside = false;
    let mainWindow = document.getElementById('main-window');
    let tabs = document.getElementById('tabbrowser-tabs');

    if (mainWindow.getAttribute('toggledon') === '') {
      mainWindow.setAttribute('toggledon', 'false');
    }

    if (mainWindow.getAttribute('toggledon') === 'false') {
      let toolbar = document.getElementById('TabsToolbar');
      this.clearFind();
      tabs.removeAttribute('mouseInside');
      let sidetabsbutton = utils.createElement(document, 'toolbarbutton', {
        'id': 'side-tabs-button',
        'label': strings.sideLabel,
        'tooltiptext': strings.sideTooltip,
        'class': 'toolbarbutton-1'
      });
      sidetabsbutton.style.MozAppearance = 'none';
      sidetabsbutton.style.setProperty('-moz-image-region', 'rect(0, 16px, 16px, 0)', 'important');

      let checkBrighttext = function () {
        if (document.getElementById('nav-bar').getAttribute('brighttext') === 'true') {
          sidetabsbutton.style.setProperty('list-style-image', 'url("resource://tabcenter/skin/tc-side-white.svg")', 'important');
        } else {
          sidetabsbutton.style.setProperty('list-style-image', 'url("resource://tabcenter/skin/tc-side.svg")', 'important');
        }
      };
      checkBrighttext();

      window.addEventListener('customizationchange', checkBrighttext);

      sidetabsbutton.onclick = (e) => {
        if (e.which !== 1) {
          return;
        }
        mainWindow.setAttribute('toggledon', 'true');
        this.unload();
        set('extensions.tabcentertest1@mozilla.com.lastUsedTimestamp', Date.now().toString());
        ss.setWindowValue(window, 'TCtoggledon', mainWindow.getAttribute('toggledon'));
        this.init();
        window.VerticalTabs.sendPing('tab_center_toggled_on', window);
      };

      toolbar.insertBefore(sidetabsbutton, null);
      this.unload();
      this.unloaders.push(function () {
        toolbar.removeChild(sidetabsbutton);
        window.removeEventListener('customizationchange', checkBrighttext);
      });

      return;
    }

    installStylesheets(window);

    this.PageThumbs = PageThumbs;
    this._endRemoveTab = window.gBrowser._endRemoveTab;
    this.inferFromText = window.ToolbarIconColor.inferFromText;
    this.receiveMessage = window.gBrowser.receiveMessage;

    let oldMoveTabTo = window.gBrowser.moveTabTo;
    window.gBrowser.moveTabTo = function (aTab, aIndex) {
      let oldPosition = aTab._tPos;
      let numPinned = window.VerticalTabs.numPinnedtabs();
      let reverse = tabs.getAttribute('opentabstop');

      if (oldPosition === aIndex && (!reverse || numPinned === 0)) {
        return;
      }

      // Don't allow mixing pinned and unpinned tabs.
      if (aTab.pinned && !reverse) {
        aIndex = Math.min(aIndex, numPinned - 1);
      } else if (aTab.pinned && reverse) {
        aIndex = Math.max(aIndex, this.tabs.length - numPinned);
      } else if (!aTab.pinned && !reverse) {
        aIndex = Math.max(aIndex, numPinned);
      } else {
        aIndex = Math.min(aIndex, this.tabs.length - numPinned - 1);
      }

      this._lastRelatedTab = null;

      let wasFocused = (document.activeElement === this.mCurrentTab);

      aIndex = aIndex < aTab._tPos ? aIndex : aIndex + 1;

      // invalidate cache
      this._visibleTabs = null;

      // use .item() instead of [] because dragging to the end of the strip goes out of
      // bounds: .item() returns null (so it acts like appendChild), but [] throws
      this.tabContainer.insertBefore(aTab, this.tabs.item(aIndex));

      for (let i = 0; i < this.tabs.length; i++) {
        this.tabs[i]._tPos = i;
        this.tabs[i]._selected = false;
      }

      // If we're in the midst of an async tab switch while calling
      // moveTabTo, we can get into a case where _visuallySelected
      // is set to true on two different tabs.
      //
      // What we want to do in moveTabTo is to remove logical selection
      // from all tabs, and then re-add logical selection to mCurrentTab
      // (and visual selection as well if we're not running with e10s, which
      // setting _selected will do automatically).
      //
      // If we're running with e10s, then the visual selection will not
      // be changed, which is fine, since if we weren't in the midst of a
      // tab switch, the previously visually selected tab should still be
      // correct, and if we are in the midst of a tab switch, then the async
      // tab switcher will set the visually selected tab once the tab switch
      // has completed.
      this.mCurrentTab._selected = true;

      if (wasFocused) {
        this.mCurrentTab.focus();
      }

      this.tabContainer._handleTabSelect(false);

      if (aTab.pinned) {
        this.tabContainer._positionPinnedTabs();
      }

      this.tabContainer._setPositionalAttributes();

      let evt = document.createEvent('UIEvents');
      evt.initUIEvent('TabMove', true, false, window, oldPosition);
      aTab.dispatchEvent(evt);
    };

    let oldPinTab = window.gBrowser.pinTab;
    window.gBrowser.pinTab = function (aTab) {
      if (aTab.pinned) {
        return;
      }

      let numPinned = window.VerticalTabs.numPinnedtabs();

      if (aTab.hidden) {
        this.showTab(aTab);
      }

      let reverse = document.getAnonymousElementByAttribute(this.tabContainer, 'anonid', 'arrowscrollbox')._isRTLScrollbox;
      if (reverse) {
        this.moveTabTo(aTab, this.tabs.length - numPinned - 1);
      } else {
        this.moveTabTo(aTab, numPinned);
      }

      aTab.setAttribute('pinned', 'true');
      this.tabContainer._unlockTabSizing();
      this.tabContainer._positionPinnedTabs();
      this.tabContainer.adjustTabstrip();

      this.getBrowserForTab(aTab).messageManager.sendAsyncMessage('Browser:AppTab', {isAppTab: true});

      let event = document.createEvent('Events');
      event.initEvent('TabPinned', true, false);
      aTab.dispatchEvent(event);
    };

    let OldPrintPreviewListenerEnter = window.PrintPreviewListener.onEnter;
    let OldPrintPreviewListenerExit = window.PrintPreviewListener.onExit;

    window.PrintPreviewListener.onEnter = () => {
      let mainWindow = document.getElementById('main-window');
      mainWindow.setAttribute('printPreview', 'true');
      OldPrintPreviewListenerEnter.call(window.PrintPreviewListener);
    };

    window.PrintPreviewListener.onExit = () => {
      mainWindow.removeAttribute('printPreview');
      OldPrintPreviewListenerExit.call(window.PrintPreviewListener);
    };

    // change the text in the tab context box
    let close_next_tabs_message = document.getElementById('context_closeTabsToTheEnd');
    let previous_close_message = close_next_tabs_message.getAttribute('label');

    let oldWarnAboutClosingTabs = window.gBrowser.warnAboutClosingTabs;
    window.gBrowser.warnAboutClosingTabs = function (aCloseTabs, aTab) {
      let tabsToClose;
      switch (aCloseTabs) {
      case this.closingTabsEnum.ALL:
        tabsToClose = this.tabs.length - this._removingTabs.length -
                      window.VerticalTabs.numPinnedtabs();
        break;
      case this.closingTabsEnum.OTHER:
        tabsToClose = this.visibleTabs.length - 1 - window.VerticalTabs.numPinnedtabs();
        break;
      case this.closingTabsEnum.TO_END:
        if (!aTab){
          throw new Error('Required argument missing: aTab');
        }

        tabsToClose = this.getTabsToTheEndFrom(aTab).length;
        break;
      default:
        throw new Error('Invalid argument: ' + aCloseTabs);
      }

      if (tabsToClose <= 1) {
        return true;
      }

      const pref = aCloseTabs === this.closingTabsEnum.ALL ?
                   'browser.tabs.warnOnClose' : 'browser.tabs.warnOnCloseOtherTabs';
      let shouldPrompt = Services.prefs.getBoolPref(pref);
      if (!shouldPrompt) {
        return true;
      }

      let ps = Services.prompt;

      // default to true: if it were false, we wouldn't get this far
      let warnOnClose = {value: true};
      let bundle = this.mStringBundle;

      // focus the window before prompting.
      // this will raise any minimized window, which will
      // make it obvious which window the prompt is for and will
      // solve the problem of windows "obscuring" the prompt.
      // see bug #350299 for more details
      window.focus();
      let warningMessage =
        PluralForm.get(tabsToClose, bundle.getString('tabs.closeWarningMultiple'))
                  .replace('#1', tabsToClose);
      let buttonPressed =
        ps.confirmEx(window,
                     bundle.getString('tabs.closeWarningTitle'),
                     warningMessage,
                     (ps.BUTTON_TITLE_IS_STRING * ps.BUTTON_POS_0)
                     + (ps.BUTTON_TITLE_CANCEL * ps.BUTTON_POS_1),
                     bundle.getString('tabs.closeButtonMultiple'),
                     null, null,
                     aCloseTabs === this.closingTabsEnum.ALL ?
                       bundle.getString('tabs.closeWarningPromptMe') : null,
                     warnOnClose);
      let reallyClose = (buttonPressed === 0);

      // don't set the pref unless they press OK and it's false
      if (aCloseTabs === this.closingTabsEnum.ALL && reallyClose && !warnOnClose.value) {
        Services.prefs.setBoolPref(pref, false);
      }

      return reallyClose;
    };

    let oldGetTabsToTheEndFrom = window.gBrowser.getTabsToTheEndFrom;
    window.gBrowser.getTabsToTheEndFrom = (aTab) => {
      let tabsToEnd = [];
      let tabs = window.gBrowser.visibleTabs;
      for (let i = tabs.length - 1; tabs[i] !== aTab && i >= 0; --i) {
        if (!tabs[i].pinned) {
          tabsToEnd.push(tabs[i]);
        }
      }
      return tabsToEnd.reverse();
    };

    let oldAddTab = window.gBrowser.addTab;
    window.gBrowser.addTab = function (...args) {
      let numPinned = window.VerticalTabs.numPinnedtabs();

      let t = oldAddTab.bind(window.gBrowser)(...args);
      if (prefs.opentabstop) {
        let aRelatedToCurrent;
        let aReferrerURI;
        if (arguments.length === 2 && typeof arguments[1] === 'object' && !(arguments[1] instanceof Ci.nsIURI)) {
          let params = arguments[1];
          aReferrerURI = params.referrerURI;
          aRelatedToCurrent = params.relatedToCurrent;
        }
        if ((aRelatedToCurrent === null ? aReferrerURI : aRelatedToCurrent) &&
        Services.prefs.getBoolPref('browser.tabs.insertRelatedAfterCurrent')) {
          let newTabPos = (this._lastRelatedTab || this.selectedTab)._tPos;
          this.moveTabTo(t, newTabPos);
          this._lastRelatedTab = t;
        } else {
          this.moveTabTo(t, window.gBrowser.tabs.length - numPinned - 1);
        }
      }
      return t;
    };

    let reverseTabsListener = function () {
      let arrowscrollbox = document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
      if (arrowscrollbox) {
        window.VerticalTabs.reverseTabs(arrowscrollbox);
      }
      window.gBrowser._lastRelatedTab = null;
    };

    // update on changing preferences
    require('sdk/simple-prefs').on('opentabstop', reverseTabsListener);

    let arrowscrollbox = document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
    if (arrowscrollbox && prefs.opentabstop) {
      window.VerticalTabs.reverseTabs(arrowscrollbox);
    } else {
      close_next_tabs_message.setAttribute('label', strings.closeTabsBelow);
    }

    let tabsProgressListener = {
      onLocationChange: (aBrowser, aWebProgress, aRequest, aLocation, aFlags) => {
        for (let tab of this.window.gBrowser.visibleTabs) {
          if (tab.linkedBrowser === aBrowser) {
            tab.refreshThumbAndLabel();
          }
        }
      },
      onStateChange: (aBrowser, aWebProgress, aRequest, aFlags, aStatus) => {
        if ((aFlags & Ci.nsIWebProgressListener.STATE_STOP) === Ci.nsIWebProgressListener.STATE_STOP) { // eslint-disable-line no-bitwise
          this.adjustCrop();
          for (let tab of this.window.gBrowser.visibleTabs) {
            if (tab.linkedBrowser === aBrowser && tab.refreshThumbAndLabel) {
              tab.refreshThumbAndLabel();
            }
          }
        }
      }
    };
    window.gBrowser.addTabsProgressListener(tabsProgressListener);

    window.addEventListener('animationend', (e) => {
      let tab = e.target;
      if (e.animationName === 'slide-fade-in') {
        tab.classList.remove('tab-visible');
      } else if (e.animationName === 'fade-out') {
        let tabStack = this.document.getAnonymousElementByAttribute(tab, 'class', 'tab-stack');
        tabStack.collapsed = true; //there is a visual jump if we do not collapse the tab before the end of the animation
      } else if (e.animationName === 'slide-out') {
        this._endRemoveTab.bind(this.window.gBrowser)(tab);
        this.resizeTabs();
      }
    });

    window.gBrowser._endRemoveTab = (aTab) => {
      window.gBrowser._blurTab(aTab);
      aTab.classList.add('tab-hidden');
    };

    window.gBrowser.receiveMessage = (...args) => {
      if (args[0].target.getAttribute('anonid') === 'initialBrowser' && args[0].name === 'Browser:WindowCreated' && Services.prefs.getIntPref('browser.startup.page') !== 3) {
        let tab = window.gBrowser.getTabForBrowser(window.gBrowser.selectedBrowser);
        while (tab.getAttribute('pinned') === 'true') {
          tab = tab.nextSibling;
        }
        window.gBrowser.selectedTab = tab;
      }
      this.receiveMessage.bind(window.gBrowser)(...args);
    };

    window.gBrowser.tabContainer.addEventListener('TabBarUpdated', () => {
      this.clearFind('tabGroupChange');
    });

    window.ToolbarIconColor.inferFromText = () => {
      this.inferFromText.bind(window.ToolbarIconColor)();
      //use default inferFromText, then set main-window[brighttext] according to the results
      if (document.getElementById('nav-bar').getAttribute('brighttext') === 'true') {
        mainWindow.setAttribute('brighttext', 'true');
      } else {
        mainWindow.removeAttribute('brighttext');
      }
    };

    this.thumbTimer = this.window.setInterval(() => {
      tabs.selectedItem.refreshThumbAndLabel();
    }, 1000);

    this.unloaders.push(function () {
      if (this.thumbTimer) {
        this.window.clearInterval(this.thumbTimer);
        this.thumbTimer = null;
      }
      this.window.gBrowser.removeTabsProgressListener(tabsProgressListener);

      this.window.ToolbarIconColor.inferFromText = this.inferFromText;
      this.window.gBrowser._endRemoveTab = this._endRemoveTab;
      this.window.gBrowser.receiveMessage = this.receiveMessage;
      this.window.PrintPreviewListener.onEnter = OldPrintPreviewListenerEnter;
      this.window.PrintPreviewListener.onExit = OldPrintPreviewListenerExit;
      this.window.gBrowser.moveTabTo = oldMoveTabTo;
      this.window.gBrowser.pintab = oldPinTab;
      this.window.gBrowser.addTab = oldAddTab;
      this.window.gBrowser.getTabsToTheEndFrom = oldGetTabsToTheEndFrom;
      window.gBrowser.warnAboutClosingTabs = oldWarnAboutClosingTabs;
      if (this.document.getElementById('top-tabs-button')){
        this.document.getElementById('TabsToolbar').removeChild(this.document.getElementById('top-tabs-button'));
      }
      close_next_tabs_message.setAttribute('label', previous_close_message);
      require('sdk/simple-prefs').removeListener('opentabstop', reverseTabsListener);
    });

    this.rearrangeXUL();

    let results = this.document.getElementById('PopupAutoCompleteRichResult');

    if (results) {
      results.removeAttribute('width');
    }
    this.tabObserver = new this.document.defaultView.MutationObserver((mutations) => {
      this.tabObserver.disconnect();
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' &&
                   mutation.target.id === 'PopupAutoCompleteRichResult' &&
                   mutation.attributeName === 'width') {
          results.removeAttribute('width');
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'overflow' && mutation.target.id === 'tabbrowser-tabs') {
          if (mutation.target.getAttribute('overflow') !== 'true') {
            tabs.setAttribute('overflow', 'true'); //always set overflow back to true
          }
        }
      });
      this.tabObserver.observe(tabs, {childList: true, attributes: true, subtree: true});
      if (results) {
        this.tabObserver.observe(results, {attributes: true});
      }
    });
    this.tabObserver.observe(tabs, {childList: true, attributes: true, subtree: true});
    if (results) {
      this.tabObserver.observe(results, {attributes: true});
    }

    window.TabsInTitlebar.allowedBy('tabcenter', false);

    this.unloaders.push(function () {
      this.tabObserver.disconnect();
    });
  },

  rearrangeXUL: function () {
    const window = this.window;
    const document = this.document;

    // Move the bottom stuff (findbar, addonbar, etc.) in with the
    // tabbrowser.  That way it will share the same (horizontal)
    // space as the brower.  In other words, the bottom stuff no
    // longer extends across the whole bottom of the window.
    let mainWindow = document.getElementById('main-window');
    let contentbox = document.getElementById('appcontent');
    let bottom = document.getElementById('browser-bottombox');
    contentbox.appendChild(bottom);
    let top = document.getElementById('navigator-toolbox');
    let browserPanel = document.getElementById('browser-panel');
    let autocomplete = document.getElementById('PopupAutoCompleteRichResult');
    let autocompleteOpen = autocomplete._openAutocompletePopup;
    autocomplete._openAutocompletePopup = (aInput, aElement) => {
      autocompleteOpen.bind(autocomplete)(aInput, aElement);
      let rect = window.document.documentElement.getBoundingClientRect();
      let popupDirection = autocomplete.style.direction;
      let sidebar = document.getElementById('sidebar-box');

      // Make the popup's starting margin negative so that the leading edge
      // of the popup aligns with the window border.
      let elementRect = aElement.getBoundingClientRect();
      if (popupDirection === 'rtl') {
        let offset = elementRect.right - rect.right;
        let width = rect.width;
        autocomplete.style.marginRight = offset + 'px';
        autocomplete.style.width = width + 'px';
      } else {
        let offset = rect.left - elementRect.left;
        let width = rect.width;
        if (mainWindow.getAttribute('F11-fullscreen') !== 'true') {
          if (mainWindow.getAttribute('tabspinned') !== 'true') {
            offset += 45;
            width -= 45;
          } else {
            offset += this.pinnedWidth;
            width -= this.pinnedWidth;
          }
        }
        if (sidebar.getAttribute('hidden') !== 'true') {
          offset += sidebar.getBoundingClientRect().width;
          width -= sidebar.getBoundingClientRect().width;
        }
        autocomplete.style.marginLeft = offset + 'px';
        autocomplete.style.width = width + 'px';
      }
    };

    // save the label of the first tab, the toolbox palette, and the url for later…
    let tabs = document.getElementById('tabbrowser-tabs');
    let label = tabs.firstChild.label;
    let palette = top.palette;
    let urlbar = document.getElementById('urlbar');
    let url = urlbar.value;
    let activeTab = window.gBrowser.mCurrentTab;

    // Save the position of the tabs in the toolbar, for later restoring.
    let toolbar = document.getElementById('TabsToolbar');
    let tabsIndex = 0;
    for (let i = 0; i < toolbar.children.length; i++) {
      if (toolbar.children[i] === tabs) {
        tabsIndex = i;
        break;
      }
    }

    let NewTabButton = toolbar.querySelector('#new-tab-button') || CustomizableUI.getWidget('new-tab-button').forWindow(this.window).node;
    //if new tab button is not in toolbar, find it and insert it.
    if (!toolbar.querySelector('#new-tab-button')) {
      //save position of button for restoring later
      let NewTabButtonParent = NewTabButton.parentNode;
      let NewTabButtonSibling = NewTabButton.nextSibling;
      toolbar.insertBefore(NewTabButton, toolbar.firstChild);

      this.unloaders.push(function () {
        // put the newTab button back where it belongs
        NewTabButtonParent.insertBefore(NewTabButton, NewTabButtonSibling);
      });
    }

    contentbox.insertBefore(top, contentbox.firstChild);

    // Create a box next to the app content. It will hold the tab
    // bar and the tab toolbar.
    let browserbox = document.getElementById('browser');
    let leftbox = utils.createElement(document, 'vbox', {'id': 'verticaltabs-box'});
    let splitter = utils.createElement(document, 'vbox', {'id': 'verticaltabs-splitter'});

    if (mainWindow.getAttribute('tabspinned') === '') {
      mainWindow.setAttribute('tabspinned', 'true');
      leftbox.setAttribute('expanded', 'true');
    }

    browserbox.insertBefore(leftbox, contentbox);
    browserbox.insertBefore(splitter, browserbox.firstChild);

    this.pinnedWidth = +mainWindow.getAttribute('tabspinnedwidth').replace('px', '') ||
                       +window.getComputedStyle(document.documentElement)
                              .getPropertyValue('--pinned-width').replace('px', '');
    document.documentElement.style.setProperty('--pinned-width', `${this.pinnedWidth}px`);

    splitter.addEventListener('mousedown', (event) => {
      if (event.which !== 1) {
        return;
      }
      if (this.pinnedWidth > document.width / 2) {
        this.pinnedWidth = document.width / 2;
      }
      let initialX = event.screenX - this.pinnedWidth;
      let mousemove = (event) => {
        let xDelta = event.screenX - initialX;
        this.pinnedWidth = Math.min(xDelta, document.width / 2);
        if (this.pinnedWidth < 30) {
          this.pinnedWidth = 30;
        }
        document.documentElement.style.setProperty('--pinned-width', `${this.pinnedWidth}px`);
        mainWindow.setAttribute('tabspinnedwidth', `${this.pinnedWidth}px`);
        ss.setWindowValue(window, 'TCtabspinnedwidth', mainWindow.getAttribute('tabspinnedwidth'));
        this.resizeFindInput();
        this.resizeTabs();
      };

      let mouseup = (event) => {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
      };

      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
    });

    // Move the tabs next to the app content, make them vertical,
    // and restore their width from previous session
    tabs.setAttribute('vertical', true);
    tabs.setAttribute('overflow', 'true');
    leftbox.insertBefore(tabs, leftbox.firstChild);
    //remove extra #newtab-popup before they get added again in the tabs constructor
    if (NewTabButton) {
      while (NewTabButton.children.length > 1) {
        NewTabButton.firstChild.remove();
      }
    }
    tabs.orient = 'vertical';
    tabs.mTabstrip.orient = 'vertical';
    tabs.tabbox.orient = 'horizontal'; // probably not necessary

    // And restore the label, palette and url here.
    tabs.firstChild.label = label;
    top.palette = palette;
    urlbar.value = url;
    window.gBrowser.tabContainer.selectedIndex = tabs.getIndexOfItem(activeTab);

    // Move the tabs toolbar into the tab strip
    toolbar.setAttribute('collapsed', 'false'); // no more vanishing new tab toolbar
    toolbar._toolbox = null; // reset value set by constructor
    toolbar.setAttribute('toolboxid', 'navigator-toolbox');

    let pin_button = utils.createElement(document, 'toolbarbutton', {
      'id': 'pin-button'
    });

    pin_button.onclick = function (event) {
      if (event.which !== 1) {
        return;
      }
      let newstate = mainWindow.getAttribute('tabspinned') === 'true' ? 'false' : 'true';
      mainWindow.setAttribute('tabspinned', newstate);
      ss.setWindowValue(window, 'TCtabspinned', newstate);
      if (newstate === 'true') {
        window.VerticalTabs.sendPing('tab_center_pinned', window);
        pin_button.setAttribute('tooltiptext', `${strings.sidebarShrink}`);
      } else {
        window.VerticalTabs.sendPing('tab_center_unpinned', window);
        pin_button.setAttribute('tooltiptext', `${strings.sidebarOpen}`);
        document.getElementById('verticaltabs-box').removeAttribute('search_expanded');
      }
      window.VerticalTabs.resizeFindInput();
      window.VerticalTabs.resizeTabs();
    };

    let tooltiptext = mainWindow.getAttribute('tabspinned') === 'true' ? strings.sidebarShrink : strings.sidebarOpen;
    pin_button.setAttribute('tooltiptext', tooltiptext);

    toolbar.appendChild(pin_button);
    leftbox.insertBefore(toolbar, leftbox.firstChild);
    let find_input = utils.createElement(document, 'textbox', {
      'id': 'find-input',
      'class': 'searchbar-textbox'
    });
    let search_icon = utils.createElement(document, 'image', {
      'id': 'tabs-search'
    });
    find_input.appendChild(search_icon);
    search_icon.addEventListener('click', function (e) {
      find_input.focus();
    });
    find_input.addEventListener('input', this.filtertabs.bind(this));
    this.window.addEventListener('keyup', (e) => {
      if(e.keyCode === 27) {
        this.clearFind();
      }
    });

    //build button to toggle Tab Center on/off
    let toptabsbutton = utils.createElement(document, 'toolbarbutton', {
      'id': 'top-tabs-button',
      'label': strings.topLabel,
      'tooltiptext': strings.topTooltip
    });
    toptabsbutton.onclick = (e) => {
      if (e.which !== 1) {
        return;
      }
      mainWindow.setAttribute('toggledon', 'false');
      set('extensions.tabcentertest1@mozilla.com.lastUsedTimestamp', Date.now().toString());
      ss.setWindowValue(window, 'TCtoggledon', mainWindow.getAttribute('toggledon'));
      window.VerticalTabs.sendPing('tab_center_toggled_off', window);
      this.init();
    };

    leftbox.contextMenuOpen = false;
    let contextMenuHidden = (event) => {
      //don't catch close events from tooltips
      if (event.originalTarget.tagName === 'xul:menupopup' || event.originalTarget.tagName === 'menupopup') {
        leftbox.contextMenuOpen = false;
        // give user time to move mouse back in after closing context menu,
        // also allow for event to finish before checking for this.mouseInside
        window.setTimeout(() => {
          exit();
        }, 200);
      }
    };

    document.addEventListener('popuphidden', contextMenuHidden);
    leftbox.addEventListener('contextmenu', function (event) {
      if (event.target.tagName === 'tab' || event.target.id === 'new-tab-button' || event.target.id === 'pin-button' || event.target.id === 'find-input') {
        this.contextMenuOpen = true;
      }
    });

    document.getElementById('filler-tab').addEventListener('click', this.clearFind.bind(this));

    let spacer = utils.createElement(document, 'spacer', {'id': 'new-tab-spacer'});
    toolbar.insertBefore(find_input, pin_button);
    toolbar.insertBefore(spacer, pin_button);
    toolbar.insertBefore(toptabsbutton, toolbar.lastChild);

    this.resizeFindInput();

    //remove option to movetopanel or removefromtoolbar from the new-tab-button
    let oldOnViewToolbarsPopupShowing = window.onViewToolbarsPopupShowing;
    window.onViewToolbarsPopupShowing = function (aEvent, aInsertPoint) {
      oldOnViewToolbarsPopupShowing(aEvent, aInsertPoint);
      if (aEvent.explicitOriginalTarget.id === 'new-tab-button') {
        aEvent.target.querySelector('.customize-context-moveToPanel').setAttribute('disabled', true);
        aEvent.target.querySelector('.customize-context-removeFromToolbar').setAttribute('disabled', true);
      }
    };

    let enterTimeout = -1;

    let exit = (event) => {
      if (!this.mouseInside) {
        let arrowscrollbox = this.document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
        let scrollbox = this.document.getAnonymousElementByAttribute(arrowscrollbox, 'anonid', 'scrollbox');
        let scrolltop = scrollbox.scrollTop;

        if (enterTimeout > 0) {
          window.clearTimeout(enterTimeout);
          enterTimeout = -1;
        }
        if (mainWindow.getAttribute('tabspinned') !== 'true' && leftbox.getAttribute('search_expanded') !== 'true' && !leftbox.contextMenuOpen) {
          arrowscrollbox.skipNextScroll = true;
          leftbox.removeAttribute('expanded');
          this.clearFind();
          this.adjustCrop();
          let tabsPopup = document.getElementById('alltabs-popup');
          if (tabsPopup.state === 'open') {
            tabsPopup.hidePopup();
          }
        }

        tabs.removeAttribute('mouseInside');
        scrollbox.scrollTop = scrolltop;
      }
    };

    let enter = (event) => {
      let shouldExpand = tabs.getAttribute('mouseInside') !== 'true' &&
        leftbox.getAttribute('expanded') !== 'true';
      let arrowscrollbox = this.document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
      if (shouldExpand) {
        arrowscrollbox.skipNextScroll = true;
        this.recordExpansion();
        if (event.type === 'mouseenter') {
          enterTimeout = window.setTimeout(() => {
            leftbox.setAttribute('expanded', 'true');
            this.adjustCrop();
          }, 300);
        } else if (event.pageX <= 4) {
          if (enterTimeout > 0) {
            window.clearTimeout(enterTimeout);
            enterTimeout = -1;
          }
          leftbox.setAttribute('expanded', 'true');
          this.adjustCrop();
        }
      }
      this.mouseEntered();
    };


    let pauseBeforeExit = () => {
      this.mouseExited();
      window.setTimeout(() => {
        exit();
      }, 200);
    };

    tabs.ondragleave = function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest('#tabbrowser-tabs')) {
        if (tabs.getAttribute('movingtab') === 'true') {
          let scrollbox = document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
          let scrollbuttonDown = document.getAnonymousElementByAttribute(scrollbox, 'anonid', 'scrollbutton-down');
          let scrollbuttonUp = document.getAnonymousElementByAttribute(scrollbox, 'anonid', 'scrollbutton-up');
          scrollbuttonUp.onmouseout();
          scrollbuttonDown.onmouseout();
        }
      }
    };

    leftbox.addEventListener('mouseenter', enter);
    leftbox.addEventListener('mousemove', enter);
    leftbox.addEventListener('mouseleave', pauseBeforeExit);
    leftbox.addEventListener('mousedown', (event) => {
      // Don't register clicks on stuff in the leftbar if it's not open.
      if (event.mozInputSource === Ci.nsIDOMMouseEvent.MOZ_SOURCE_TOUCH &&
          leftbox.getAttribute('expanded') !== 'true') {
        event.stopPropagation();
      }
    }, true);

    let oldUpdateToolbars = window.FullScreen._updateToolbars;
    window.FullScreen._updateToolbars = (aEnterFS) => {
      oldUpdateToolbars.bind(window.FullScreen)(aEnterFS);
      let fullscreenctls = document.getElementById('window-controls');
      let navbar = document.getElementById('nav-bar');
      let toggler = document.getElementById('fullscr-toggler');
      let sibling = document.getElementById('navigator-toolbox').nextSibling;

      if (aEnterFS && fullscreenctls.parentNode.id === 'TabsToolbar') {
        navbar.appendChild(fullscreenctls);
        toggler.removeAttribute('hidden');
        //hidden nav toolbox needs to be moved 1 pix higher to account for the toggler every time it hides
        window.gNavToolbox.style.marginTop = (-window.gNavToolbox.getBoundingClientRect().height - 1) + 'px';
        document.getElementById('appcontent').insertBefore(toggler, sibling);
        mainWindow.setAttribute('F11-fullscreen', 'true');
      } else {
        mainWindow.removeAttribute('F11-fullscreen');
      }
    };

    tabs.addEventListener('TabOpen', this, false);
    tabs.addEventListener('TabClose', this, false);
    window.setTimeout(() => {
      if (mainWindow.getAttribute('tabspinned') === 'true') {
        leftbox.setAttribute('expanded', 'true');
      }
      for (let i = 0; i < tabs.childNodes.length; i++) {
        this.initTab(tabs.childNodes[i]);
      }
    }, 150);

    function checkDevTheme() {
      if (/devedition/.test(mainWindow.style.backgroundImage)) {
        mainWindow.setAttribute('devedition-theme', 'true');
      } else {
        mainWindow.removeAttribute('devedition-theme');
      }
    }
    checkDevTheme();

    let beforeListener = function () {
      browserPanel.insertBefore(top, browserPanel.firstChild);
      browserPanel.insertBefore(bottom, document.getElementById('fullscreen-warning').nextSibling);
      top.palette = palette;
    };
    window.addEventListener('beforecustomization', beforeListener);

    let changeListener = () => {
      setDefaultPrefs();
    };
    window.addEventListener('customizationchange', changeListener);

    let afterListener = function () {
      contentbox.insertBefore(top, contentbox.firstChild);
      contentbox.appendChild(bottom);
      top.palette = palette;
      checkDevTheme();
      //query for and restore the urlbar value after customize mode does things....
      urlbar.value = window.gBrowser.mCurrentTab.linkedBrowser.currentURI.spec;
    };
    window.addEventListener('aftercustomization', afterListener);

    let resizeListener = () => {
      this.resizeTabs();
      document.documentElement.style.setProperty('--pinned-width', `${Math.min(this.pinnedWidth, document.width / 2)}px`);
      ss.setWindowValue(window, 'TCtabspinnedwidth', mainWindow.getAttribute('tabspinnedwidth'));
    };
    window.addEventListener('resize', resizeListener);
    this.adjustCrop();
    window.gBrowser.selectedTab.scrollIntoView();

    this.unloaders.push(function () {
      autocomplete._openAutocompletePopup = autocompleteOpen;
      window.FullScreen._updateToolbars = oldUpdateToolbars;

      // Move the tabs toolbar back to where it was
      toolbar._toolbox = null; // reset value set by constructor
      toolbar.removeAttribute('toolboxid');
      toolbar.removeAttribute('collapsed');
      toolbar.removeChild(spacer);
      toolbar.removeChild(find_input);
      toolbar.removeChild(pin_button);
      let toolbox = document.getElementById('navigator-toolbox');
      let navbar = document.getElementById('nav-bar');
      let browserPanel = document.getElementById('browser-panel');

      //remove customization event listeners which move the toolbox
      window.removeEventListener('beforecustomization', beforeListener);
      window.removeEventListener('customizationchange', changeListener);
      window.removeEventListener('aftercustomization', afterListener);
      window.removeEventListener('resize', resizeListener);
      document.removeEventListener('popuphidden', contextMenuHidden);

      //restore the changed menu items
      window.onViewToolbarsPopupShowing = oldOnViewToolbarsPopupShowing;

      // Put the tabs back up top
      tabs.orient = 'horizontal';
      tabs.mTabstrip.orient = 'horizontal';
      tabs.tabbox.orient = 'vertical'; // probably not necessary
      tabs.removeAttribute('width');
      tabs.removeEventListener('TabOpen', this, false);
      tabs.removeEventListener('TabClose', this, false);

      //save the first tab's label to restore after unbinding/binding
      label = tabs.firstChild.label;
      activeTab = window.gBrowser.mCurrentTab;
      tabs.removeAttribute('vertical');

      window.gBrowser.tabContainer.selectedIndex = tabs.getIndexOfItem(activeTab);

      // Restore all individual tabs.
      for (let i = 0; i < tabs.childNodes.length; i++) {
        let tab = tabs.childNodes[i];
        tab.setAttribute('crop', 'end');
      }

      // Remove all the crap we added.
      browserbox.removeChild(leftbox);
      browserbox.removeChild(splitter);
      browserbox.removeAttribute('dir');
      leftbox = null;

      // Restore the tab strip.
      toolbar.insertBefore(tabs, toolbar.children[tabsIndex]);
      navbar.parentNode.insertBefore(toolbar, navbar);
      browserPanel.insertBefore(toolbox, browserPanel.firstChild);
      //remove extra #newtab-popup before they get added again in the tabs constructor
      if (NewTabButton) {
        while (NewTabButton.children.length > 1) {
          NewTabButton.firstChild.remove();
        }
      }
      browserPanel.insertBefore(bottom, document.getElementById('fullscreen-warning').nextSibling);
      top.palette = palette;
      tabs.firstChild.label = label;
      this.window.TabsInTitlebar.updateAppearance(true);
    });
  },

  numPinnedtabs: function () {
    let numPinned = 0 ;
    for (let i = 0; i < this.window.gBrowser.tabs.length; i++) {
      if (!this.window.gBrowser.tabs[i].pinned) {
        continue;
      }
      numPinned += 1;
    }
    return numPinned;
  },

  reverseTabs: function (arrowscrollbox) {
    let window = this.window;
    let document = this.document;
    let tabs = document.getElementById('tabbrowser-tabs');
    let close_next_tabs_message = document.getElementById('context_closeTabsToTheEnd');
    if (prefs.opentabstop && document.getElementById('main-window').getAttribute('toggledon') === 'true') {
      close_next_tabs_message.setAttribute('label', strings.closeTabsAbove);
      arrowscrollbox._isRTLScrollbox = true;
      tabs.setAttribute('opentabstop', 'true');
      let i = window.gBrowser.tabs.length - 1;
      while (window.gBrowser.tabs[0].pinned && i >= 0) {
        window.gBrowser.moveTabTo(window.gBrowser.tabs[0], i);
        i--;
      }
    } else {
      close_next_tabs_message.setAttribute('label', strings.closeTabsBelow);
      arrowscrollbox._isRTLScrollbox = false;
      tabs.removeAttribute('opentabstop');
      window.gBrowser.tabs.forEach(function (tab) {
        if (tab.pinned) {
          window.gBrowser.moveTabTo(tab, 0);
        }
      });
    }
  },

  recordExpansion: function () {
    this.sendPing('tab_center_expanded', this.window);
  },

  adjustCrop: function () {
    let tabs = this.document.getElementById('tabbrowser-tabs');
    if (this.window.document.getElementById('verticaltabs-box').getAttribute('expanded') === 'true' || this.document.getElementById('main-window').getAttribute('tabspinned') === '') {
      for (let i = 0; i < tabs.childNodes.length; i++) {
        tabs.childNodes[i].setAttribute('crop', 'end');
      }
    } else {
      for (let i = 0; i < tabs.childNodes.length; i++) {
        tabs.childNodes[i].removeAttribute('crop');
      }
    }
  },

  resizeFindInput: function () {
    let spacer = this.document.getElementById('new-tab-spacer');
    let find_input = this.document.getElementById('find-input');
    if (this.pinnedWidth > 170 || this.document.getElementById('main-window').getAttribute('tabspinned') !== 'true') {
      spacer.style.visibility = 'collapse';
      find_input.style.visibility = 'visible';
    } else {
      find_input.style.visibility = 'collapse';
      spacer.style.visibility = 'visible';
    }
  },

  clearFind: function (purpose) {
    let find_input = this.document.getElementById('find-input');
    if (find_input) {
      if (purpose === 'tabGroupChange') {
        //manually show pinned tabs after changing groups for the tab groups add-on, as it does not re-show them
        Array.filter(this.window.gBrowser.tabs, tab => tab.getAttribute('pinned') === 'true').forEach(tab => {tab.setAttribute('hidden', false);});
        this.visibleTabs = Array.filter(this.window.gBrowser.tabs, tab => !tab.hidden && !tab.closing);
        find_input.value = '';
        this.filtertabs();
      } else if (purpose === 'tabAction') {
        if (find_input.value === '') {
          this.resizeTabs();
          return;
        }
        find_input.value = '';
        this.filtertabs();
        this.visibleTabs = null;
      } else {
        find_input.value = '';
        this.filtertabs();
      }
    }
  },

  delayResizeTabs: function (delay) {
    if (delay < 0) {
      delay = 0;
    }

    if (this.resizeTimeout) {
      return;
    }

    this.resizeTimeout = this.window.setTimeout(() => this.actuallyResizeTabs(), delay);
  },

  cancelResizeTabs: function () {
    if (this.resizeTimeout) {
      this.window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = 0;
    }
  },

  filtertabs: function () {
    let document = this.document;
    this.visibleTabs = this.visibleTabs || Array.filter(this.window.gBrowser.tabs, tab => !tab.hidden && !tab.closing);
    let find_input = document.getElementById('find-input');
    let input_value = find_input.value.toLowerCase();
    let hidden_counter = 0;
    let hidden_tab = document.getElementById('filler-tab');
    let hidden_tab_label = hidden_tab.firstChild;

    for (let i = 0; i < this.visibleTabs.length; i++) {
      let tab = this.visibleTabs[i];
      if ((tab.label || '').toLowerCase().match(input_value) || this.getUri(tab).spec.toLowerCase().match(input_value)) {
        tab.setAttribute('hidden', false);
      } else {
        hidden_counter += 1;
        tab.setAttribute('hidden', true);
      }
    }
    if (hidden_counter > 0) {
      hidden_tab_label.setAttribute('value', strings.moreTabs(hidden_counter));
      hidden_tab.removeAttribute('hidden');
    } else {
      hidden_tab.setAttribute('hidden', 'true');
    }
    this.delayResizeTabs(0);
  },

  getUri: function (tab) {
    // Strips out the `wyciwyg://` from internal URIs
    return createExposableURI(tab.linkedBrowser.currentURI);
  },

  initTab: function (aTab) {
    let document = this.document;
    this.clearFind('tabAction');
    aTab.classList.remove('tab-hidden');

    if (document.getElementById('tabbrowser-tabs').getAttribute('expanded') !== 'true' && document.getElementById('main-window').getAttribute('tabspinned') !== 'true') {
      aTab.removeAttribute('crop');
    } else {
      aTab.setAttribute('crop', 'end');
    }
  },

  unload: function () {
    let window = this.window;
    let tourPanel = this.document.getElementById('tour-panel');
    if (tourPanel) {
      this.document.getElementById('mainPopupSet').removeChild(tourPanel);
    }
    let urlbar = this.document.getElementById('urlbar');
    let url = urlbar.value;
    let tabs = this.document.getElementById('tabbrowser-tabs');

    if (prefs.opentabstop && this.document.getElementById('main-window').getAttribute('toggledon') === 'false' && tabs.getAttribute('opentabstop')) {
      tabs.removeAttribute('opentabstop');
      window.gBrowser.tabs.forEach(function (tab) {
        if (tab.pinned) {
          window.gBrowser.moveTabTo(tab, 0);
        }
      });
    }

    this.unloaders.forEach(function (func) {
      func.call(this);
    }, this);
    this.unloaders = [];

    urlbar.value = url;
    if (tabs) {
      tabs.removeAttribute('overflow'); //not needed? it sets its own overflow as necessary
      tabs._positionPinnedTabs(); //Does not do anything?
    }
    removeStylesheets(window);
    window.TabsInTitlebar.allowedBy('tabcenter', true);
  },

  actuallyResizeTabs: function () {
    this.cancelResizeTabs();
    let tabs = this.document.getElementById('tabbrowser-tabs');
    switch (prefs.largetabs) {
    case 0:
      tabs.classList.remove('large-tabs');
      return;
    case 1: {
      let tabbrowser_height = tabs.clientHeight;
      let number_of_tabs = this.window.gBrowser.visibleTabs.length;
      if (tabbrowser_height / number_of_tabs >= 58 && this.pinnedWidth > 60 && tabs.classList.contains('large-tabs')) {
        return;
      } else if (tabbrowser_height / number_of_tabs >= 58 && this.pinnedWidth > 60 ) {
        tabs.classList.add('large-tabs');
        this.refreshAllTabs();
      } else if (tabs.classList.contains('large-tabs')) {
        tabs.classList.remove('large-tabs');
      }
      return;
    }
    case 2:
      tabs.classList.add('large-tabs');
      return;
    }
  },

  refreshAllTabs: function () {
    for (let tab of this.window.gBrowser.visibleTabs) {
      tab.refreshThumbAndLabel();
    }
  },

  resizeTabs: function () {
    if (!this.mouseInside) {
      // If the mouse is outside the tab area,
      // resize immediately after the current script ends.
      this.delayResizeTabs(0);
    }
  },

  mouseEntered: function () {
    let tabs = this.document.getElementById('tabbrowser-tabs');
    this.cancelResizeTabs();
    this.mouseInside = true;
    let arrowscrollbox = this.document.getAnonymousElementByAttribute(tabs, 'anonid', 'arrowscrollbox');
    let scrollbox = this.document.getAnonymousElementByAttribute(arrowscrollbox, 'anonid', 'scrollbox');
    let scrolltop = scrollbox.scrollTop;

    tabs.setAttribute('mouseInside', 'true');
    scrollbox.scrollTop = scrolltop;
  },

  mouseExited: function () {
    this.mouseInside = false;

    // Once the mouse exits the tab area, wait
    // a bit before resizing.
    this.delayResizeTabs(WAIT_BEFORE_RESIZE);
  },

  /*** Event handlers ***/

  handleEvent: function (aEvent) {
    switch (aEvent.type) {
    case 'DOMContentLoaded':
      this.init();
      return;
    case 'TabOpen':
      this.onTabOpen(aEvent);
      return;
    case 'TabClose':
      this.onTabClose(aEvent);
      return;
    }
  },

  onTabOpen: function (aEvent) {
    let tab = aEvent.target;
    tab.classList.add('tab-visible');
    this.initTab(tab);
  },

  onTabClose: function (aEvent) {
    this.clearFind('tabAction');
  },
};

exports.addVerticalTabs = (win, data) => {
  if (!win.VerticalTabs) {
    new VerticalTabs(win, data);
  }
};
