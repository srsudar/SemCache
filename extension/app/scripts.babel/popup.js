/* globals chrome */
'use strict';

console.log('SemCache Popup');

chrome.tabs.query({ currentWindow: true, active: true}, function(tabs) {
  var tab = tabs[0];
  var tabId = tab.id;
  var tabUrl = tab.url;
  console.log('Tab id: ' + tabId);
  console.log(tab);

  chrome.pageCapture.saveAsMHTML({ tabId: tabId }, function(blob) {
    console.log('got blob: ' + blob);
    var captureUrl = createFileName(tabUrl);
    var captureDate = new Date().toISOString();
    savePage(captureUrl, captureDate, blob);
    // var fileName = createFileName(tabUrl);
    // writeBlob(blob, fileName);
  });
});

function writeBlob(blob, fileName) {
  console.log('trying to save blob');
  var saveData = (function () {
    var a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    return function (fileName) {
      var url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    };
  }())(fileName);
}

function createFileName(fullUrl) {
  var domain = getDomain(fullUrl);
  // We will format this in yyyy-mm-dd in utc.
  var utcDay = new Date().toISOString().split('T')[0];
  var result = domain + '_UTC_' + utcDay + '.mhtml';
  return result;
}

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
 * ID of the Semcache Chrome App.
 */
var APP_ID = 'dfafijifolbgimhdeahdmkkpapjpabka';

/**
 * Send a message to the SemCache app.
 */
var sendMessageToApp = function(message, options, callback) {
  chrome.sendMessage(APP_ID, message, options, callback);
};

/**
 * Save a page as MHTML by calling the extension.
 *
 * @param {string} captureUrl the URL of the captured page
 * @param {string} captureData the toISOString() of the date the page was
 * captured
 * @param {Blob} blob the blob of MHTMl data
 * @param {object} options object
 * @param {function} callback a callback that can be invoked by the receiver
 */
var savePage = function(captureUrl, captureDate, blob, options, callback) {
  var message = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureData: captureDate,
      mhtml: blob
    }
  };
  sendMessageToApp(message, options, callback);
};
