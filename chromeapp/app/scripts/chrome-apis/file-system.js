'use strict';

var util = require('./util');

/**
 * This module provides a wrapper around the callback-heavy util.getFileSystem()
 * API and provides an alternative based on Promises.
 */

/**
 * @param {Entry} entry
 *
 * @return {Promise.<String, Error}} Promise that resolves with the display
 * path or rejects with an Error
 */
exports.getDisplayPath = function() {
  console.log('in getdisplaypath');
  console.log(arguments);
  var fn = util.getFileSystem().getDisplayPath;
  console.log('fn: ', fn);
  return util.applyArgsCheckLastError(
    fn, arguments
  );
  // return new Promise(function(resolve, reject) {
  //   util.getFileSystem().getDisplayPath(entry, function(displayPath) {
  //     if (util.wasError()) {
  //       reject(util.getError());
  //     } else {
  //       resolve(displayPath);
  //     }
  //   });
  // });
};

/**
 * @param {Entry} entry the starting entry that will serve as the base for a
 * writable entry
 *
 * @return {Promise.<Entry, Error>} Promise that resolves with a writable entry
 * or rejects with an Error
 */
exports.getWritableEntry = function(entry) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().getWritableEntry(entry, function(writableEntry) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(writableEntry);
      }
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise.<boolean, Error>} Promise that resolves with a boolean or
 * rejects with an Erorr
 */
exports.isWritableEntry = function(entry) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().isWritableEntry(entry, function(isWritable) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(isWritable);
      }
    });
  });
};

/**
 * @param {object} options
 *
 * @return {Promise.<Entry, Error>} Promise that resolves with an Entry or
 * rejects with an Error. The original Chrome callback takes two parameters: an
 * entry and an array of FileEntries. No examples appear to make use of this
 * second parameter, however, nor is it documented what the second parameter is
 * for. For this reason we return only the first parameter, but callers should
 * be aware of this difference compared to the original API.
 */
exports.chooseEntry = function(options) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().chooseEntry(options, function(entry, arr) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        if (arr) {
          console.warn(
            'util.getFileSystem().chooseEntry callback invoked with a 2nd ' +
            'parameter that is being ignored: ',
            arr
          );
        }
        resolve(entry);
      }
    });
  });
};

/**
 * @param {string} id id of a previous entry
 *
 * @return {Promise} Promise that resolves with an Entry
 */
exports.restoreEntry = function(id) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().restoreEntry(id, function(entry) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(entry);
      }
    });
  });
};

/**
 * @param {string} id
 *
 * @return {Promise.<boolean, Error>} Promise that resolves with a boolean or
 * rejects with an Error
 */
exports.isRestorable = function(id) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().isRestorable(id, function(isRestorable) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(isRestorable);
      }
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise.<String>} Promise that resolves with a string id that can
 * be used to restore the Entry in the future. The underlying Chrome API is a
 * synchronous call, but this is provided as a Promise to keep API parity with
 * the rest of the module. A synchronous version is provided via
 * retainEntrySync.
 */
exports.retainEntry = function(entry) {
  var id = util.getFileSystem().retainEntry(entry);
  return Promise.resolve(id);
};

/**
 * @param {Entry} entry
 *
 * @return {string} id that can be used to restore the Entry
 */
exports.retainEntrySync = function(entry) {
  return util.getFileSystem().retainEntry(entry);
};

/**
 * @param {object} options
 *
 * @return {Promise.<FileSystem, Error>} Promise that resolves with a
 * FileSystem or rejects with an Error
 */
exports.requestFileSystem = function(options) {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().requestFileSystem(options, function(fileSystem) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(fileSystem);
      }
    });
  });
};

/**
 * @return {Promise.<Array<Volume>, Error>} Promise that resolves with a
 * an Array of Volumes or rejects with an Error
 */
exports.getVolumeList = function() {
  return new Promise(function(resolve, reject) {
    util.getFileSystem().getVolumeList(function(fileSystem) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(fileSystem);
      }
    });
  });
};
