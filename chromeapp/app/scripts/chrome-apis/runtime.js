'use strict';

var util = require('./util');

/**
 * Add a callback function via chrome.runtime.onMessageExternal.addListener.
 * @param {Function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  util.getRuntime().onMessageExternal.addListener(fn);
};

/**
 * Send a message using the chrome.runtime.sendMessage API.
 *
 * @param {string} id (optional) extension id
 * @param {any} message the message to send. Should be JSON-ifiable object
 * @param {Object} (optional) options
 *
 * @returns {Promise.<any, Error>} Promise that resolves when the handler to
 * the message generates a response, or rejects with an Error.
 */
exports.sendMessage = function() {
  var args = Array.prototype.slice.call(arguments);
  return new Promise(function(resolve, reject) {
    // Some of these parameters are "optional", which it seems like the
    // sendMessage function interprets based on type, etc. Rather than passing
    // directly, we are going to pass the arguments variable directly, adding a
    // callback function.
    args.push(function(response) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(response);
      }
    });
    util.getRuntime().sendMessage.apply(this, args);
  });
};
