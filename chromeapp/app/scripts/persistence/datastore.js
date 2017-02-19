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

var chromep = require('../chrome-apis/chromep');
var fileSystem = require('./file-system');
var fsUtil = require('./file-system-util');
var serverApi = require('../server/server-api');

/** The number of characters output by Date.toISOString() */
var LENGTH_ISO_DATE_STR = 24;

var URL_DATE_DELIMITER = '_';

exports.MHTML_EXTENSION = '.mhtml';

exports.DEBUG = false;

/**
 * This object represents a page that is stored in the cache and can be browsed
 * to.
 *
 * @param {string} captureUrl the URL of the original captured page
 * @param {string} captureDate the ISO String representation of the datetime
 * @param {string} accessPath the path in the cache that can be used to access
 * the file the page was captured
 * @param {object} metadata an object stored and associated with the page.
 * Allows additional metadata to be stored, e.g. mime type, thumbnail, etc.
 * Must be safe to serialize via chrome.storage.local.set().
 */
exports.CachedPage = function CachedPage(
  captureUrl,
  captureDate,
  path,
  metadata
) {
  if (!(this instanceof CachedPage)) {
    throw new Error('CachedPage must be called with new');
  }
  this.captureUrl = captureUrl;
  this.captureDate = captureDate;
  this.accessPath = path;
  this.metadata = metadata;
};

/**
 * Write a page into the cache.
 *
 * @param {string} captureUrl the URL that generated the MHTML
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {Blob} mhtmlBlob the contents of hte page
 * @param {object} metadata metadata to store with the page
 *
 * @return {Promise} a Promise that resolves when the write is complete
 */
exports.addPageToCache = function(
  captureUrl, captureDate, mhtmlBlob, metadata
) {
  return new Promise(function(resolve, reject) {
    // Get the directory to write into
    // Create the file entry
    // Perform the write
    // We'll use a default empty object so that downstream APIs can always
    // assume to have a truthy opts value.
    metadata = metadata || {};
    var heldEntry = null;
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
      heldEntry = fileEntry;
      return fsUtil.writeToFile(fileEntry, mhtmlBlob);
    })
    .then(() => {
      // Save the metadata to storage.
      return exports.writeMetadataForEntry(heldEntry, metadata);
    })
    .then(() => {
      resolve(heldEntry);
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
      var getPagePromises = [];
      entries.forEach(entry => {
        var promise = exports.getEntryAsCachedPage(entry);
        getPagePromises.push(promise);
      });
      return Promise.all(getPagePromises);
    })
    .then(cachedPages => {
      resolve(cachedPages);
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
    fileSystem.getDirectoryForCacheEntries()
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
 * @return {Promise -> CachedPage} Promise that resolves with the CachedPage
 */
exports.getEntryAsCachedPage = function(entry) {
  // Retrieve the metadata from Chrome storage.
  return new Promise(function(resolve, reject) {
    var captureUrl = exports.getCaptureUrlFromName(entry.name);
    var captureDate = exports.getCaptureDateFromName(entry.name);
    var accessUrl = serverApi.getAccessUrlForCachedPage(entry.fullPath);

    exports.getMetadataForEntry(entry)
    .then(mdata => {
      var result = new exports.CachedPage(
        captureUrl, captureDate, accessUrl, mdata
      );
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Retrieve the metadata for the given file entry. This assumes that a
 * FileEntry is sufficient information to find the metadata in local storage,
 * e.g. that the name is the key.
 *
 * @param {FileEntry} entry 
 *
 * @return {Promise -> object} Promise that resolves with the metadata object
 */
exports.getMetadataForEntry = function(entry) {
  return new Promise(function(resolve, reject) {
    var key = exports.createMetadataKey(entry);
    chromep.getStorageLocal().get(key)
    .then(obj => {
      // The get API resolves with the key value pair in a single object,
      // e.g. get('foo') -> { foo: bar }.
      var result = {};
      if (obj && obj[key]) {
        result = obj[key];
      }
      if (exports.DEBUG) {
        console.log('querying for key: ', key);
        console.log('  get result: ', obj);
        console.log('  metadata: ', result);
      }
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Create the key that will store the metadata for this entry.
 *
 * @param {FileEntry} entry
 *
 * @return {string} the key to use to find the metadata in the datastore
 */
exports.createMetadataKey = function(entry) {
  var prefix = 'fileMdata_';
  return prefix + entry.name;
};

/**
 * Write the metadata object for the given entry.
 *
 * @param {FileEntry} entry file pertaining to the metadata
 * @param {object} metadata the metadata to write
 *
 * @return {Promise} Promise that resolves when the write is complete
 */
exports.writeMetadataForEntry = function(entry, metadata) {
  var key = exports.createMetadataKey(entry);
  var obj = {};
  obj[key] = metadata;
  return chromep.getStorageLocal().set(obj);
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
  return captureUrl +
    URL_DATE_DELIMITER +
    captureDate +
    exports.MHTML_EXTENSION;
};

/**
 * @param {string} name the name of the file
 *
 * @return {string} the capture url
 */
exports.getCaptureUrlFromName = function(name) {
  var nonNameLength = LENGTH_ISO_DATE_STR +
    URL_DATE_DELIMITER.length +
    exports.MHTML_EXTENSION.length;
  if (name.length < nonNameLength) {
    // The file name is too short, fail fast.
    throw new Error('name too short to store a url: ', name);
  }

  var result = name.substring(
    0,
    name.length - nonNameLength
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

  var dateStartIndex = name.length -
    LENGTH_ISO_DATE_STR -
    exports.MHTML_EXTENSION.length;
  var dateEndIndex = name.length - exports.MHTML_EXTENSION.length;

  var result = name.substring(dateStartIndex, dateEndIndex);
  return result;
};
