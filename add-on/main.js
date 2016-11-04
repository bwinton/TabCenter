'use strict';

// @flow

/* global chrome */

var cachedTabs = new Map();
var cachedPort;

chrome.tabs.query({}, (tabs) => {
  for (var tab of tabs) {
    cachedTabs.set(tab.id, tab);
  }
  sendTabs();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('update', tabId, changeInfo, tab);
  cachedTabs.set(tabId, tab);
  sendTabs();
});

chrome.tabs.onCreated.addListener(newTab => {
  for (var [id,tab] of cachedTabs) {
    if (tab.index >= newTab.index) {
      tab.index++;
    }
  }
  cachedTabs.set(newTab.id, newTab);
  sendTabs();
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  let oldTab = cachedTabs.get(tabId);
  for (var [id,tab] of cachedTabs) {
    if (tab.index >= oldTab.index) {
      tab.index--;
    }
  }
  cachedTabs.delete(tabId);
  sendTabs();
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  console.log('move', tabId, moveInfo);
  for (var [id,tab] of cachedTabs) {
    if (moveInfo.toIndex < moveInfo.fromIndex) {
      if (tab.index >= moveInfo.toIndex && tab.index <= moveInfo.fromIndex) {
        tab.index++;
      }
    } else {
      if (tab.index <= moveInfo.toIndex && tab.index >= moveInfo.fromIndex) {
        tab.index--;
      }
    }
  }
  cachedTabs.get(tabId).index = moveInfo.toIndex;
  sendTabs();
});

function sendTabs() {
  if (cachedPort) {
    cachedPort.postMessage(convert(cachedTabs));
  }
};

function convert(cachedTabs) {
  var rv = [];
  for (var [id,tab] of cachedTabs) {
    console.log("2", tab);
    rv.push({id: id, index: tab.index, label: tab.title, icon: tab.favIconUrl,
      url: tab.url, pinned: tab.pinned});
  }
  rv.sort((a,b) => {return a.index - b.index});
  return rv;
};

chrome.runtime.onConnect.addListener(function(port) {
  cachedPort = port;
  sendTabs();
});
