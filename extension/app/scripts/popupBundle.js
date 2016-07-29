(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var chromeRuntime = require('../chromeRuntime');
var chromeTabs = require('../chromeTabs');

/**
 * ID of the Semcache Chrome App.
 */
exports.APP_ID = 'dfafijifolbgimhdeahdmkkpapjpabka';

/**
 * Send a message to the SemCache app.
 *
 * @param {any} message JSON serializable message for the app
 */
exports.sendMessageToApp = function(message) {
  chromeRuntime.sendMessage(exports.APP_ID, message);
};

/**
 * Save a page as MHTML by calling the extension.
 *
 * @param {string} captureUrl the URL of the captured page
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {string} dataUrl the blob of MHTMl data as a data URL
 */
exports.savePage = function(captureUrl, captureDate, dataUrl) {
  var message = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureDate: captureDate,
      dataUrl: dataUrl
    }
  };
  exports.sendMessageToApp(message);
};

/**
 * Open the given URL.
 *
 * @param {string} url
 */
exports.openUrl = function(url) {
  chromeTabs.update(url);
};

/**
 * A callback to be registered via
 * chrome.runtime.onMessageExternal.addListener.
 *
 * After being added, this function is responsible for responding to messages
 * that come from the App component.
 *
 * @param {any} message
 * @param {MessageSender} sender
 * @param {function} sendResponse
 */
exports.onMessageExternalCallback = function(message, sender, sendResponse) {
  if (sender.id && sender.id !== exports.APP_ID) {
    console.log('Received a message not from the app: ', sender);
    return;
  }
  if (message.type === 'open') {
    // An open request for a URL.
    var url = message.params.url;
    exports.openUrl(url);
    if (sendResponse) {
      sendResponse();
    }
  }
};

},{"../chromeRuntime":2,"../chromeTabs":3}],2:[function(require,module,exports){
/* globals chrome */
'use strict';

/**
 * Wrapper around the chrome.runtime family of APIs.
 */

/**
 * Send a message using the chrome.runtime.sendMessage API.
 *
 * @param {string} appId
 * @param {any} message must be JSON-serializable
 */
exports.sendMessage = function(appId, message) {
  chrome.runtime.sendMessage(appId, message);
};

/**
 * Add a function as a listner to chrome.runtime.onMessageExternal.
 *
 * @param {function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

},{}],3:[function(require,module,exports){
/* global chrome */
'use strict';

/**
 * Wrapper around the chrome.tabs APIs.
 */

/**
 * Update the default tab with the given URL.
 *
 * @param {string} url the URL to open
 */
exports.update = function(url) {
  chrome.tabs.update({
    url: url
  });
};

},{}],4:[function(require,module,exports){
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

},{"./app-bridge/messaging":1}]},{},[4]);
