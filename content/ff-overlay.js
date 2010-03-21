verticaltabs.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ verticaltabs.showFirefoxContextMenu(e); }, false);
};

verticaltabs.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-verticaltabs").hidden = gContextMenu.onImage;
};

window.addEventListener("load", verticaltabs.onFirefoxLoad, false);
