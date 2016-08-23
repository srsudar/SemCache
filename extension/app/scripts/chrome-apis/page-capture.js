/* globals chrome */
'use strict';

/**
 * Promise-ified wrapper around the chrome.pageCapture API.
 */

/**
 * @param {object} details details object as specified in the
 * chrome.pageCapture API.
 *
 * @return {Promise -> Blob} Promise that resolves with the Blob of mhtml
 * content
 */
exports.saveAsMHTML = function(details) {
  return new Promise(function(resolve) {
    chrome.pageCapture.saveAsMHTML(details, function(blob) {
      resolve(blob);
    });
  });
};
