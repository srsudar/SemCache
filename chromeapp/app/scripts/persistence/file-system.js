/*jshint esnext:true*/
/* globals Promise */
'use strict';

var chromefs = require('./chromeFileSystem');
var chromeStorage = require('./chromeStorage');

/** The local storage key for the entry ID of the base directory. */
exports.KEY_BASE_DIR = 'baseDir';

/**
 * Return the base directory behaving as the root of the SemCache file system.
 * This returns the "persisted" base directory in the sense that the directory
 * must have already been chosen via a file chooser. If a base directory has
 * not been chosen, it will return null.
 *
 * @return {DirectoryEntry} the directory that has been set as the root of the
 * SemCache file system. Returns null if the directory has not been set.
 */
exports.getPersistedBaseDir = function() {

};

/**
 * @return {Promise} Promise that resolves with a boolean
 */
exports.baseDirIsSet = function() {
  return new Promise(function(resolve) {
    chromeStorage.get(exports.KEY_BASE_DIR)
    .then(keyValue => {
      var isSet = false;
      if (keyValue && keyValue[exports.KEY_BASE_DIR]) {
        isSet = true;
      }
      resolve(isSet);
    });
  });
};

/**
 * Set an entry as the base directory to be used for the SemCache file system.
 *
 * @param {DirectoryEntry} dirEntry the entry that will be set as the base
 */
exports.setBaseCacheDir = function(dirEntry) {
  var keyObj = {};
  var id = chromefs.retainEntrySync(dirEntry);
  keyObj[exports.KEY_BASE_DIR] = id;
  chromeStorage.set(keyObj);
};

/**
 * Prompt the user to choose a directory.
 *
 * @return {Promise} a promise that resolves with a DirectoryEntry that has
 * been chosen by the user.
 */
exports.promptForDir = function() {
  return new Promise(function(resolve) {
    chromefs.chooseEntry({type: 'openDirectory'})
    .then(entry => {
      resolve(entry);
    });
  });
};
