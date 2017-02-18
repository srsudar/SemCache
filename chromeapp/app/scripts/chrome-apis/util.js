/* globals chrome */
'use strict';

/**
 * Very lightweight utility class relating to the chrome apis.
 */

/**
 * @return {boolean} true if chrome.runtime.lastError is set, else false
 */
exports.wasError = function() {
  if (chrome.runtime.lastError) {
    return true;
  } else {
    return false;
  }
};

/**
 * @return {string} the value of chrome.runtime.lastError. Does not guarantee
 * that this value is set.
 */
exports.getError = function() {
  return chrome.runtime.lastError;
};

/**
 * @returns {filesystem} returns the chrome.filesystem object.
 */
exports.getFileSystem = function() {
  return chrome.fileSystem;
};

/**
 * @returns {StorageArea} chrome.storage.local
 */
exports.getStorageLocal = function() {
  return chrome.storage.local;
};
