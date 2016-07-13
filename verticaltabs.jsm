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

/*global VTTabIDs:false*/
/* exported EXPORTED_SYMBOLS, TAB_DROP_TYPE, vtInit*/

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://tabcenter/tabdatastore.jsm');
Components.utils.import('resource://tabcenter/multiselect.jsm');

//use to set preview image as metadata image 1/4
// Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

const EXPORTED_SYMBOLS = ['VerticalTabs', 'vtInit'];

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const TAB_DROP_TYPE = 'application/x-moz-tabbrowser-tab';

function vtInit() {
  let sss = Components.classes['@mozilla.org/content/style-sheet-service;1']
              .getService(Components.interfaces.nsIStyleSheetService);
  let ios = Components.classes['@mozilla.org/network/io-service;1']
              .getService(Components.interfaces.nsIIOService);

  let installStylesheet = function (uri) {
    uri = ios.newURI(uri, null, null);
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  };

  let removeStylesheet = function (uri) {
    uri = ios.newURI(uri, null, null);
    sss.unregisterSheet(uri, sss.USER_SHEET);
  };

  installStylesheet('resource://tabcenter/override-bindings.css');
  installStylesheet('resource://tabcenter/skin/base.css');
  installStylesheet('chrome://tabcenter/skin/platform.css');

  return () => {
    removeStylesheet('chrome://tabcenter/skin/platform.css');
    removeStylesheet('resource://tabcenter/override-bindings.css');
    removeStylesheet('resource://tabcenter/skin/base.css');
    let windows = Services.wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
      let window = windows.getNext();
      let tabs = window.document.getElementById('tabbrowser-tabs');
      if (tabs) {
        tabs.removeAttribute('overflow');
        tabs._positionPinnedTabs();
      }
    }
  };
}

/*
 * Vertical Tabs
 *
 * Main entry point of this add-on.
 */
