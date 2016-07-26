
SOURCES = \
	README.md \
	bootstrap.js \
	chrome.manifest \
	install.rdf \
	options.xul \
	override-bindings.css \
	skin/* \
	utils.js \
	vertical-tabbrowser.xml \
	verticaltabs.jsm \
	$(NULL)

all: TabCenterTest.xpi

TabCenterTest.xpi: $(SOURCES)
	rm -f ./$@
	zip -9r ./$@ $(SOURCES)
