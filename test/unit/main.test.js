"use strict";

describe("main.js", function() {
  describe("browserAction", function() {
    it("should register a listener for onClicked", function() {
      sinon.assert.calledOnce(chrome.browserAction.onClicked.addListener);
    });

    it("should open a tab when the button is clicked", function() {
      chrome.browserAction.onClicked.trigger();

      sinon.assert.calledOnce(chrome.tabs.create);
      sinon.assert.calledWithExactly(chrome.tabs.create, {
        active: true,
        url: "https://www.mozilla.org"
      });
    });
  });
});
