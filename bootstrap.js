const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const RESOURCE_HOST = "verticaltabs";
const PREF_BRANCH = "extensions.verticaltabs.";
const DEFAULT_PREFS = {
  "extensions.verticaltabs.width": 250,
  "extensions.verticaltabs.right": false,
  "browser.allTabs.previews": true
};

let unloaders = [];

function setDefaultPrefs() {
  let branch = Services.prefs.getDefaultBranch("");
  for (let [name, value] in Iterator(DEFAULT_PREFS)) {
    switch (typeof value) {
      case "boolean":
        branch.setBoolPref(name, value);
        break;
      case "number":
        branch.setIntPref(name, value);
        break;
      case "string":
        branch.setCharPref(name, value);
        break;
    }
  }
}

function loadIntoWindow(win) {
  let vt = new VerticalTabs(win);
  unloaders.push(vt.unload.bind(vt));
}

function runOnLoad(window, callback) {
  window.addEventListener("DOMContentLoaded", function onLoad() {
    window.removeEventListener("DOMContentLoaded", onLoad, false);
    callback(window);
  }, false);
}

function eachWindow(callback) {
  let enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    if (win.document.readyState === "complete") {
      callback(win);
    } else {
      runOnLoad(win, callback);
    }
  }
}

function windowWatcher(subject, topic) {
  if (topic !== "domwindowopened") {
    return;
  }
  let win = subject.QueryInterface(Ci.nsIDOMWindow);
  // We don't know the type of the window at this point yet, only when
  // the load event has been fired.
  runOnLoad(win, function (win) {
    let doc = win.document.documentElement;
    if (doc.getAttribute("windowtype") == "navigator:browser") {
      loadIntoWindow(win);
    }
  });
}

function registerResource(name, installPath) {
  let resource = Services.io.getProtocolHandler("resource")
                         .QueryInterface(Ci.nsIResProtocolHandler);
  let alias = Services.io.newFileURI(installPath);
  if (!installPath.isDirectory()) {
    alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
  }
  resource.setSubstitution(name, alias);
  unloaders.push(function () {
    resource.setSubstitution(name, null);
  });
}

function startup(data, reason) {
  setDefaultPrefs();
  unloaders.push(function() {
    Services.prefs.getDefaultBranch(PREF_BRANCH).deleteBranc();
  });

  AddonManager.getAddonByID(data.id, function(addon) {
    registerResource(RESOURCE_HOST, data.installPath);
    Cu.import("resource://verticaltabs/content/verticaltabs.js");

    eachWindow(loadIntoWindow);

    Services.ww.registerNotification(windowWatcher);
    unloaders.push(function() {
      Services.ww.unregisterNotification(windowWatcher);
    });
  });
};

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }
  unloaders.forEach(function(unload) {
    unload();
  });
}

function install() {
}

function uninstall() {
}
