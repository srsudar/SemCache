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
