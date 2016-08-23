'use strict';

var tabs = require('../chrome-apis/tabs');
var messaging = require('../app-bridge/messaging');

/**
 * Handles persisting data for the extension. For the time being we are relying
 * on the app to do most of the persisting, so this relies heavily on
 * messaging.
 */

exports.MIME_TYPE_MHTML = 'multipart/related';

/**
 * @param {Blob} blob
 *
 * @return {Promise} Promise that resolves with a data url string
 */
exports.getBlobAsDataUrl = function(blob) {
  return new Promise(function(resolve) {
    var reader = new window.FileReader();
    reader.onloadend = function() {
      var base64 = reader.result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * Get the string representation of this date moment.
 *
 * This exists to allow testing to mock out date creation.
 *
 * @return {string} ISO representation of this moment
 */
exports.getDateForSave = function() {
  var result = new Date().toISOString();
  return result;
};

/**
 * Return the URL from the string representation. fullUrl must begin with the
 * scheme (i.e. http:// or https://).
 *
 * @param {string} fullUrl
 *
 * @return {string}
 */
exports.getDomain = function(fullUrl) {
  // We will rely on the :// that occurs in the scheme to determine the start
  // of the domain.
  var colonLocation = fullUrl.indexOf(':');
  var domainStart = colonLocation + 3;  // exclude the colon and two slashes.

  // The end of the domain will be the least of /, ?, or # following the
  // domainStart.
  var urlWithoutScheme = fullUrl.substring(domainStart);
  var hashLocation = urlWithoutScheme.indexOf('#');
  var queryLocation = urlWithoutScheme.indexOf('?');
  var slashLocation = urlWithoutScheme.indexOf('/');
  
  // Account for the -1 returned if all these are absent.
  if (hashLocation === -1) { hashLocation = urlWithoutScheme.length; }
  if (queryLocation === -1) { queryLocation = urlWithoutScheme.length; }
  if (slashLocation === -1) { slashLocation = urlWithoutScheme.length; }

  var domainEnd = Math.min(hashLocation, queryLocation, slashLocation);

  var domain = urlWithoutScheme.substring(0, domainEnd);

  return domain;
};

/**
 * Create the metadata object that will be associated with the saved file.
 *
 * @param {string} fullUrl
 *
 * @return {Promise -> object} Promise that resolves with the metadata object
 */
exports.createMetadataForWrite = function(fullUrl) {
  // We include the full URL, a snapshot of the image, and a mime type.
  // var expected = {
  //   fullUrl: fullUrl,
  //   snapshot: snapshotUrl,
  //   mimeType: mimeType
  // };
  return new Promise(function(resolve) {
    exports.getSnapshotDataUrl()
      .then(snapshotUrl => {
        var result = {
          fullUrl: fullUrl,
          mimeType: exports.MIME_TYPE_MHTML
        };
        if (snapshotUrl && snapshotUrl !== '') {
          result.snapshot = snapshotUrl;
        }
        resolve(result);    
      });
  });
};

/**
 * Get a snapshot of the current window.
 *
 * @return {Promise -> string} Promise that resolves with a data URL
 * representing the jpeg snapshot.
 */
exports.getSnapshotDataUrl = function() {
  return tabs.captureVisibleTab();
};

/**
 * Save an MHTML page to the datastore.
 *
 * @param {string} tabUrl the full URL of the tab being saved
 * @param {blob} mhtmlBlob the mhtml blob as returned by chrome.pagecapture
 *
 * @return {Promise} a Promise that resolves when the save is complete
 */
exports.savePage = function(tabUrl, mhtmlBlob) {
  var fullUrl = tabUrl;
  var domain = exports.getDomain(tabUrl);
  var mhtmlDataUrl = exports.getBlobAsDataUrl(mhtmlBlob);
  var captureDate = exports.getDateForSave();

  return new Promise(function(resolve) {
    exports.createMetadataForWrite(fullUrl)
      .then(metadata => {
        messaging.savePage(domain, captureDate, mhtmlDataUrl, metadata);
        resolve();
      });
  });
};
