'use strict';

const appMsg = require('../app-bridge/messaging');
const util = require('../util/util');


let localPageInfo = null;

/**
 * Return the local CachedPage object. This will have been retrieved from the
 * app. It exists here solely to be cached locally.
 *
 * @return {CachedPage|null} null if the query has not been performed or if the
 * page is not available
 */
exports.getLocalCachedPage = function() {
  return localPageInfo;
};

/**
 * Handler for internal (to the Extension) messages. Should be added via
 * runtime.onMessage.addListener.
 *
 * @param {any} message message from the sender
 * @param {MessageSender} sender
 * @param {function} callback
 */
exports.onMessageHandler = function(message, sender, callback) {
  if (message.type === 'readystateComplete') {
    exports.handleLoadMessage(message, sender, callback);
    return true;
  } else if (message.type === 'queryResult') {
    exports.handleQueryResultMessage(message, sender, callback);
    return false;
  } else if (message.from === 'popup' && message.type === 'queryForPage') {
    exports.handleQueryFromPopup(message, sender, callback);
    return true;
  }
};

exports.handleQueryFromPopup = function(message, sender, callback) {
  callback(exports.getLocalCachedPage());
};

/**
 * Handle a message from the app of type 'queryResult'.
 *
 * @param {any} message the message from the app
 */
exports.handleQueryResultMessage = function(message) {
  if (message.page) {
    console.log('Received positive query: ', message);
    localPageInfo = message.page;
  }
};

/**
 * Handle a message of type 'readystateComplete'
 *
 * @param {any} message from runtime.onMessage
 * @param {MessageSender} sender from runtime.onMessage
 * @param {function} callback from runtime.onMessage
 */
exports.handleLoadMessage = function(message, sender, callback) {
  // Wait for document.readyState to be complete.
  // Send the response object.
  util.getOnCompletePromise()
  .then(() => {
    let response = exports.createLoadResponseMessage();
    console.log('Invoking callback with response: ', response);
    callback(response);
  });
};

exports.createLoadResponseMessage = function() {
  let loadTime = exports.getFullLoadTime();
  return {
    type: 'readystateComplete',
    loadTime: loadTime
  };
};

/**
 * Return the full time it took to load the page.
 *
 * @return {number} the time from navigation start to readyState = 'complete'.
 */
exports.getFullLoadTime = function() {
  let win = util.getWindow();
  let result = win.performance.timing.domComplete -
    win.performance.timing.navigationStart;
  return result;
};

/**
 * Annotate links that are locally available.
 *
 * @return {Promise.<undefined, Error>}
 */
exports.annotateLocalLinks = function() {
  return new Promise(function(resolve, reject) {
    let links = exports.getLinksOnPage();
    let urls = Object.keys(links);
    
    appMsg.queryForPagesLocally('contentscript', urls)
    .then(urlToPageArr => {
      // localUrls will be an Object mapping URLs to arrays of locally
      // available pages.
      Object.keys(urlToPageArr).forEach(url => {
        let anchors = links[url];
        anchors.forEach(anchor => {
          exports.annotateAnchorIsLocal(anchor);
        });
      });
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Annotate links that are available on the network but not in this machine.
 *
 * @return {Promise.<undefined, Error>}
 */
exports.annotateNetworkLocalLinks = function() {
  return new Promise(function(resolve, reject) {
    let links = exports.getLinksOnPage();
    let urls = Object.keys(links);
    
    appMsg.queryForPagesOnNetwork('contentscript', urls)
    .then(urlToInfoArr => {
      // localUrls will be an Object mapping URLs to arrays of locally
      // available pages.
      Object.keys(urlToInfoArr).forEach(url => {
        let anchors = links[url];
        anchors.forEach(anchor => {
          exports.annotateAnchorIsOnNetwork(anchor);
        });
      });
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get the anchor elements that might be annotated.
 *
 * @return {Object} returns an object like the following:
 * {
 *   url: [ DOMElement, ... ]
 * }
 * This object will contain fully absolute URLs mapped to the DOMElement
 * anchors with that URL as its href attribute.
 */
exports.getLinksOnPage = function() {
  let allAnchors = exports.selectAllLinksWithHrefs();
  let result = {};

  allAnchors.forEach(anchor => {
    // Get the absolute URL.
    let url = exports.getAbsoluteUrl(anchor.href);
    let existingDoms = result[url];
    if (!existingDoms) {
      existingDoms = [];
      result[url] = existingDoms;
    }
    existingDoms.push(anchor);
  });

  return result;
};

/**
 * Get an absolute URL from the raw href from an anchor tag. There are several
 * things to consider here--the href might be relative or absolute, it could
 * lack or contain the scheme, etc. We are going to use the document itself to
 * get around this. Taken from this page:
 *
 * https://stackoverflow.com/questions/14780350/convert-relative-path-to-absolute-using-javascript
 *
 * @param {string} href the href from an anchor tag
 *
 * @return {string} the absolute, canonicalized URL. Ignores the search and
 * hash
 */
exports.getAbsoluteUrl = function(href) {
  let a = document.createElement('a');
  a.href = href;
  let result = a.protocol + '//' + a.host + a.pathname;
  return result;
};

/**
 * Perform a query selection for all links with href attributes.
 *
 * This is a thing wrapper around the document API to facilitate testing.
 *
 * @return {Array<DOMElement}
 */
exports.selectAllLinksWithHrefs = function() {
  return document.querySelectorAll('a[href]');
};

/**
 * Annotate an individual anchor to indicate that it is available locally. The
 * anchor is annotated in place.
 *
 * @param {DOMElement} anchor an anchor element as returned by
 * document.querySelector
 */
exports.annotateAnchorIsLocal = function(anchor) {
  // We'll style the link using a lightning bolt, known as 'zap'.
  let zap = '\u26A1';
  anchor.innerHTML = anchor.innerHTML + zap;
};

exports.annotateAnchorIsOnNetwork = function(anchor) {
  // We'll style the link using a cloud.
  let cloud = '\u2601';
  anchor.innerHTML = anchor.innerHTML + cloud;
};
