'use strict';

var util = require('./util');

/**
 * This module provides a wrapper around the chrome.storage.local API and
 * provides an alternative based on Promises.
 */

/**
 * @param {string|Array<string>} keyOrKeys
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an object of
 * key value mappings or rejects with an Error
 */
exports.get = function(keyOrKeys) {
  return new Promise(function(resolve, reject) {
    util.getStorageLocal().get(keyOrKeys, function(items) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(items);
      }
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 *
 * @return {Promise.<Integer, Error>} Promise that resolves with an integer of
 * the number of bytes in use for the given key or keys, or rejects with an
 * Error
 */
exports.getBytesInUse = function(keyOrKeys) {
  return new Promise(function(resolve, reject) {
    util.getStorageLocal().getBytesInUse(keyOrKeys, function(numBytes) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(numBytes);
      }
    });
  });
};

/**
 * @param {object} items an object of key value mappings
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when the
 * operation completes or rejects with an Error
 */
exports.set = function(items) {
  return new Promise(function(resolve, reject) {
    util.getStorageLocal().set(items, function() {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve();
      }
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when the
 * operation completes
 */
exports.remove = function(keyOrKeys) {
  return new Promise(function(resolve, reject) {
    util.getStorageLocal().remove(keyOrKeys, function() {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve();
      }
    });
  });
};

/**
 * @return {Promise.<undefined, Error>} Promise that resolves when the
 * operation completes
 */
exports.clear = function() {
  return new Promise(function(resolve, reject) {
    util.getStorageLocal().clear(function() {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve();
      }
    });
  });
};
