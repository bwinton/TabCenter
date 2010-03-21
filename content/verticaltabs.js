var VerticalTabs = {

    handleEvent: function(event) {
        switch (event.type) {
        case 'DOMContentLoaded':
            this.init();
            return;
        }
    },

    init: function() {
        window.removeEventListener("DOMContentLoaded", this, false);

        // Move the tabs next to the tabbrowser, make them vertical
        // and place a splitter between them.

        var tabs = document.getElementById("tabbrowser-tabs");
        var contentbox = document.getElementById("appcontent");
        contentbox.orient = "horizontal";
        contentbox.insertBefore(tabs, contentbox.lastChild);

        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary

        var splitter = document.createElement("splitter");
        splitter.setAttribute("id", "verticaltabs-splitter");
        splitter.setAttribute("class", "chromeclass-extrachrome");
        contentbox.insertBefore(splitter, contentbox.lastChild);
    }

};

window.addEventListener("DOMContentLoaded", VerticalTabs, false);
