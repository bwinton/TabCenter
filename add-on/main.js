"use strict";

/* global chrome */

chrome.browserAction.onClicked.addListener(() => {
  chrome.tabs.create({
    active: true,
    url: "https://www.mozilla.org"
  });
});
