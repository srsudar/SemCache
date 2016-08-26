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
