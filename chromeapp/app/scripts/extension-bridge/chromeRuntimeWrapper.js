/* globals chrome */
'use strict';

/**
 * Add a callback function via chrome.runtime.onMessageExternal.addListener.
 * @param {Function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

/**
 * Send a message using the chrome.runtime.sendMessage API.
 *
 * @param {string} id
 * @param {any} message must be JSON-serializable
 */
exports.sendMessage = function(id, message) {
  chrome.runtime.sendMessage(id, message);
};
