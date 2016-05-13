
SOURCES = \
	README.md \
	bootstrap.js \
	chrome.manifest \
	groups.jsm \
	groups.xml \
	install.rdf \
	multiselect.jsm \
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
