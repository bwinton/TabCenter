"use strict";

let assert = require("assert");
let utils = require("./utils");
let firefox = require("selenium-webdriver/firefox");
let Context = firefox.Context;

// Mocha can't use arrow functions as sometimes we need to call `this` and
// using an arrow function alters the binding of `this`.
// Hence we disable prefer-arrow-callback here so that mocha/no-mocha-arrows can
// be applied nicely.

describe("Example Add-on Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(10000);

  let driver;

  before(function() {
    let promise = utils.promiseSetupDriver();

    return promise.then(newDriver => {
      driver = newDriver;
      return Promise.resolve();
    });
  });

  after(function() {
    return driver.quit();
  });

  it("should have a toolbar button", function() {
    return utils.promiseAddonButton(driver)
      .then(button => button.getAttribute("tooltiptext"))
      .then(text => assert.equal(text, "Visit Mozilla"));
  });

  // XXX Currently failing, see
  // https://github.com/mozilla/example-addon-repo/issues/1
  it.skip("should open a webpage when the button is clicked", function() {
    let windowHandles;

    return driver.getAllWindowHandles()
      .then(handles => assert.equal(1, 1))
      .then(() => utils.promiseAddonButton(driver))
      .then(button => button.click())
      .then(() => driver.wait(function*() {
        windowHandles = yield driver.getAllWindowHandles();
        return windowHandles.length === 2;
      }, 9000))
      .then(() => driver.getAllWindowHandles())
      .then(handles => {
        windowHandles = handles;
        return driver.getWindowHandle();
      })
      .then(currentHandle => {
        driver.setContext(Context.CONTENT);
        // Find the new window handle.
        let newWindowHandle = null;
        for (const handle of windowHandles) {
          if (handle !== currentHandle) {
            newWindowHandle = handle;
          }
        }

        return driver.switchTo().window(newWindowHandle)
          .then(() => driver.getCurrentUrl());
      })
      .then(currentUrl => {
        assert.equal(currentUrl, "https://www.mozilla.org/en-US/");
        return Promise.resolve();
      });
  });
});
