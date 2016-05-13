set SOURCES=README.md bootstrap.js chrome.manifest groups.jsm groups.xml install.rdf multiselect.jsm override-bindings.css skin/* tabdatastore.jsm utils.js vertical-tabbrowser.xml verticaltabs.jsm set
set TARGET=TabCenterTest.xpi

del %TARGET%
\progra~1\7-zip\7z a -tzip -mx9 -r %TARGET% %SOURCES% > nul