function VerticalTabs(window, {newPayload, addPingStats, AppConstants, setDefaultPrefs}) {
  this.window = window;
  this.document = window.document;
  this.unloaders = [];
  this.addPingStats = addPingStats;
  this.newPayload = newPayload;
  this.setDefaultPrefs = setDefaultPrefs;
  this.AppConstants = AppConstants;
  this.stats = this.newPayload();
  this.init();
}
VerticalTabs.prototype = {

  init: function () {
    this.window.VerticalTabs = this;
    this._endRemoveTab = this.window.gBrowser._endRemoveTab;
    this.inferFromText = this.window.ToolbarIconColor.inferFromText;
    let AppConstants = this.AppConstants;
    let window = this.window;
    let document = this.document;

    this.BrowserOpenTab = this.window.BrowserOpenTab;
    this.window.BrowserOpenTab = function () {
      this.pushToTop = Services.prefs.getBoolPref('extensions.verticaltabs.opentabstop');
      this.window.openUILinkIn(this.window.BROWSER_NEW_TAB_URL, 'tab');
      this.pushToTop = false;
    }.bind(this);

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

      let toolbarSelector = '#verticaltabs-box, #verticaltabs-box > toolbar:not([collapsed=true]):not(#addon-bar)';
      if (AppConstants.platform === 'macosx') {
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
    }.bind(this.window.ToolbarIconColor);
    this.unloaders.push(function () {
      this.window.ToolbarIconColor.inferFromText = this.inferFromText;
      this.window.gBrowser._endRemoveTab = this._endRemoveTab;
      this.window.BrowserOpenTab = this.BrowserOpenTab;
      delete this.window.VerticalTabs;
    });
    this.window.onunload = () => {
      this.sendStats();
    };

    this.rearrangeXUL();
    this.initContextMenu();

    let tabs = this.document.getElementById('tabbrowser-tabs');
    let results = this.document.getElementById('PopupAutoCompleteRichResult');
    let leftbox = this.document.getElementById('verticaltabs-box');

    if (results) {
      results.removeAttribute('width');
    }
    this.tabIDs = new VTTabIDs(tabs);
    this.tabObserver = new this.document.defaultView.MutationObserver((mutations) => {
      this.tabObserver.disconnect();
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' &&
            mutation.target.localName === 'tab') {
          let tab = mutation.target;
          if (mutation.attributeName === 'crop' && leftbox.getAttribute('expanded') !== 'true') {
            tab.removeAttribute('crop');
          } else if (mutation.attributeName === 'selected' && tab.getAttribute('visuallyselected') !== 'true'){
            this.checkScrollToTab(tab);
          }
        } else if (mutation.type === 'attributes' &&
                   mutation.target.id === 'PopupAutoCompleteRichResult' &&
                   mutation.attributeName === 'width') {
          results.removeAttribute('width');
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
      this.tabIDs.unload();
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
        let newstate = box.getAttribute('tabspinned') == 'true' ? 'false' : 'true';
        box.setAttribute('tabspinned', newstate);
        if (newstate == 'true') {
          window.VerticalTabs.stats.tab_center_pinned++;
        } else {
          window.VerticalTabs.stats.tab_center_unpinned++;
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
    find_input.addEventListener('input', this.filtertabs.bind(this));
    this.window.addEventListener('keyup', (e) => {
      if(e.keyCode === 27) {
        this.clearFind();
      }
    });
    document.getElementById('filler-tab').addEventListener('click', this.clearFind.bind(this));

    let spacer = this.createElement('spacer', {'id': 'new-tab-spacer'});
    toolbar.insertBefore(find_input, pin_button);
    toolbar.insertBefore(spacer, pin_button);

    this.resizeFindInput();

    // change the text in the tab context box
    let close_next_tabs_message = document.getElementById('context_closeTabsToTheEnd');
    close_next_tabs_message.setAttribute('label', 'Close Tabs Below');

    let enter = (event) => {
      if (event.type === 'mouseenter' && leftbox.getAttribute('expanded') !== 'true') {
        this.stats.tab_center_expanded++;
        leftbox.setAttribute('expanded', 'true');
      }
      if (event.pageX <= 4) {
        leftbox.style.transition = 'box-shadow 150ms ease-out, width 150ms ease-out';
        window.setTimeout(() => {
          leftbox.style.transition = '';
        }, 300);
      }
      window.setTimeout(() => {
        for (let i = 0; i < tabs.childNodes.length; i++) {
          tabs.childNodes[i].setAttribute('crop', 'end');
        }
      }, 300);
    };

    leftbox.addEventListener('mouseenter', enter);
    leftbox.addEventListener('mousemove', enter);
    leftbox.addEventListener('mouseleave', () => {
      if (mainWindow.getAttribute('tabspinned') !== 'true') {
        leftbox.removeAttribute('expanded');
        this.clearFind();
        let tabsPopup = document.getElementById('alltabs-popup');
        if (tabsPopup.state === 'open') {
          tabsPopup.hidePopup();
        }
      }
    });

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

    window.addEventListener('beforecustomization', function () {
      browserPanel.insertBefore(top, browserPanel.firstChild);
      top.palette = palette;
    });

    window.addEventListener('customizationchange', () => {
      this.setDefaultPrefs();
    });

    window.addEventListener('aftercustomization', function () {
      contentbox.insertBefore(top, contentbox.firstChild);
      top.palette = palette;
    });

    window.addEventListener('resize', this.resizeTabs.bind(this), false);

    let tab_context_menu = document.getElementById('tabContextMenu');

    tab_context_menu.addEventListener('mouseover', function () {
      leftbox.setAttribute('expanded', 'true');
    });

    tab_context_menu.addEventListener('mouseout', function () {
      if (mainWindow.getAttribute('tabspinned') !== 'true') {
        leftbox.removeAttribute('expanded');
      }
    });

    this.unloaders.push(function () {
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
      window.removeEventListener('beforecustomization');
      window.removeEventListener('aftercustomization');
      window.removeEventListener('customizationchange');

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
        tab.removeAttribute('verticaltabs-id');
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
      if (tab.label.toLowerCase().match(input_value) || tab.linkedBrowser.currentURI.spec.toLowerCase().match(input_value)) {
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
    this.resizeTabs();
  },

  initContextMenu: function () {
    const document = this.document;
    const tabs = document.getElementById('tabbrowser-tabs');

    let closeMultiple = null;
    if (this.multiSelect) {
      closeMultiple = this.createElement('menuitem', {
        'id': 'context_verticalTabsCloseMultiple',
        'label': 'Close Selected Tabs',
        'tbattr': 'tabbrowser-multiple',
        'oncommand': 'gBrowser.tabContainer.VTMultiSelect.closeSelected();'
      });
      tabs.contextMenu.appendChild(closeMultiple);
    }

    tabs.contextMenu.addEventListener('popupshowing', this, false);

    this.unloaders.push(function () {
      if (closeMultiple) {
        tabs.contextMenu.removeChild(closeMultiple);
      }
      tabs.contextMenu.removeEventListener('popupshowing', this, false);
    });
  },

  initTab: function (aTab) {
    let document = this.document;
    if (this.pushToTop) {
      this.window.gBrowser.moveTabTo(aTab, 0);
    }
    let find_input = this.document.getElementById('find-input');
    find_input.value = '';
    find_input.dispatchEvent(new Event('input'));

    this.resizeTabs();

    aTab.classList.add('tab-visible');
    aTab.classList.remove('tab-hidden');

    if (document.getElementById('main-window').getAttribute('tabspinned') !== 'true') {
      aTab.removeAttribute('crop');
    } else {
      aTab.setAttribute('crop', 'end');
    }

    aTab.addEventListener('load', function () {
      let tab_address = aTab.linkedBrowser.currentURI.spec;
      //use to set preview image as metadata image 2/4
      // document.getAnonymousElementByAttribute(aTab, 'anonid', 'tab-meta-image').style.backgroundImage = `url(${this.getPageMetaDataImage(aTab)}`;

      //use to set preview image as screenshot
      document.getAnonymousElementByAttribute(aTab, 'anonid', 'tab-meta-image').style.backgroundImage = `url(moz-page-thumb://thumbnail/?url=${encodeURIComponent(tab_address)}), url(resource://tabcenter/skin/blank.png)`;

      document.getAnonymousElementByAttribute(aTab, 'anonid', 'address-label').value = tab_address;
    }.bind(this));
  },

  unload: function () {
    this.unloaders.forEach(function (func) {
      func.call(this);
    }, this);
  },

  checkScrollToTab: function (tab) {
    let elemTop = tab.getBoundingClientRect().top;
    let elemBottom = tab.getBoundingClientRect().bottom;
    let overTop = elemTop < 63;
    let overBottom = elemBottom > this.window.innerHeight;
    if (overTop) {
      tab.scrollIntoView(true);
    } else if (overBottom) {
      tab.scrollIntoView(false);
    }
  },

  resizeTabs: function () {
    let tabs = this.document.getElementById('tabbrowser-tabs');
    let tabbrowser_height = tabs.clientHeight;
    let number_of_tabs = this.document.querySelectorAll('.tabbrowser-tab[hidden=false]').length;
    if (tabbrowser_height / number_of_tabs >= 58 && this.pinnedWidth > 60) {
      tabs.classList.add('large-tabs');
    } else {
      tabs.classList.remove('large-tabs');
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
    case 'popupshowing':
      this.onPopupShowing(aEvent);
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

  onPopupShowing: function (aEvent) {
    if (!this.multiSelect) {
      return;
    }

    let closeTabs = this.document.getElementById('context_verticalTabsCloseMultiple');
    let tabs = this.multiSelect.getSelected();
    if (tabs.length > 1) {
      closeTabs.disabled = false;
    } else {
      closeTabs.disabled = true;
    }
  },

  sendStats: function (payload) {
    this.addPingStats(this.stats);
    this.stats = this.newPayload();
  }

};

//use to set preview image as metadata image 4/4
// XPCOMUtils.defineLazyModuleGetter(VerticalTabs.prototype, "PageMetadata", "resource://gre/modules/PageMetadata.jsm");
