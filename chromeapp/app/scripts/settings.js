'use strict';

var storage = require('./chrome-apis/storage');

/**
 * Settings for the application as a whole.
 */

// These are stored in chrome.storage. We could store a number of things in
// chrome.storage, not just settings. For this reason we are going to
// name-space our keys. E.g. callers will interact with settings like
// 'absPath', while the underlying key is stored as setting_absPath.

/** The prefix that we use to namespace setting keys. */
var SETTING_NAMESPACE_PREFIX = 'setting_';

var SETTINGS_KEYS = {
  absPath: 'setting_absPath',
  instanceName: 'setting_instanceName',
  baseDir: 'setting_baseDir',
  serverPort: 'setting_serverPort'
};

exports.SETTINGS_OBJ = null;

/**
 * Returns an array with all of the keys known to store settings.
 *
 * @return {Array<String>}
 */
exports.getAllSettingKeys = function() {
  return [SETTINGS_KEYS];
};

/**
 * The prefix we use for keys that belong to settings in chrome.storage.
 * Callers will not need to consume this API.
 *
 * @return {string}
 */
exports.getNameSpacePrefix = function() {
  return SETTING_NAMESPACE_PREFIX;
};

/**
 * Return an object that is a cache of the system-wide settings.
 */
exports.getSettingsObj = function() {
  return exports.SETTINGS_OBJ;
};

/**
 * Initialize the cache of settings objects. After this call, getSettingsObj()
 * will return with the cached value.
 *
 * @return {Promise} Promise that resolves with the newly-initialized cache
 */
exports.init = function() {
  // Get all the known settings
  return new Promise(function(resolve) {
    storage.get(exports.getAllSettingKeys())
      .then(allKvPairs => {
        // TODO: finish implementing
        // only those kv pairs prefixed with settings_ are valid.
        console.log(allKvPairs);
        resolve(null);
      });
  });

};

/**
 * Set the value in local storage and in the settings cache maintained by this
 * object.
 *
 * @return {Promise} Promise that resolves with the current settings object
 * after the set completes
 */
exports.set = function(key, value) {
  var namespacedKey = exports.createNameSpacedKey(key);
  var kvPair = {};
  kvPair[namespacedKey] = value;
  var useSync = false;

  return new Promise(function(resolve) {
    storage.set(kvPair, useSync)
      .then(() => {
        exports.SETTINGS_OBJ[key] = value;        
        // Now that the set has succeeded, update the cache of settings.
        resolve(exports.getSettingsObj());
      });
  });
};

/**
 * Return the name-spaced key that is the value stored in chrome.storage.
 *
 * @return {string}
 */
exports.createNameSpacedKey = function(key) {
  var result = exports.getNameSpacePrefix() + key;
  return result;
};

/**
 * Remove the namespacing from the key. Undoes the work done by
 * exports.createNameSpacedKey.
 *
 * @param {string} key a key as namespaced by createNameSpacedKey()
 *
 * @return {string} the de-namespaced key ready to be user-facing
 */
exports.removeNameSpaceFromKey = function(key) {
  if (!key.startsWith(exports.getNameSpacePrefix())) {
    throw new Error('key was not namespaced: ', key);
  }
  return key.substr(exports.getNameSpacePrefix().length);
};

/**
 * Return the current value of the key. This is retrieved from the cache, and
 * thus is synchronous. It requires that init() has been called to populate the
 * cache.
 *
 * @return {any} the value in the settings obj, or null if it hasn't been set
 */
exports.get = function(key) {
  var settingsObj = exports.getSettingsObj();
  if (!settingsObj) {
    console.warn('Settings object not initialized, returning null');
    return null;
  }
  var settings = exports.getSettingsObj();
  if (!settings.hasOwnProperty(key)) {
    return null;
  } else {
    var result = settings[key];
    return result;
  }
};
