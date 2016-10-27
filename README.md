[![Build Status](https://travis-ci.org/Standard8/test-example-webextension.svg?branch=master)](https://travis-ci.org/Standard8/test-example-webextension)
[![Coverage Status](https://coveralls.io/repos/github/Standard8/test-example-webextension/badge.svg)](https://coveralls.io/github/Standard8/test-example-webextension)

This repository is intended as an example repository containing templates and good
practices for creating a
[WebExtension based add-on](https://developer.mozilla.org/Add-ons/WebExtensions)
for Firefox.

# Aims

The aim of this repository is to bring together tools and services into a
template/example repository, so that add-on developers can have a good starting
point for created WebExtensions that includes testing suites.

# What's here

This repository includes a small WebExtension as an example, and includes the
infrastructure to build and test it using Firefox.

It has test suites for lint, unit, and integration/functional
testing. There's also code coverage for the unit tests.

Additionally the test suites are run on the Travis service providing continuous
testing coverage. This may be reflected in a developer's own repository where it
is open source, providing coverage of pull requests etc.

# Documentation

It is intended that all parts of this repository have at least outline
documentation. If you find any parts that are missing, please file an issue or
create a PR.

* [Building, running code and tests](docs/Developing.md)
* [Keeping modules up to date via automated services](docs/ModulesUpdating.md)
* Testing
  * [Linting](docs/Linting.md)
  * [Unit Tests](docs/UnitTests.md)
  * [Functional Tests](docs/Functional.md)

# Issues

If you've found an issue with WebExtensions themselves, or wish to discuss them
further, please use the
[add-ons community on discourse](https://discourse.mozilla-community.org/c/add-ons)

For issues and items not working properly in this repository, please see the
[issues list](https://github.com/mozilla/example-addon-repo/issues), or file a new one.
