(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var chromeRuntime = require('../chrome-apis/runtime');
var chromeTabs = require('../chrome-apis/tabs');

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
 * @param {object} metadata metadata to store about the page
 */
exports.savePage = function(captureUrl, captureDate, dataUrl, metadata) {
  // Sensible default
  metadata = metadata || {};
  var message = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureDate: captureDate,
      dataUrl: dataUrl,
      metadata: metadata
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

},{"../chrome-apis/runtime":3,"../chrome-apis/tabs":4}],2:[function(require,module,exports){
/* global chrome */
'use strict';

var messaging = require('./app-bridge/messaging');
var chromeRuntime = require('./chrome-apis/runtime');

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

console.log('SemCache: Event Page for Browser Action');

chromeRuntime.addOnMessageExternalListener(
  messaging.onMessageExternalCallback
);

},{"./app-bridge/messaging":1,"./chrome-apis/runtime":3}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

/**
 * Get all the tabs that have the specified properties, or all tabs if no
 * properties are specified.
 *
 * @param {object} queryInfo object as specified by chrome.tabs.
 *
 * @return {Promise -> Array<Tab>} Promise that resolves with an Array of Tabs
 * matching queryInfo
 */
exports.query = function(queryInfo) {
  return new Promise(function(resolve) {
    chrome.tabs.query(queryInfo, function(tabs) {
      resolve(tabs);
    });
  });
};

/**
 * Capture the visible area of the currently active tab in the specified
 * window.
 *
 * @param {integer} windowId the target window, defaults to the current window
 * @param {object} options
 *
 * @return {Promise -> string} Promise that resolves with the captured image as
 * a data URL
 */
exports.captureVisibleTab = function(windowId, options) {
  return new Promise(function(resolve) {
    chrome.tabs.captureVisibleTab(windowId, options, function(dataUrl) {
      resolve(dataUrl);
    });
  });
};

},{}]},{},[2]);
