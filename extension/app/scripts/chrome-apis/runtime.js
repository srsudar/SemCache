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
  // console.log('calling send message: ', appId, message, responseCallback);
  // The sendMessage handles optional arguments in a way that I am struggling
  // to replicate. To remain consistent, just apply the arguments.
  chrome.runtime.sendMessage.apply(this, arguments);
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
