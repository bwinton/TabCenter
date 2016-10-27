# Installation

You'll need normal unix command-line utilities. Currently the build process has
only been tested/maintained on Mac/Linux systems.

If you want to try it on Windows, then installing
[MozillaBuild](https://wiki.mozilla.org/MozillaBuild) will provide some tools
for the command line.

Assuming you have the basic utilities, then you also need:

* [node.js](https://nodejs.org/) with npm.
  * Version 6.x of node is currently the minimum required.
* [Firefox Beta](https://www.mozilla.org/firefox/channel/desktop/) installed on your system.
  * This is the default for the repository,
    [but can be changed](#Changing-the-Firefox-binary-location)
  * Firefox Beta is used, as that is the next version of Firefox to be released,
    developing against pre-release versions is advised to ensure any issues are
    found before release.

To install all the support packages for the repository run:

```shell
$ npm install
```

# Running the add-on in Firefox

```shell
$ npm run firefox
```

Note: If the source to the add-on is changed, this will cause the add-on to be
rebuilt and reloaded.

# Running tests

This command runs all tests:

```shell
$ npm test
```

You can run individual tests, e.g.

```shell
$ npm run lint
$ npm run test:karma
$ npm run test:func
```

More information on the tests in this repository
[can be found from here](../README.md/#documentation).

# Changing the Firefox binary location

You can use a different Firefox binary other than nightly by specifying
a value for `FIREFOX_BINARY` on the command line, or in environment variables.

```shell
$ # Runs Firefox Release
$ FIREFOX_BINARY=firefox npm test
$ # Runs a specific copy of Firefox
$ FIREFOX_BINARY=/path/to/firefox npm run firefox
```

The various shorthands are:

* `firefox` - Firefox Release
* `beta` - Firefox Beta
* `firefoxdeveloperedition` - Firefox developer edition (on osx)
* `aurora` - Firefox Aurora (developer edition on non-osx)
* `nightly` - Firefox Nightly

# Bundling a Zip File for Upload to AMO.

```shell
$ npm run bundle
```
