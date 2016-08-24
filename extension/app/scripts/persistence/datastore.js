/* globals Promise */
'use strict';

var tabs = require('../chrome-apis/tabs');
var messaging = require('../app-bridge/messaging');
var util = require('../util');

/**
 * Handles persisting data for the extension. For the time being we are relying
 * on the app to do most of the persisting, so this relies heavily on
 * messaging.
 */

exports.MIME_TYPE_MHTML = 'multipart/related';

/**
 * The default quality score to pass to chrome.tabs.captureVisibleTab. Docs are
 * sparse, but this assumes lower is worse.
 */
exports.DEFAULT_SNAPSHOT_QUALITY = 5;

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
 * Request the favicon url and return the resulting image as a data URL.
 *
 * @param {string} url the http URL of the favicon, as you would include in the
 * meta tag in the head of an HTML document
 *
 * @return {Promise -> string} Promise that resolves with a data URL that is a
 * string representation of the favicon. If fetch rejects it logs the error and
 * rejects with an empty string.
 */
exports.getFaviconAsUrl = function(url) {
  if (!url || url === '') {
    // The chrome.tabs API doesn't guarantee the existence of the favicon URL
    // property. Fail gracefully.
    return Promise.resolve('');
  }
  return new Promise(function(resolve, reject) {
    util.fetch(url)
      .then(resp => {
        return resp.blob();
      })
      .then(blob => {
        return exports.getBlobAsDataUrl(blob);
      })
      .then(dataUrl => {
        resolve(dataUrl);
      })
      .catch(err => {
        console.log(err);
        reject('');
      });
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
 * @param {Tab} tab the Chrome Tab object to save
 *
 * @return {Promise -> object} Promise that resolves with the metadata object
 */
exports.createMetadataForWrite = function(tab) {
  // We include the full URL, a snapshot of the image, and a mime type.
  // var expected = {
  //   fullUrl: fullUrl,
  //   snapshot: snapshotUrl,
  //   mimeType: mimeType,
  //   favicon: faviconUrl,
  //   title: title
  // };
  return new Promise(function(resolve) {
    var result = {
      fullUrl: tab.url,
      mimeType: exports.MIME_TYPE_MHTML,
      title: tab.title
    };
    exports.getSnapshotDataUrl()
      .then(snapshotUrl => {
        if (snapshotUrl && snapshotUrl !== '') {
          result.snapshot = snapshotUrl;
        }
      })
      .then(() => {
        return exports.getFaviconAsUrl(tab.favIconUrl);
      })
      .then(faviconDataUrl => {
        if (faviconDataUrl && faviconDataUrl !== '') {
          result.favicon = faviconDataUrl;
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
  // We are going to ask for a low quality image, as are just after thumbnail
  // and nothing more.
  var jpegQuality = exports.DEFAULT_SNAPSHOT_QUALITY;
  var options = { quality: jpegQuality };
  return tabs.captureVisibleTab(null, options);
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
  var captureDate = exports.getDateForSave();

  return new Promise(function(resolve) {
    var mhtmlDataUrl = null;
    exports.getBlobAsDataUrl(mhtmlBlob)
      .then(dataUrl => {
        mhtmlDataUrl = dataUrl;
        return exports.createMetadataForWrite(fullUrl);
      })
      .then(metadata => {
        messaging.savePage(domain, captureDate, mhtmlDataUrl, metadata);
        resolve();
      });
  });
};
