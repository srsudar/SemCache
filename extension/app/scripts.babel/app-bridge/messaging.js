/* globals chrome */
'use strict';

/**
 * ID of the Semcache Chrome App.
 */
exports.APP_ID = 'dfafijifolbgimhdeahdmkkpapjpabka';

/**
 * Send a message to the SemCache app.
 */
exports.sendMessageToApp = function(message, options, callback) {
  chrome.sendMessage(exports.APP_ID, message, options, callback);
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
exports.savePage = function(captureUrl, captureDate, blob, options, callback) {
  var message = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureData: captureDate,
      mhtml: blob
    }
  };
  exports.sendMessageToApp(message, options, callback);
};
