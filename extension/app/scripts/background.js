/* global chrome */
'use strict';

var messaging = require('./app-bridge/messaging');
var chromeRuntime = require('./chromeRuntime');

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

console.log('SemCache: Event Page for Browser Action');

chromeRuntime.addOnMessageExternalListener(
  messaging.onMessageExternalCallback
);
