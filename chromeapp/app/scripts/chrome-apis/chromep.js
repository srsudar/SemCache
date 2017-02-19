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
 * @return {object} the Promisified version of chrome.fileSystem
 */
exports.getFileSystem = function() {
  return CHROMEP_SINGLETON.fileSystem;
};

/**
 * @return {object} the Promisified version of chrome.storage.local
 */
exports.getStorageLocal = function() {
  return CHROMEP_SINGLETON.storage.local;
};

/**
 * @return {object} the Promisified version of chrome.sockets.udp
 */
exports.getUdp = function() {
  return CHROMEP_SINGLETON.sockets.udp;
};

/**
 * @return {object} the Promisified version of chrome.runtime
 */
exports.getRuntime = function() {
  return CHROMEP_SINGLETON.sockets.udp;
};
