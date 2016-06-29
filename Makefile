
SOURCES = \
	README.md \
	bootstrap.js \
	chrome.manifest \
	install.rdf \
	multiselect.jsm \
	options.xul \
	override-bindings.css \
	skin/* \
	tabdatastore.jsm \
	utils.js \
	vertical-tabbrowser.xml \
	verticaltabs.jsm \
	$(NULL)

all: TabCenterTest.xpi

TabCenterTest.xpi: $(SOURCES)
	rm -f ./$@
	zip -9r ./$@ $(SOURCES)
