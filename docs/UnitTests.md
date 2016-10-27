# Unit Tests

The unit tests are based around [Mocha](http://mochajs.org/) and
[Sinon](http://sinonjs.org/). This gives a very simple mocking and test interface.

They are run using [Karma](https://karma-runner.github.io), which also provides
for code coverage.

# WebExtension Stubbing

WebExtensions are automatically stubbed by the
[sinon-chrome](https://github.com/acvetkov/sinon-chrome) package.

Note: Currently the package only stubs chrome.* APIs. There is an
[issue on file](https://github.com/acvetkov/sinon-chrome/issues/40) to consider
supporting the Firefox ones - browser.*

# Test Files

The test files live in the `test/unit` directory. `karma.conf.js` controls the
loading and running of tests.

# Running the Tests

```shell
$ npm run test:karma
```

# Viewing coverage output

You can view the code output in the `build/coverage/` directory.
