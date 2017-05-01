/* global chrome */
'use strict';

var backgroundApi = require('./background/background-api');
var messaging = require('./app-bridge/messaging');
var chromeRuntime = require('./chrome-apis/runtime');
var webNavigation = require('./chrome-apis/web-navigation');

var numNavs = 0;
var loadStart = Date.now();

function logQueryPerMin() {
  var minutesSinceStart = (Date.now() - loadStart) / 1000 / 60;
  var qpm = numNavs / minutesSinceStart;
  console.log('numNavs thus far: ', numNavs);
  console.log('qpm: ', qpm);
}

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

console.log('SemCache: Event Page for Browser Action');

chromeRuntime.addOnMessageExternalListener(
  messaging.onMessageExternalCallback
);

chromeRuntime.addOnMessageListener(
  backgroundApi.onMessageCallback
);

webNavigation.onCommitted.addListener(details => {
  if (backgroundApi.isNavOfInterest(details)) {
    console.log('onCommitted event: ', details);
    backgroundApi.queryForPage(details.tabId, details.url);
    numNavs++;
    logQueryPerMin();
  }
});
