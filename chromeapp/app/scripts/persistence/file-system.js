'use strict';

/**
 * This module provides an API to interact with our file system backing
 * SemCache. It does not provide general purpose file system manipulation;
 * rather it provides things like "get the directory where we save pages", "get
 * the contents of a cached page", etc.
 */

const chromep = require('../chrome-apis/chromep');
const fsUtil = require('./file-system-util');


/** The local storage key for the entry ID of the base directory. */
exports.KEY_BASE_DIR = 'baseDir';

/** 
 * The path of the directory storing the cache entries relative to the root of
 * the storage directory. Begins with './'.
 */
exports.PATH_CACHE_DIR = 'cacheEntries';

/**
 * Construct the file scheme URL where the file can be access.
 *
 * @param {string} absPathToBaseDir the absolute path on the local file system
 * to the base directory of SemCache. e.g. /path/from/root/to/semcachedir.
 * @param {string} fileEntryPath the path as returned by fullPath on a
 * FileEntry object. It must live in the SemCache directory and should begin
 * with semcachedir
 *
 * @return {string} an absolute file scheme where the file can be accessed
 */
exports.constructFileSchemeUrl = function(absPathToBaseDir, fileEntryPath) {
  // fileEntry.fullPath treats the root of the file system as the parent
  // directory of the base directory. Therefore if we've selected 'semcachedir'
  // as the root of our file system, fullPath will always begin with
  // '/semcachedir/'. We still start by stripping this.
  let parts = fileEntryPath.split('/');
  // The first will be an empty string for the leading /. We'll start at index
  // 2 to skip this and skip the leading directory.
  let sanitizedEntryPath = parts.slice(2).join('/');
  // only file:/, not file://, as join adds one
  return ['file:/', absPathToBaseDir, sanitizedEntryPath].join('/');
};

/**
 * Get the directory where cache entries are stored.
 *
 * @return {Promise.<DirectoryEntry, Error>} Promise that resolves with a
 * DirectoryEntry that is the base cache directory. Rejects if the base
 * directory has not been set.
 */
exports.getDirectoryForCacheEntries = function() {
  return new Promise(function(resolve, reject) {
    exports.getPersistedBaseDir()
    .then(baseDir => {
      let dirName = exports.PATH_CACHE_DIR;
      let options = {
        create: true,
        exclusive: false
      };
      return fsUtil.getDirectory(baseDir, options, dirName);
    })
    .then(cacheDir => {
      resolve(cacheDir);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {string} filePath the file path relative to the directory where
 * cached pages are stored.
 *
 * @return {Promise<FileEntry, Error>} Promise that resolves with a FileEntry
 * at the location specified by filePath. The FileEntry will be created if it
 * is not present.
 */
exports.getFileForWritingCachedPage = function(filePath) {
  return exports.getDirectoryForCacheEntries()
  .then(cacheDir => {
    let createOptions = {
      create: true,     // create if it doesn't exist
      exclusive: false  // OK if it already exists--will overwrite
    };
    console.log(cacheDir);
    console.log(createOptions);
    console.log(filePath);
    return fsUtil.getFile(cacheDir, createOptions, filePath);
  });
};

/**
 * Return the base directory behaving as the root of the SemCache file system.
 * This returns the "persisted" base directory in the sense that the directory
 * must have already been chosen via a file chooser. If a base directory has
 * not been chosen, it will return null.
 *
 * @return {Promise.<DirectoryEntry, Error>} Promise that resolves with the
 * DirectoryEntry that has been set as the root of the SemCache file system.
 * Resolves null if the directory has not been set.
 */
exports.getPersistedBaseDir = function() {
  return new Promise(function(resolve, reject) {
    exports.baseDirIsSet()
    .then(isSet => {
      if (isSet) {
        chromep.getStorageLocal().get(exports.KEY_BASE_DIR)
        .then(keyValue => {
          let id = keyValue[exports.KEY_BASE_DIR];
          return chromep.getFileSystem().restoreEntry(id);
        })
        .then(dirEntry => {
          resolve(dirEntry);
        });
      } else {
        // Null if not set.
        resolve(null);
      }
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @return {Promise.<boolean, Error>} Promise that resolves with a boolean
 */
exports.baseDirIsSet = function() {
  return new Promise(function(resolve, reject) {
    chromep.getStorageLocal().get(exports.KEY_BASE_DIR)
    .then(keyValue => {
      let isSet = false;
      if (keyValue && keyValue[exports.KEY_BASE_DIR]) {
        isSet = true;
      }
      resolve(isSet);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Set an entry as the base directory to be used for the SemCache file system.
 *
 * @param {DirectoryEntry} dirEntry the entry that will be set as the base
 */
exports.setBaseCacheDir = function(dirEntry) {
  let keyObj = {};
  let id = chromep.getFileSystem().retainEntry(dirEntry);
  keyObj[exports.KEY_BASE_DIR] = id;
  console.log('going to call set');
  chromep.getStorageLocal().set(keyObj);
};

/**
 * Prompt the user to choose a directory.
 *
 * @return {Promise.<DirectoryEntry, Error>} a promise that resolves with a
 * DirectoryEntry that has been chosen by the user.
 */
exports.promptForDir = function() {
  return new Promise(function(resolve, reject) {
    chromep.getFileSystem().chooseEntry({type: 'openDirectory'})
    .then(entry => {
      resolve(entry);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Retrieve the binary contents of the file at the specified fileName.
 *
 * @param {String} fileName the name of the file
 *
 * @return {Promise.<Buffer, Error>} Promise that resolves with a Buffer
 * containing the contents of the file or rejects with an Error
 */
exports.getFileContentsFromName = function(fileName) {
  return new Promise(function(resolve, reject) {
    exports.getDirectoryForCacheEntries()
    .then(cacheDir => {
      return fsUtil.getFile(
        cacheDir,
        {
          create: false,
          exclusive: false
        },
        fileName
      );
    })
    .then(fileEntry => {
      return fsUtil.getFileContents(fileEntry);
    })
    .then(buff => {
      resolve(buff);
    })
    .catch(err => {
      reject(err);
    });
  });
};
