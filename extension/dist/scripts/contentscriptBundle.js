(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
 * @param {function} responseCallback
 */
exports.sendMessage = function(appId, message, responseCallback) {
  chrome.runtime.sendMessage(appId, message, responseCallback);
};

/**
 * Add a function as a listner to chrome.runtime.onMessageExternal.
 *
 * @param {function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

/**
 * Add a function as a listener on chrome.runtime.onMessage.
 *
 * @param {function} fn
 */
exports.addOnMessageListener = function(fn) {
  chrome.runtime.onMessage.addListener(fn);
};

},{}],2:[function(require,module,exports){
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

/**
 * Send a message to a particular tab.
 *
 * @param {integer} tabId
 * @param {any} message must be JSON serializable
 * @param {function} callback
 */
exports.sendMessage = function(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, callback);
};

},{}],3:[function(require,module,exports){
'use strict';

console.log('in SemCache contentscriptBundle.js');

var api = require('./cs-api');
var runtime = require('../chrome-apis/runtime');

runtime.addOnMessageListener(api.onMessageHandler);

},{"../chrome-apis/runtime":1,"./cs-api":4}],4:[function(require,module,exports){
'use strict';

var util = require('../util/util');

/**
 * Handler for internal (to the Extension) messages. Should be added via
 * runtime.onMessage.addListener.
 *
 * @param {any} message message from the sender
 * @param {MessageSender} sender
 * @param {function} callback
 */
exports.onMessageHandler = function(message, sender, callback) {
  if (message.type === 'readystateComplete') {
    exports.handleLoadMessage(message, sender, callback);
    return true;
  }
};

/**
 * Handle a message of type 'readystateComplete'
 *
 * @param {any} message from runtime.onMessage
 * @param {MessageSender} sender from runtime.onMessage
 * @param {function} callback from runtime.onMessage
 */
exports.handleLoadMessage = function(message, sender, callback) {
  // Wait for document.readyState to be complete.
  // Send the response object.
  util.getOnCompletePromise()
    .then(() => {
      var response = exports.createLoadResponseMessage();
      console.log('Invoking callback with response: ', response);
      callback(response);
    });
};

exports.createLoadResponseMessage = function() {
  var loadTime = exports.getFullLoadTime();
  return {
    type: 'readystateComplete',
    loadTime: loadTime
  };
};

/**
 * Return the full time it took to load the page.
 *
 * @return {number} the time from navigation start to readyState = 'complete'.
 */
exports.getFullLoadTime = function() {
  var win = util.getWindow();
  var result = win.performance.timing.domComplete -
    win.performance.timing.navigationStart;
  return result;
};

},{"../util/util":5}],5:[function(require,module,exports){
/* globals fetch */
'use strict';

var tabs = require('../chrome-apis/tabs');

/**
 * Very thin wrapper around the global fetch API to enable mocks during test.
 *
 * @param {string} url URL against which to issue the fetch
 *
 * @return {Promise} Promise that is the result of the global fetch API
 */
exports.fetch = function(url) {
  return fetch(url);
};

/**
 * @return {document} the global document object
 */
exports.getDocument = function() {
  return document;
};

/**
 * @return {window} the global window object
 */
exports.getWindow = function() {
  return window;
};

/**
 * @return {Promise} Promise that resolves when document.readyState is
 * complete, indicating that all resources have been loaded (and thus the page
 * is presumably safe to save
 */
exports.getOnCompletePromise = function() {
  // Modeled on Jake Archibald's svgomg utils:
  // https://github.com/jakearchibald/svgomg/blob/master/src/js/page/utils.js
  var doc = exports.getDocument();
  return new Promise(function(resolve) {
    var checkState = function() {
      if (doc.readyState === 'complete') {
        resolve();
      }
    };
    doc.addEventListener('readystatechange', checkState);
    checkState();
  });
};

/**
 * @return {Promise -> Tab} Promise that resolves with the current active Tab
 */
exports.getActiveTab = function() {
  return new Promise(function(resolve) {
    tabs.query({ currentWindow: true, active: true})
      .then(tabs => {
        var tab = tabs[0];
        resolve(tab);
      });
  });
};

},{"../chrome-apis/tabs":2}]},{},[3]);
