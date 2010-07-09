#!/bin/sh
rm -Rf build release.xpi
mkdir build

cp chrome.manifest.rel build/chrome.manifest

cp -R install.rdf defaults build
zip -r build/verticaltabs.jar content skin locale

cd build
zip -r ../release.xpi *
