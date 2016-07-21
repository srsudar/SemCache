'use strict';
// Abstractions for write/read cached page operations that shouldn't care
// about the file system.

/**
 * 
 */
exports.getAllCachedPages = function() {

};

/**
 * This object represents a page that is stored in the cache and can be browsed
 * to.
 *
 * @param {string} captureUrl the URL of the original captured page
 * @param {string} path the path in the cache that can be used to access the
 * file
 * @param {string} captureDate the ISO String representation of the datetime
 * the page was captured
 */
exports.CachedPage = function CachedPage(
  captureUrl,
  path,
  captureDate
) {
  this.captureUrl = captureUrl;
  this.path = path;
  this.captureDate = captureDate;
};

/**
 * Convert and entry as represented on the file system to a CachedPage that can
 * be consumed by clients.
 *
 * @param {FileEntry} entry
 *
 * @return {CachedPage}
 */
exports.getEntryAsCachedPage = function(entry) {
  console.log('Unimplemented: ', entry);
};

