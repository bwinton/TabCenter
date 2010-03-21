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

        // Move the bottom stuff (statusbar, findbar) in with the
        // tabbrowser.  That way it will share the same (horizontal)
        // space as the brower.  In other words, the bottom stuff no
        // longer extends across the whole bottom of the window.
        var contentbox = document.getElementById("appcontent");
        var bottom = document.getElementById("browser-bottombox");
        contentbox.appendChild(bottom);

        // Move the tabs next to the app content and make them vertical
        // and place a splitter between them.
        var tabs = document.getElementById("tabbrowser-tabs");
        contentbox.parentNode.insertBefore(tabs, contentbox);
        tabs.orient = "vertical";
        tabs.mTabstrip.orient = "vertical";
        tabs.tabbox.orient = "horizontal"; // probably not necessary

        var splitter = document.createElement("splitter");
        splitter.setAttribute("id", "verticaltabs-splitter");
        splitter.setAttribute("class", "chromeclass-extrachrome");
        contentbox.parentNode.insertBefore(splitter, contentbox);

    }

};

window.addEventListener("DOMContentLoaded", VerticalTabs, false);
