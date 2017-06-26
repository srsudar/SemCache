'use strict';

/**
 * Data is stored both in a database (via the database module) and on disk. The
 * datastore is the API access point to modules interested in persistence. They
 * should not need any other classes.
 *
 * A 'CachedPage' is the fundamental unit.
 */

const database = require('./database');
const fileSystem = require('./file-system');
const fsUtil = require('./file-system-util');
const sanitize = require('sanitize-filename');
const URI = require('urijs');
const util = require('../util');

const URL_DATE_DELIMITER = '_';

exports.MHTML_EXTENSION = '.mhtml';

exports.DEBUG = false;

/**
 * Add a page to the cache. Updates internal data structures and writes the
 * page to disk.
 *
 * @param {CPDisk} cpdisk the page to add to the cache. If
 * canBePersisted() returns false, will reject with an Error.
 *
 * @return {Promise.<FileEntry, Error>} a Promise that resolves when the write
 * is complete.
 */
exports.addPageToCache = function(cpdisk) {
  return new Promise(function(resolve, reject) {
    let fileName = exports.createFileNameForPage(
      cpdisk.captureHref,
      cpdisk.captureDate
    );
    cpdisk.filePath = fileName;

    let heldEntry = null;
    database.addPageToDb(cpdisk)
    .then(() => {
      return fileSystem.getFileForWritingCachedPage(cpdisk.filePath);
    })
    .then(fileEntry => {
      heldEntry = fileEntry;
      return fsUtil.writeToFile(fileEntry, cpdisk.mhtml);
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
 * Return an array of CPDisk objects for an Array of hrefs.
 * @param {string|Array.<string>} hrefs
 *
 * @return {Promise.<Array.<CPDisk>, Error>}
 */
exports.getCPDiskForHrefs = function(hrefs) {
  return new Promise(function(resolve, reject) {
    hrefs = util.toArray(hrefs);

    // Read the data from the database, then populate the mhtml properties.
    let cpsummaries = null;
    database.getCPSummariesForHrefs(hrefs)
    .then(summariesFromDb => {
      cpsummaries = summariesFromDb;
      let readFilePromises = cpsummaries.map(cpsummary => {
        return fileSystem.getFileContentsFromName(cpsummary.filePath);
      });
      return Promise.all(readFilePromises);
    })
    .then(mhtmls => {
      if (cpsummaries.length !== mhtmls.length) {
        throw new Error('different numbers of file contents from requests');
      }
      let result = cpsummaries.map((summary, i) => {
        return summary.asCPDisk(mhtmls[i]);
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {integer} offset
 * @param {integer} numDesired
 *
 * @return {Promise.<Array.<CPSummary>, Error>}
 */
exports.getCachedPageSummaries = function(offset, numDesired) {
  return database.getCachedPageSummaries(offset, numDesired);
};


/**
 * Get all the cached pages that are stored in the cache.
 *
 * @return {Promise.<Array.<CPInfo>, Error>} Promise that resolves with an
 * Array of CPInfo objects
 */
exports.getAllCachedPages = function() {
  return database.getAllCPInfos();
};

/**
 * Create the file name for the cached page in a way that can later be parsed.
 *
 * @param {string} href
 * @param {string} captureDate the toISOString() representation of the date the
 * page was captured
 *
 * @return {string}
 */
exports.createFileNameForPage = function(href, captureDate) {
  let uri = URI(href);
  let raw = [
    uri.hostname(), URL_DATE_DELIMITER, captureDate, exports.MHTML_EXTENSION
  ].join('');
  let result = sanitize(raw);
  return result;
};
