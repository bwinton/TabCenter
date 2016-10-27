# Linting

[Linting](http://en.wikipedia.org/wiki/Lint_(software)) is important part of
code development that provides static analysis and helps to find bugs in code. It
also helps to developers to adhere to varios style guidelines during the coding
stage, rather than only finding out at review time.

It is recommended for any new project to have linting set up from the start.

# ESLint - Javascript Linting

This respository is has [ESLint](http://eslint.org) for providing javascript
analysis. It is a highly flexible tool especially as it is pluggable, so more
rules can be added easily.

The rules turned on here, are a combination of the rules used for the
[Hello](https://github.com/mozilla/loop) and
[Activity Stream](https://github.com/mozilla/activity-stream/) projects.

## Editor Integration

Editor integration is where developers using linting tools can really gain time.
They can get feedback on their code as they are writing it, flagging up potential
issues before they even try to run it.

### How to integrate

* [ESLint's page on available integrations](http://eslint.org/docs/user-guide/integrations)
* [Details written by the DevTools teams](https://wiki.mozilla.org/DevTools/CodingStandards#Running_ESLint_in_SublimeText)

## Useful ESLint plugins.

Additionally, there are some plugins that are recommended. Included in this example
repository:

* [eslint-plugin-json](https://www.npmjs.com/package/eslint-plugin-json)
  * Provides linting of json files.
* [eslint-plugin-mocha](https://www.npmjs.com/package/eslint-plugin-mocha)
  * Provides rules for various good practices for [Mocha](https://mochajs.org/)
    tests.
* [eslint-plugin-promise](https://www.npmjs.com/package/eslint-plugin-promise)
  * Provides rules for enforcing best practices for Javascript promises.

Not included, but useful depending on the project:

* [eslint-plugin-mozilla](https://www.npmjs.com/package/eslint-plugin-mozilla)
  * A collection of rules that help enforce various coding practice from Mozilla.
  * Mainly based on chrome style code, can help with module imports for example.
* [eslint-plugin-react](https://www.npmjs.com/package/eslint-plugin-react)
  * Provides [React](https://facebook.github.io/react/) specific linting rules.

# Web-ext lint

The [web-ext tool provides](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/web-ext_command_reference#web-ext_lint)
its own linting mechanism for checking WebExtension based add-ons conform to
[specific rules](http://mozilla.github.io/addons-linter/).

# flake8 - Python Linting

Although not currently used in this repository,
[flake8](http://flake8.pycqa.org/en/latest/) is a good tool for linting Python
scripts.

The [Loop](https://github.com/mozilla/loop) project used this tool.

There are also editor integrations available for Flake8.
