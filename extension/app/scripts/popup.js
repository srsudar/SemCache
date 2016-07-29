/* globals chrome, Promise */
'use strict';

var messaging = require('./app-bridge/messaging');

/**
 * Return the URL from the string representation. fullUrl must begin with the
 * scheme (i.e. http:// or https://).
 */
function getDomain(fullUrl) {
  // We will rely on the :// that occurs in the scheme to determine the start
  // of the domain.
  var colonLocation = fullUrl.indexOf(':');
  var domainStart = colonLocation + 3;  // exclude the colon and two slashes.

  // The end of the domain will be the least of /, ?, or # following the
  // domainStart.
  var urlWithoutScheme = fullUrl.substring(domainStart);
  var hashLocation = urlWithoutScheme.indexOf('#');
  var queryLocation = urlWithoutScheme.indexOf('?');
  var slashLocation = urlWithoutScheme.indexOf('/');
  
  // Account for the -1 returned if all these are absent.
  if (hashLocation === -1) { hashLocation = urlWithoutScheme.length; }
  if (queryLocation === -1) { queryLocation = urlWithoutScheme.length; }
  if (slashLocation === -1) { slashLocation = urlWithoutScheme.length; }

  var domainEnd = Math.min(hashLocation, queryLocation, slashLocation);

  var domain = urlWithoutScheme.substring(0, domainEnd);

  return domain;
}

/**
 * @param {Blob} blob
 *
 * @return {Promise} Promise that resolves with a data url string
 */
function getBlobAsDataUrl(blob) {
  return new Promise(function(resolve) {
    var reader = new window.FileReader();
    reader.onloadend = function() {
      var base64 = reader.result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

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
