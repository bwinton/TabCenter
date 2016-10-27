# Functional Tests

The functional tests in this repository are run via
[Selenium](http://www.seleniumhq.org/) and
[Geckodriver](https://github.com/mozilla/geckodriver).

Selenium is being driven via the node/javascript language, although python may
also work well (the
[Loop](https://github.com/mozilla/loop/blob/master/docs/Developing.md#functional-tests)
project used Python).

[Mocha](https://mochajs.org/) is used as the test framework.

# Running the tests.

The functional tests can be run on their own by:

```
  $ npm run test:func
```

## Running against different browser versions.

TBD.

# Useful Documents

* [Javascript API for webdriver](https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/firefox/index.html)
