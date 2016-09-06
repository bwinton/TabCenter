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

/* global require, exports:false, PageThumbs:false, CustomizableUI:false */
'use strict';

const {Cc, Ci, Cu} = require('chrome');
const {emit} = require('sdk/dom/events');
const {platform} = require('sdk/system');
const {prefs} = require('sdk/simple-prefs');
const {addPingStats, Stats, setDefaultPrefs} = require('./utils');
const {createExposableURI} = Cc['@mozilla.org/docshell/urifixup;1'].
                               createInstance(Ci.nsIURIFixup);

Cu.import('resource://gre/modules/PageThumbs.jsm');
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/Services.jsm');

//use to set preview image as metadata image 1/4
// Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

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
  this.unloaders = [];
  this.stats = new Stats;
  this.resizeTimeout = -1;
  this.mouseInside = false;

  window.createImageBitmap(data).then((response) => {
    this.newTabImage = response;
  });

  this.init();
}
VerticalTabs.prototype = {

  init: function () {
    this.window.VerticalTabs = this;
    this.PageThumbs = PageThumbs;
    this._endRemoveTab = this.window.gBrowser._endRemoveTab;
    this.inferFromText = this.window.ToolbarIconColor.inferFromText;
    let window = this.window;
    let document = this.document;

    let oldAddTab = window.gBrowser.addTab;
    window.gBrowser.addTab = function (...args) {
      let t = oldAddTab.bind(window.gBrowser)(...args);
      if (prefs.opentabstop) {
        let aRelatedToCurrent;
        let aReferrerURI;
        if (arguments.length === 2 && typeof arguments[1] === 'object' && !(arguments[1] instanceof Ci.nsIURI)) {
          let params = arguments[1];
          aReferrerURI = params.referrerURI;
          aRelatedToCurrent = params.relatedToCurrent;
        }
        if ((aRelatedToCurrent == null ? aReferrerURI : aRelatedToCurrent) &&
          Services.prefs.getBoolPref('browser.tabs.insertRelatedAfterCurrent')) {
          let newTabPos = (this._lastRelatedTab || this.selectedTab)._tPos - 1;
          this.moveTabTo(t, newTabPos);
          this._lastRelatedTab = t;
        } else {
          this.moveTabTo(t, 0);
        }
      }
      return t;
    };

    //reset _lastRelatedTab on changing preferences
    require('sdk/simple-prefs').on('opentabstop', function () {
      window.gBrowser._lastRelatedTab = null;
    });

    let tabs = document.getElementById('tabbrowser-tabs');
    let tabsProgressListener = {
      onLocationChange: (aBrowser, aWebProgress, aRequest, aLocation, aFlags) => {
        for (let tab of tabs.childNodes) {
          if (tab.linkedBrowser === aBrowser) {
            tab.refreshThumbAndLabel();
          }
        }
      },
      onStateChange: (aBrowser, aWebProgress, aRequest, aFlags, aStatus) => {
        if ((aFlags & Ci.nsIWebProgressListener.STATE_STOP) === Ci.nsIWebProgressListener.STATE_STOP) { // eslint-disable-line no-bitwise
          for (let tab of tabs.childNodes) {
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
      aTab.classList.add('tab-hidden');
    };

    window.ToolbarIconColor.inferFromText = function () {
      if (!this._initialized){
        return;
      }

      function parseRGB(aColorString) {
        let rgb = aColorString.match(/^rgba?\((\d+), (\d+), (\d+)/);
        rgb.shift();
        return rgb.map(x => parseInt(x));
      }

      let toolbarSelector = '#verticaltabs-box, #verticaltabs-box > toolbar:not([collapsed=true]):not(#addon-bar), #navigator-toolbox > toolbar:not([collapsed=true]):not(#addon-bar)';
      if (platform === 'macosx') {
        toolbarSelector += ':not([type=menubar])';
      }
      // The getComputedStyle calls and setting the brighttext are separated in
      // two loops to avoid flushing layout and making it dirty repeatedly.

      let luminances = new Map;
      for (let toolbar of document.querySelectorAll(toolbarSelector)) {
        let [r, g, b] = parseRGB(window.getComputedStyle(toolbar).color);
        let luminance = 0.2125 * r + 0.7154 * g + 0.0721 * b;
        luminances.set(toolbar, luminance);
      }

      for (let [toolbar, luminance] of luminances) {
        if (luminance <= 110) {
          toolbar.removeAttribute('brighttext');
        } else {
          toolbar.setAttribute('brighttext', 'true');
        }
      }

      let mainWindow = document.getElementById('main-window');

      if (/devedition/.test(mainWindow.style.backgroundImage)) {
        mainWindow.setAttribute('devedition-theme', 'true');
      } else {
        mainWindow.removeAttribute('devedition-theme');
      }

    }.bind(this.window.ToolbarIconColor);

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
      this.window.gBrowser.addTab = oldAddTab;
    });
    this.window.onunload = () => {
      addPingStats(this.stats);
    };

    this.rearrangeXUL();

    let results = this.document.getElementById('PopupAutoCompleteRichResult');
    let leftbox = this.document.getElementById('verticaltabs-box');

    if (results) {
      results.removeAttribute('width');
    }
    this.tabObserver = new this.document.defaultView.MutationObserver((mutations) => {
      this.tabObserver.disconnect();
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' &&
            mutation.target.localName === 'tab') {
          let tab = mutation.target;
          if (mutation.attributeName === 'crop' && leftbox.getAttribute('expanded') !== 'true') {
            tab.removeAttribute('crop');
          }
        } else if (mutation.type === 'attributes' &&
                   mutation.target.id === 'PopupAutoCompleteRichResult' &&
                   mutation.attributeName === 'width') {
          results.removeAttribute('width');
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'overflow' && mutation.target.id === 'tabbrowser-tabs') {
          if (mutation.target.getAttribute('overflow') !== 'true'){
            tabs.setAttribute('overflow', 'true'); //always set overflow back to true
          }
        } else if (mutation.type === 'childList' &&
            leftbox.getAttribute('expanded') !== 'true') {
          for (let node of mutation.addedNodes) {
            node.removeAttribute('crop');
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

    this.unloaders.push(function () {
      this.tabObserver.disconnect();
    });
  },

  createElement: function (label, attrs) {
    let rv = this.document.createElementNS(NS_XUL, label);
    if (attrs) {
      for (let attr in attrs) {
        rv.setAttribute(attr, attrs[attr]);
      }
    }
    return rv;
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
        if (mainWindow.getAttribute('tabspinned') !== 'true') {
          offset += 45;
          width -= 45;
        } else {
          offset += this.pinnedWidth;
          width -= this.pinnedWidth;
        }
        if (sidebar.getAttribute('hidden') !== 'true') {
          offset += sidebar.getBoundingClientRect().width;
          width -= sidebar.getBoundingClientRect().width;
        }
        autocomplete.style.marginLeft = offset + 'px';
        autocomplete.style.width = width + 'px';
      }
    };


    // save the label of the first tab, and the toolbox palette for later…
    let tabs = document.getElementById('tabbrowser-tabs');
    let label = tabs.firstChild.label;
    let palette = top.palette;

    // Save the position of the tabs in the toolbar, for later restoring.
    let toolbar = document.getElementById('TabsToolbar');
    let tabsIndex = 0;
    for (let i = 0; i < toolbar.children.length; i++) {
      if (toolbar.children[i] === tabs) {
        tabsIndex = i;
        break;
      }
    }

    //if new tab button is not in toolbar, find it and insert it.
    if (!toolbar.querySelector('#new-tab-button')) {
      //save position of button for restoring later
      let NewTabButton = CustomizableUI.getWidget('new-tab-button').forWindow(this.window).node;
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
    let leftbox = this.createElement('vbox', {'id': 'verticaltabs-box'});
    let splitter = this.createElement('vbox', {'id': 'verticaltabs-splitter'});
    browserbox.insertBefore(leftbox, contentbox);
    browserbox.insertBefore(splitter, browserbox.firstChild);
    mainWindow.setAttribute('persist',
      mainWindow.getAttribute('persist') + ' tabspinned tabspinnedwidth');

    this.pinnedWidth = +mainWindow.getAttribute('tabspinnedwidth').replace('px', '') ||
                       +window.getComputedStyle(document.documentElement)
                              .getPropertyValue('--pinned-width').replace('px', '');
    document.documentElement.style.setProperty('--pinned-width', `${this.pinnedWidth}px`);

    splitter.addEventListener('mousedown', (event) => {
      let initialX = event.screenX - this.pinnedWidth;
      let mousemove = (event) => {
        // event.preventDefault();
        let xDelta = event.screenX - initialX;
        this.pinnedWidth = xDelta;
        if (this.pinnedWidth < 30) {
          this.pinnedWidth = 30;
        }
        if (this.pinnedWidth > document.width / 2) {
          this.pinnedWidth = document.width / 2;
        }
        document.documentElement.style.setProperty('--pinned-width', `${this.pinnedWidth}px`);
        mainWindow.setAttribute('tabspinnedwidth', `${this.pinnedWidth}px`);
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
    leftbox.insertBefore(tabs, leftbox.firstChild);
    tabs.orient = 'vertical';
    tabs.mTabstrip.orient = 'vertical';
    tabs.tabbox.orient = 'horizontal'; // probably not necessary

    // And restore the label and palette here.
    tabs.firstChild.label = label;
    top.palette = palette;

    // Move the tabs toolbar into the tab strip
    toolbar.setAttribute('collapsed', 'false'); // no more vanishing new tab toolbar
    toolbar._toolbox = null; // reset value set by constructor
    toolbar.setAttribute('toolboxid', 'navigator-toolbox');

    let pin_button = this.createElement('toolbarbutton', {
      'id': 'pin-button',
      'tooltiptext': 'Keep sidebar open',
      'onclick': `let box = document.getElementById('main-window');
        let button = document.getElementById('pin-button');
        let newstate = box.getAttribute('tabspinned') == 'true' ? 'false' : 'true';
        box.setAttribute('tabspinned', newstate);
        if (newstate == 'true') {
          window.VerticalTabs.stats.tab_center_pinned++;
          button.setAttribute('tooltiptext', 'Shrink sidebar when not in use');
        } else {
          window.VerticalTabs.stats.tab_center_unpinned++;
          button.setAttribute('tooltiptext', 'Keep sidebar open');
          document.getElementById('verticaltabs-box').removeAttribute('search_expanded');
          document.getElementById('find-input').blur();
        }
        window.VerticalTabs.resizeFindInput();
        window.VerticalTabs.resizeTabs();
        `
    });

    toolbar.appendChild(pin_button);
    leftbox.insertBefore(toolbar, leftbox.firstChild);
    let find_input = this.createElement('textbox', {
      'id': 'find-input',
      'class': 'searchbar-textbox'
    });
    let search_icon = this.createElement('image', {
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

    leftbox.contextMenuOpen = false;
    let contextMenuHidden = (event) => {
      leftbox.contextMenuOpen = false;
      // give user time to move mouse back in after closing context menu,
      // also allow for event to finish before checking for this.mouseInside
      window.setTimeout(() => {
        if (!this.mouseInside) {
          exit();
        }
      }, 200);
    };

    document.addEventListener('popuphidden', contextMenuHidden);
    leftbox.addEventListener('contextmenu', function (event) {
      if (event.target.tagName === 'tab' || event.target.id === 'new-tab-button' || event.target.id === 'pin-button' || event.target.id === 'find-input') {
        this.contextMenuOpen = true;
      }
    });

    document.getElementById('filler-tab').addEventListener('click', this.clearFind.bind(this));

    let spacer = this.createElement('spacer', {'id': 'new-tab-spacer'});
    toolbar.insertBefore(find_input, pin_button);
    toolbar.insertBefore(spacer, pin_button);

    this.resizeFindInput();

    // change the text in the tab context box
    let close_next_tabs_message = document.getElementById('context_closeTabsToTheEnd');
    let previous_close_message = close_next_tabs_message.getAttribute('label');
    close_next_tabs_message.setAttribute('label', 'Close Tabs Below');

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
      this.mouseExited();
      if (enterTimeout > 0) {
        window.clearTimeout(enterTimeout);
        enterTimeout = -1;
      }
      if (mainWindow.getAttribute('tabspinned') !== 'true') {
        if (!leftbox.contextMenuOpen){
          leftbox.removeAttribute('expanded');
          this.clearFind();
        }
        let tabsPopup = document.getElementById('alltabs-popup');
        if (tabsPopup.state === 'open') {
          tabsPopup.hidePopup();
        }
      }
    };

    let enter = (event) => {
      this.mouseEntered();
      if (event.type === 'mouseenter' && leftbox.getAttribute('expanded') !== 'true') {
        this.stats.tab_center_expanded++;
        enterTimeout = window.setTimeout(() => {
          leftbox.setAttribute('expanded', 'true');
        }, 300);
      }
      if (event.pageX <= 4) {
        if (enterTimeout > 0) {
          window.clearTimeout(enterTimeout);
          enterTimeout = -1;
        }
        leftbox.setAttribute('expanded', 'true');
      }
      window.setTimeout(() => {
        for (let i = 0; i < tabs.childNodes.length; i++) {
          tabs.childNodes[i].setAttribute('crop', 'end');
        }
      }, 300);
    };

    leftbox.addEventListener('mouseenter', enter);
    leftbox.addEventListener('mousemove', enter);
    leftbox.addEventListener('mouseleave', exit);

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
        window.gNavToolbox.style.marginTop = (-window.gNavToolbox.getBoundingClientRect().height - 1) + 'px';
        document.getElementById('appcontent').insertBefore(toggler, sibling);
      }
    };

    //hidden nav toolbox needs to be moved 1 pix higher to account for the toggler every time it hides
    let oldHideNavToolbox = window.FullScreen.hideNavToolbox;
    window.FullScreen.hideNavToolbox = (aAnimate = false) => {
      oldHideNavToolbox.bind(window.FullScreen)(aAnimate);
      let toggler = document.getElementById('fullscr-toggler');
      toggler.removeAttribute('hidden');
      window.gNavToolbox.style.marginTop = (-window.gNavToolbox.getBoundingClientRect().height - 1) + 'px';
    };

    tabs.addEventListener('TabOpen', this, false);
    tabs.addEventListener('TabClose', this, false);
    tabs.addEventListener('TabPinned', this, false);
    tabs.addEventListener('TabUnpinned', this, false);
    window.setTimeout(() => {
      if (mainWindow.getAttribute('tabspinned') === 'true') {
        leftbox.setAttribute('expanded', 'true');
      }
      for (let i = 0; i < tabs.childNodes.length; i++) {
        this.initTab(tabs.childNodes[i]);
      }
    }, 150);

    let beforeListener = function () {
      browserPanel.insertBefore(top, browserPanel.firstChild);
      top.palette = palette;
    };
    window.addEventListener('beforecustomization', beforeListener);

    let changeListener = () => {
      setDefaultPrefs();
    };
    window.addEventListener('customizationchange', changeListener);

    let afterListener = function () {
      contentbox.insertBefore(top, contentbox.firstChild);
      top.palette = palette;
    };
    window.addEventListener('aftercustomization', afterListener);

    window.addEventListener('resize', this.resizeTabs.bind(this), false);

    this.unloaders.push(function () {
      autocomplete._openAutocompletePopup = autocompleteOpen;
      window.FullScreen._updateToolbars = oldUpdateToolbars;
      window.FullScreen.hideNavToolbox = oldHideNavToolbox;

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

      //restore the changed menu items
      window.onViewToolbarsPopupShowing = oldOnViewToolbarsPopupShowing;
      close_next_tabs_message.setAttribute('label', previous_close_message);

      // Put the tabs back up top
      tabs.orient = 'horizontal';
      tabs.mTabstrip.orient = 'horizontal';
      tabs.tabbox.orient = 'vertical'; // probably not necessary
      tabs.removeAttribute('width');
      tabs.removeEventListener('TabOpen', this, false);
      tabs.removeEventListener('TabClose', this, false);
      tabs.removeEventListener('TabPinned', this, false);
      tabs.removeEventListener('TabUnpinned', this, false);
      tabs.removeAttribute('vertical');

      // Restore all individual tabs.
      for (let i = 0; i < tabs.childNodes.length; i++) {
        let tab = tabs.childNodes[i];
        tab.setAttribute('crop', 'end');
      }

      // Remove all the crap we added.
      browserbox.removeChild(leftbox);
      browserbox.removeChild(splitter);
      browserbox.removeAttribute('dir');
      mainWindow.removeAttribute('tabspinned');
      mainWindow.removeAttribute('tabspinnedwidth');
      mainWindow.setAttribute('persist',
        mainWindow.getAttribute('persist').replace(' tabspinnned', ''));
      leftbox = null;

      // Restore the tab strip.
      toolbar.insertBefore(tabs, toolbar.children[tabsIndex]);
      toolbox.insertBefore(toolbar, navbar);
      browserPanel.insertBefore(toolbox, browserPanel.firstChild);
      browserPanel.insertBefore(bottom, document.getElementById('fullscreen-warning').nextSibling);
      top.palette = palette;
      this.window.TabsInTitlebar.updateAppearance(true);
    });
  },

  resizeFindInput: function () {
    let spacer = this.document.getElementById('new-tab-spacer');
    let find_input = this.document.getElementById('find-input');
    if (this.pinnedWidth > 190 || this.document.getElementById('main-window').getAttribute('tabspinned') !== 'true') {
      spacer.style.visibility = 'collapse';
      find_input.style.visibility = 'visible';
    } else {
      find_input.style.visibility = 'collapse';
      spacer.style.visibility = 'visible';
    }
  },

  clearFind: function () {
    this.document.getElementById('find-input').value = '';
    this.filtertabs();
  },

  filtertabs: function () {
    let document = this.document;
    let tabs = document.getElementById('tabbrowser-tabs');
    let find_input = document.getElementById('find-input');
    let input_value = find_input.value.toLowerCase();
    let hidden_counter = 0;
    let hidden_tab = document.getElementById('filler-tab');
    let hidden_tab_label = hidden_tab.children[0];

    for (let i = 0; i < tabs.children.length; i++) {
      let tab = tabs.children[i];
      if (tab.label.toLowerCase().match(input_value) || this.getUri(tab).spec.toLowerCase().match(input_value)) {
        tab.setAttribute('hidden', false);
      } else {
        hidden_counter += 1;
        tab.setAttribute('hidden', true);
      }
    }
    if (hidden_counter > 0) {
      hidden_tab_label.setAttribute('value', `${hidden_counter} more tab${hidden_counter > 1 ? 's' : ''}...`);
      hidden_tab.removeAttribute('hidden');
    } else {
      hidden_tab.setAttribute('hidden', 'true');
    }
    this.actuallyResizeTabs();
  },

  getUri: function (tab) {
    // Strips out the `wyciwyg://` from internal URIs
    return createExposableURI(tab.linkedBrowser.currentURI);
  },

  initTab: function (aTab) {
    let document = this.document;
    let find_input = this.document.getElementById('find-input');
    find_input.value = '';
    emit(find_input, 'input', {category: 'Event', settings: ['input', false, false]});

    this.resizeTabs();

    aTab.classList.add('tab-visible');
    aTab.classList.remove('tab-hidden');

    if (document.getElementById('main-window').getAttribute('tabspinned') !== 'true') {
      aTab.removeAttribute('crop');
    } else {
      aTab.setAttribute('crop', 'end');
    }

    aTab.refreshThumbAndLabel();
  },

  unload: function () {
    this.unloaders.forEach(function (func) {
      func.call(this);
    }, this);
    delete this.window.VerticalTabs;
  },

  actuallyResizeTabs: function () {
    if (this.resizeTimeout > 0) {
      this.window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = -1;
    }
    let tabs = this.document.getElementById('tabbrowser-tabs');
    switch (prefs.largetabs) {
    case 0:
      tabs.classList.remove('large-tabs');
      return;
    case 1: {
      let tabbrowser_height = tabs.clientHeight;
      let number_of_tabs = this.document.querySelectorAll('.tabbrowser-tab:not([hidden=true])').length;
      if (tabbrowser_height / number_of_tabs >= 58 && this.pinnedWidth > 60) {
        tabs.classList.add('large-tabs');
      } else {
        tabs.classList.remove('large-tabs');
      }
      return;
    }
    case 2:
      tabs.classList.add('large-tabs');
      return;
    }
  },

  resizeTabs: function () {
    if (this.resizeTimeout > 0) {
      this.window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = -1;
    }
    if (!this.mouseInside) {
      // If the mouse is outside the tab area,
      // resize immediately
      this.actuallyResizeTabs();
    }
  },

  mouseEntered: function () {
    if (this.resizeTimeout > 0) {
      this.window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = -1;
    }
    this.mouseInside = true;
  },

  mouseExited: function () {
    this.mouseInside = false;
    if (this.resizeTimeout < 0) {
      // Once the mouse exits the tab area, wait
      // a bit before resizing
      this.resizeTimeout = this.window.setTimeout(() => {
        this.resizeTimeout = -1;
        if (!this.mouseInside) {
          this.actuallyResizeTabs();
        }
      }, WAIT_BEFORE_RESIZE);
    }
  },

  //use to set preview image as metadata image 3/4
  // getPageMetaDataImage: function (aTab) {
  //   var tabMeta = this.PageMetadata.getData(aTab.linkedBrowser.contentDocument);
  //   return tabMeta['og:image'];
  // },

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
    case 'TabPinned':
      this.onTabPinned(aEvent);
      return;
    case 'TabUnpinned':
      this.onTabUnpinned(aEvent);
      return;
    case 'mouseup':
      this.onMouseUp(aEvent);
      return;
    }
  },

  onTabOpen: function (aEvent) {
    let tab = aEvent.target;
    this.stats.tabs_created++;
    this.initTab(tab);
  },

  onTabClose: function (aEvent) {
    this.stats.tabs_destroyed++;
  },

  onTabPinned: function (aEvent) {
    this.stats.tabs_pinned++;
  },

  onTabUnpinned: function (aEvent) {
    this.stats.tabs_unpinned++;
  },
};

exports.addVerticalTabs = (win, data) => {
  if (!win.VerticalTabs) {
    new VerticalTabs(win, data);
  }
};

//use to set preview image as metadata image 4/4
// XPCOMUtils.defineLazyModuleGetter(VerticalTabs.prototype, "PageMetadata", "resource://gre/modules/PageMetadata.jsm");
