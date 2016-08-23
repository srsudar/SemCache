/* globals chrome */
'use strict';

var messaging = require('./app-bridge/messaging');

chrome.tabs.query({ currentWindow: true, active: true}, function(tabs) {
  var tab = tabs[0];
  var tabId = tab.id;
  var tabUrl = tab.url;
  console.log('Tab id: ' + tabId);
  console.log(tab);

  chrome.pageCapture.saveAsMHTML({ tabId: tabId }, function(blob) {
    console.log('got blob: ' + blob);
    var domain = getDomain(tabUrl);
    var captureDate = new Date().toISOString();
    getBlobAsDataUrl(blob).then(base64 => {
      messaging.savePage(domain, captureDate, base64);
    });
    // var fileName = createFileName(tabUrl);
    // writeBlob(blob, fileName);
  });
});
