/* globals Promise */
'use strict';

/**
 * Abstractions for reading and writing cached pages. Clients of this class
 * should not be concerned with the underlying file system.
 */

// Overview of the Datastore
//
// For the time being, there is no separate database or datastore. All
// information is saved in the file name on disk, eg
// "www.example.com_date". This will serve for a prototype but might become
// limiting in the future.

var fileSystem = require('./file-system');
var fsUtil = require('./file-system-util');
var serverApi = require('../server/server-api');

/** The number of characters output by Date.toISOString() */
var LENGTH_ISO_DATE_STR = 24;

var URL_DATE_DELIMITER = '_';

/**
 * This object represents a page that is stored in the cache and can be browsed
 * to.
 *
 * @param {string} captureUrl the URL of the original captured page
 * @param {string} captureDate the ISO String representation of the datetime
 * @param {string} accessPath the path in the cache that can be used to access
 * the file the page was captured
 */
exports.CachedPage = function CachedPage(
  captureUrl,
  captureDate,
  path
) {
  if (!(this instanceof CachedPage)) {
    throw new Error('CachedPage must be called with new');
  }
  this.captureUrl = captureUrl;
  this.captureDate = captureDate;
  this.accessPath = path;
};

/**
 * Write a page into the cache.
 *
 * @param {string} captureUrl the URL that generated the MHTML
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {Blob} mhtmlBlob the contents of hte page
 *
 * @return {Promise} a Promise that resolves when the write is complete
 */
exports.addPageToCache = function(captureUrl, captureDate, mhtmlBlob) {
  return new Promise(function(resolve, reject) {
    // Get the directory to write into
    // Create the file entry
    // Perform the write
    fileSystem.getDirectoryForCacheEntries()
    .then(cacheDir => {
      var fileName = exports.createFileNameForPage(captureUrl, captureDate);
      var createOptions = {
        create: true,     // create if it doesn't exist
        exclusive: false  // OK if it already exists--will overwrite
      };
      return fsUtil.getFile(cacheDir, createOptions, fileName);
    })
    .then(fileEntry => {
      return fsUtil.writeToFile(fileEntry, mhtmlBlob);
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all the cached pages that are stored in the cache.
 *
 * @return {Promise} Promise that resolves with an Array of CachedPage objects
 */
exports.getAllCachedPages = function() {
  return new Promise(function(resolve, reject) {
    exports.getAllFileEntriesForPages()
    .then(entries => {
      var result = [];
      entries.forEach(entry => {
        var cachedPage = exports.getEntryAsCachedPage(entry);
        result.push(cachedPage);
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all the FileEntries representing saved pages.
 *
 * @return {Promise} Promise that resolves with an array of FileEntry objects
 */
exports.getAllFileEntriesForPages = function() {
  var flagDirNotSet = 1;
  return new Promise(function(resolve, reject) {
    fileSystem.getPersistedBaseDir()
    .then(dirEntry => {
      if (!dirEntry) {
        // We haven't set an entry.
        throw flagDirNotSet;
      }
      return fsUtil.listEntries(dirEntry);
    })
    .then(entries => {
      resolve(entries);
    })
    .catch(errFlag => {
      if (errFlag === flagDirNotSet) {
        reject('dir not set');
      } else {
        console.warn('unrecognized error flag: ', errFlag);
      }
    });
  });
};

/**
 * Convert an entry as represented on the file system to a CachedPage that can
 * be consumed by clients.
 *
 * This is the workhorse function for mapping between the two types.
 *
 * @param {FileEntry} entry
 *
 * @return {CachedPage}
 */
exports.getEntryAsCachedPage = function(entry) {
  var captureUrl = exports.getCaptureUrlFromName(entry.name);
  var captureDate = exports.getCaptureDateFromName(entry.name);
  var accessUrl = serverApi.getAccessUrlForCachedPage(entry.fullPath);

  var result = new exports.CachedPage(captureUrl, captureDate, accessUrl);
  return result;
};

/**
 * Create the file name for the cached page in a way that can later be parsed.
 *
 * @param {string} captureUrl
 * @param {string} captureDate the toISOString() representation of the date the
 * page was captured
 *
 * @return {string}
 */
exports.createFileNameForPage = function(captureUrl, captureDate) {
  return captureUrl + URL_DATE_DELIMITER + captureDate;
};

/**
 * @param {string} name the name of the file
 *
 * @return {string} the capture url
 */
exports.getCaptureUrlFromName = function(name) {
  // We expect file names to be stored as url_date, with an underscore
  // delimiting.
  if (name.length < LENGTH_ISO_DATE_STR + URL_DATE_DELIMITER.length) {
    // The file name is too short, fail fast.
    throw new Error('name too short to store a url: ', name);
  }

  var result = name.substring(
    0,
    name.length - LENGTH_ISO_DATE_STR - URL_DATE_DELIMITER.length
  );
  return result;
};

/**
 * @param {string} name the name of the file
 * 
 * @return {string} the capture date's ISO string representation
 */
exports.getCaptureDateFromName = function(name) {
  // The date is stored at the end of the string.
  if (name.length < LENGTH_ISO_DATE_STR) {
    // We've violated an invariant, fail fast.
    throw new Error('name too short to store a date: ', name);
  }

  var result = name.substring(name.length - LENGTH_ISO_DATE_STR, name.length);
  return result;
};
