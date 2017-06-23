/* globals Promise */
'use strict';

const capture = require('../chrome-apis/page-capture');
const messaging = require('../app-bridge/messaging');
const tabs = require('../chrome-apis/tabs');
const util = require('../util/util');

const appUtil = require('../../../../chromeapp/app/scripts/util');
const CPDisk = require('../../../../chromeapp/app/scripts/persistence/objects').CPDisk;

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
exports.DEFAULT_SNAPSHOT_QUALITY = 50;

/**
 * Request the favicon url and return the resulting image as a data URL.
 *
 * @param {string} url the http URL of the favicon, as you would include in the
 * meta tag in the head of an HTML document
 *
 * @return {Promise.<string>} Promise that resolves with a data URL that is a
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
        return appUtil.getBlobAsDataUrl(blob);
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
 * Get a snapshot of the current window.
 *
 * @return {Promise.<string>} Promise that resolves with a data URL
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
 * Get the current tab MHTML as a Buffer.
 *
 * @param {Tab} tab
 *
 * @return {Promise.<Buffer>}
 */
exports.getMhtmlBuff = function(tab) {
  return capture.saveAsMHTML({ tabId: tab.id})
  .then(mhtmlBlob => {
    return appUtil.blobToBuffer(mhtmlBlob);
  })
  .then(buff => {
    return buff;
  });
};

/**
 * Save an MHTML page to the datastore.
 *
 * @param {string} from the component requesting the save
 * @param {Tab} tab Chrome Tab object that is being saved
 *
 * @return {Promise} a Promise that resolves when the save is complete or
 * rejects if the save fails.
 */
exports.saveTab = function(from, tab) {
  return new Promise(function(resolve, reject) {
    let params = {
      captureHref: tab.url,
      captureDate: exports.getDateForSave(),
      title: tab.title,
    };

    let promises = [
      exports.getFaviconAsUrl(tab.favIconUrl),
      exports.getSnapshotDataUrl(),
      exports.getMhtmlBuff(tab)
    ];

    Promise.all(promises)
    .then(([faviconUrl, snapshotUrl, mhtmlBuff]) => {
      params.favicon = faviconUrl;
      params.screenshot = snapshotUrl;
      params.mhtml = mhtmlBuff;
      let cpdisk = new CPDisk(params);
      let json = cpdisk.asJSON();

      return messaging.savePage(from, json);
    })
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};
