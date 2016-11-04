'use strict';

// @flow

/* global chrome */

function createElement(label, attrs) {
  let rv = document.createElement(label);
  if (attrs) {
    for (let attr in attrs) {
      rv.setAttribute(attr, attrs[attr]);
    }
  }
  return rv;
}

function addTabs(cachedTabs, tabs) {
  for (var tab of cachedTabs) {
    console.log("tab", tab);
    let tabElem = createElement('div', {
      'class': 'tab',
      'title': tab.url,
      'pinned': tab.pinned,
      'id': tab.id
    });
    tabElem.appendChild(createElement('img', {
      'class': 'favicon',
      src: tab.icon
    }));
    let title = createElement('div', {
      'class': 'title'
    });
    title.textContent = tab.label;
    tabElem.appendChild(title);
    tabs.appendChild(tabElem);
  }
  console.log(tabs.outerHTML);
}

var port = chrome.runtime.connect({name: "tabs"});
port.onMessage.addListener(function(cachedTabs) {
  console.log(cachedTabs);
  let tabs = document.getElementById('tabs');
  while (tabs.firstChild) {
    tabs.removeChild(tabs.firstChild);
  }
  tabs.addEventListener('click', e => {
    console.log(e);
    let tab = e.target;
    while(tab.className != 'tab') {
      tab = tab.parentNode;
    }
    console.log(tab);
    chrome.tabs.update(+tab.getAttribute('id'), {'active': true});
  });

  addTabs(cachedTabs, tabs);
});
