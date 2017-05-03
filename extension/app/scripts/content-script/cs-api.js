'use strict';

var util = require('../util/util');

var localPageInfo = null;

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
      var response = exports.createLoadResponseMessage();
      console.log('Invoking callback with response: ', response);
      callback(response);
    });
};

exports.createLoadResponseMessage = function() {
  var loadTime = exports.getFullLoadTime();
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
  var win = util.getWindow();
  var result = win.performance.timing.domComplete -
    win.performance.timing.navigationStart;
  return result;
};

/**
 * Annotate links that are locally available.
 */
exports.annotateLocalLinks = function() {
  var anchors = document.querySelectorAll('a[href]');
  // Now we have anchors that have hrefs. Annotate every other one.
  for (var i = 0; i < anchors.length; i++) {
    if (i % 2 === 0) {
      continue;
    }
    // exports.annotateAnchorIsLocal(anchors[i]);
  }
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
  var zap = '\u26A1';
  anchor.innerHTML = anchor.innerHTML + zap;
};
