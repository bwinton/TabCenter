#!/bin/sh
rm -Rf build release.xpi
mkdir build
cp -R install.rdf chrome.manifest content skin locale defaults build
cd build
zip -r ../release.xpi *
