/* global chrome */
'use strict';

var backgroundApi = require('./background/background-api');
var messaging = require('./app-bridge/messaging');
var chromeRuntime = require('./chrome-apis/runtime');
var webNavigation = require('./chrome-apis/web-navigation');

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

console.log('SemCache: Event Page for Browser Action');

chromeRuntime.addOnMessageExternalListener(
  messaging.onMessageExternalCallback
);

chromeRuntime.addOnMessageListener(
  messaging.onMessageCallback
);

webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId === 0) {
    // Top level frame
    backgroundApi.queryForPage(details.tabId, details.url);
  }
});

webNavigation.onCompleted.addListener(details => {
  if (details.frameId === 0) {
    // Top level frame
    backgroundApi.queryForPage(details.tabId, details.url);
  }
});
