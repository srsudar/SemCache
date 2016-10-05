/* globals Promise, chrome */
'use strict';

/**
 * This module provides a wrapper around the callback-heavy chrome.fileSystem
 * API and provides an alternative based on Promises.
 */

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with the display path
 */
exports.getDisplayPath = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.getDisplayPath(entry, function(displayPath) {
      resolve(displayPath);
    });
  });
};

/**
 * @param {Entry} entry the starting entry that will serve as the base for a
 * writable entry
 *
 * @return {Promise} Promise that resolves with a writable entry
 */
exports.getWritableEntry = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.getWritableEntry(entry, function(writableEntry) {
      resolve(writableEntry);
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with a boolean
 */
exports.isWritableEntry = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.isWritableEntry(entry, function(isWritable) {
      resolve(isWritable);
    });
  });
};

/**
 * The original Chrome callback takes two parameters: an entry and an array of
 * FileEntries. No examples appear to make use of this second parameter,
 * however, nor is it documented what the second parameter is for. For this
 * reason we return only the first parameter, but callers should be aware of
 * this difference compared to the original API.
 *
 * @param {object} options
 *
 * @return {Promise} Promise that resolves with an Entry
 */
exports.chooseEntry = function(options) {
  return new Promise(function(resolve) {
    chrome.fileSystem.chooseEntry(options, function(entry, arr) {
      if (arr) {
        console.warn(
          'chrome.fileSystem.chooseEntry callback invoked with a 2nd ' +
            'parameter that is being ignored: ',
            arr);
      }
      resolve(entry);
    });
  });
};

/**
 * @param {string} id id of a previous entry
 *
 * @return {Promise} Promise that resolves with an Entry
 */
exports.restoreEntry = function(id) {
  return new Promise(function(resolve) {
    chrome.fileSystem.restoreEntry(id, function(entry) {
      resolve(entry);
    });
  });
};

/**
 * @param {string} id
 *
 * @return {Promise} Promise that resolves with a boolean
 */
exports.isRestorable = function(id) {
  return new Promise(function(resolve) {
    chrome.fileSystem.isRestorable(id, function(isRestorable) {
      resolve(isRestorable);
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with a string id that can be used to
 * restore the Entry in the future. The underlying Chrome API is a synchronous
 * call, but this is provided as a Promise to keep API parity with the rest of
 * the module. A synchronous version is provided via retainEntrySync.
 */
exports.retainEntry = function(entry) {
  var id = chrome.fileSystem.retainEntry(entry);
  return Promise.resolve(id);
};

/**
 * @param {Entry} entry
 *
 * @return {string} id that can be used to restore the Entry
 */
exports.retainEntrySync = function(entry) {
  return chrome.fileSystem.retainEntry(entry);
};

/**
 * @param {object} options
 *
 * @return {Promise} Promise that resolves with a FileSystem
 */
exports.requestFileSystem = function(options) {
  return new Promise(function(resolve) {
    chrome.fileSystem.requestFileSystem(options, function(fileSystem) {
      resolve(fileSystem);
    });
  });
};

/**
 * @return {Promise} Promise that resolves with a FileSystem
 */
exports.getVolumeList = function() {
  return new Promise(function(resolve) {
    chrome.fileSystem.getVolumeList(function(fileSystem) {
      resolve(fileSystem);
    });
  });
};
