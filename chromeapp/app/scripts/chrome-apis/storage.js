/* globals Promise, chrome */
'use strict';

/**
 * This module provides a wrapper around the chrome.storage.local API and
 * provides an alternative based on Promises.
 */

/**
 * @param {boolean} useSync
 *
 * @return {StorageArea} chrome.storage.sync or chrome.storage.local depending
 * on the value of useSync
 */
function getStorageArea(useSync) {
  if (useSync) {
    return chrome.storage.sync;
  } else {
    return chrome.storage.local;
  }
}

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves with an object of key value mappings
 */
exports.get = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.get(keyOrKeys, function(items) {
      resolve(items);
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves with an integer of the number of
 * bytes in use for the given key or keys
 */
exports.getBytesInUse = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.getBytesInUse(keyOrKeys, function(numBytes) {
      resolve(numBytes);
    });
  });
};

/**
 * @param {object} items an object of key value mappings
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.set = function(items, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.set(items, function() {
      resolve();
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.remove = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.remove(keyOrKeys, function() {
      resolve();
    });
  });
};

/**
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.clear = function(useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.clear(function() {
      resolve();
    });
  });
};
