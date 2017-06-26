/* global chrome */
'use strict';

const chromeRuntime = require('./chrome-apis/runtime');
const backgroundApi = require('./background/background-api');
const messaging = require('./app-bridge/messaging');
const webNavigation = require('./chrome-apis/web-navigation');


let numNavs = 0;
let loadStart = Date.now();

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
