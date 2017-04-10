/* globals chrome */
'use strict';

/**
 * This is a thin wrapper around the chrome-promise library. Relying on this
 * rather than the global will allow us to more easily inject functionality
 * during testing.
 */

var ChromePromise = require('chrome-promise');

var CHROMEP_SINGLETON = null;

/**
 * Return the chrome-promise singleton.
 *
 * @return {chrome-promise} An object that mirrors the chrome global but where
 * all functions follow a Promise API.
 */
exports.getChromep = function() {
  if (!CHROMEP_SINGLETON) {
    CHROMEP_SINGLETON = new ChromePromise();
  }
  return CHROMEP_SINGLETON;
};

/**
 * @return {Object} the Promisified version of chrome.fileSystem
 */
exports.getFileSystem = function() {
  // retainEntry is incorrectly handled in chromep. Replace it with the stock
  // function.
  exports.getChromep().fileSystem.retainEntry = chrome.fileSystem.retainEntry;
  return exports.getChromep().fileSystem;
};

/**
 * @return {Object} the Promisified version of chrome.storage.local
 */
exports.getStorageLocal = function() {
  return exports.getChromep().storage.local;
};

/**
 * @return {Object} the Promisified version of chrome.sockets.udp
 */
exports.getUdp = function() {
  return exports.getChromep().sockets.udp;
};

/**
 * @return {Object} the Promisified version of chrome.runtime
 */
exports.getRuntime = function() {
  return exports.getChromep().runtime;
};

/**
 * @return {chrome.runtime} the bare chrome.runtime object that has not been
 * wrapped by chrome-promise
 */
exports.getRuntimeBare = function() {
  return chrome.runtime;
};
