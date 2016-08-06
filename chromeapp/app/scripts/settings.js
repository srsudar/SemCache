/* global Promise */
'use strict';

var storage = require('./chrome-apis/storage');
var fileSystem = require('./persistence/file-system');
var chromefs = require('./chrome-apis/file-system');

/**
 * Settings for the application as a whole.
 */

// These are stored in chrome.storage. We could store a number of things in
// chrome.storage, not just settings. For this reason we are going to
// name-space our keys. E.g. callers will interact with settings like
// 'absPath', while the underlying key is stored as setting_absPath.

/** The prefix that we use to namespace setting keys. */
var SETTING_NAMESPACE_PREFIX = 'setting_';

exports.SETTINGS_OBJ = null;

var userFriendlyKeys = {
  absPath: 'absPath',
  instanceName: 'instanceName',
  baseDirId: 'baseDirId',
  baseDirPath: 'baseDirPath',
  serverPort: 'serverPort'
};

/**
 * Returns an array with all of the keys known to store settings.
 *
 * @return {Array<String>}
 */
exports.getAllSettingKeys = function() {
  return [
    exports.createNameSpacedKey(userFriendlyKeys.absPath),
    exports.createNameSpacedKey(userFriendlyKeys.instanceName),
    exports.createNameSpacedKey(userFriendlyKeys.baseDirId),
    exports.createNameSpacedKey(userFriendlyKeys.baseDirPath),
    exports.createNameSpacedKey(userFriendlyKeys.serverPort)
  ];
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
        var processedSettings = {};
        Object.keys(allKvPairs).forEach(rawKey => {
          // we're dealing with the raw keys here, e.g. setting_absPath
          var processedKey = exports.removeNameSpaceFromKey(rawKey);
          var value = allKvPairs[rawKey];
          processedSettings[processedKey] = value;
        });
        exports.SETTINGS_OBJ = processedSettings;
        resolve(processedSettings);
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

/**
 * @return {string} the absolute path to the base directory.
 */
exports.getAbsPath = function() {
  return exports.get(userFriendlyKeys.absPath);
};

/**
 * @return {string} the user-defined name of the cache instance
 */
exports.getInstanceName = function() {
  return exports.get(userFriendlyKeys.instanceName);
};

/**
 * @return {string} the string used to retain the base directory as returned by
 * chrome.fileSystem.retainEntry
 */
exports.getBaseDirId = function() {
  return exports.get(userFriendlyKeys.baseDirId);
};

/**
 * @return {string} the cached path of the DirectoryEntry. Note that this is
 * NOT the absolute path, which must be entered separately by the user.
 */
exports.getBaseDirPath = function() {
  return exports.get(userFriendlyKeys.baseDirPath);
};

/**
 * @return {interger} the value the user has specified for the server port
 * (temporary)
 */
exports.getServerPort = function() {
  return exports.get(userFriendlyKeys.serverPort);
};

/**
 * @param {string} path the absolute path to the base directory of SemCache,
 * which unfortunately cannot be determined via an API
 */
exports.setAbsPath = function(path) {
  return exports.set(userFriendlyKeys.absPath, path);
};

/**
 * @param {string} instanceName the user-friendly name for the SemCache
 * instance
 */
exports.setInstanceName = function(instanceName) {
  return exports.set(userFriendlyKeys.instanceName, instanceName);
};

/**
 * @param {string} retainedId the String ID that can be used to restore the
 * DirectoryEntry where SemCache is mounted, as returned by
 * chrome.fileSystem.retainEntry
 */
exports.setBaseDirId = function(baseDirId) {
  return exports.set(userFriendlyKeys.baseDirId, baseDirId);
};

/**
 * @param {string} baseDirPath the path of the base directory as returned by
 * the entry itself, used to give a user-friendly path
 */
exports.setBaseDirPath = function(baseDirPath) {
  return exports.set(userFriendlyKeys.baseDirPath, baseDirPath);
};

/**
 * @param {integer} port the port where the server listens for HTTP connections
 * (temporary)
 */
exports.setServerPort = function(port) {
  return exports.set(userFriendlyKeys.serverPort, port);
};

/**
 * Prompt for and set a new base directory of the SemCache file system. It
 * persists both the ID and path.
 *
 * @return {Promise} Promise that resolves with an object like the following:
 * {
 *   baseDirId: '',
 *   baseDirPath: ''
 * }
 */
exports.promptAndSetNewBaseDir = function() {
  return new Promise(function(resolve) {
    var dirId;
    fileSystem.promptForDir()
    .then(dirEntry => {
      if (!dirEntry) {
        // Likely canceled
        console.log('No dir entry chosen');
        return;
      }
      console.log('FULL PATH: ', dirEntry.fullPath);
      fileSystem.setBaseCacheDir(dirEntry);
      dirId = chromefs.retainEntrySync(dirEntry);
      exports.setBaseDirId(dirId);
      // Set the ID
      return chromefs.getDisplayPath(dirEntry);
    })
    .then(displayPath => {
      // Set display path
      exports.setBaseDirPath(displayPath);
      resolve(
        {
          baseDirId: dirId,
          baseDirPath: displayPath
        }
      );
    });
  });
};
