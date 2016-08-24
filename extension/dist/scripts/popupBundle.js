(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var chromeRuntime = require('../chrome-apis/runtime');
var chromeTabs = require('../chrome-apis/tabs');

/**
 * ID of the Semcache Chrome App.
 */
exports.APP_ID = 'dfafijifolbgimhdeahdmkkpapjpabka';

/**
 * Send a message to the SemCache app.
 *
 * @param {any} message JSON serializable message for the app
 */
exports.sendMessageToApp = function(message) {
  chromeRuntime.sendMessage(exports.APP_ID, message);
};

/**
 * Save a page as MHTML by calling the extension.
 *
 * @param {string} captureUrl the URL of the captured page
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {string} dataUrl the blob of MHTMl data as a data URL
 * @param {object} metadata metadata to store about the page
 */
exports.savePage = function(captureUrl, captureDate, dataUrl, metadata) {
  // Sensible default
  metadata = metadata || {};
  var message = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureDate: captureDate,
      dataUrl: dataUrl,
      metadata: metadata
    }
  };
  exports.sendMessageToApp(message);
};

/**
 * Open the given URL.
 *
 * @param {string} url
 */
exports.openUrl = function(url) {
  chromeTabs.update(url);
};

/**
 * A callback to be registered via
 * chrome.runtime.onMessageExternal.addListener.
 *
 * After being added, this function is responsible for responding to messages
 * that come from the App component.
 *
 * @param {any} message
 * @param {MessageSender} sender
 * @param {function} sendResponse
 */
exports.onMessageExternalCallback = function(message, sender, sendResponse) {
  if (sender.id && sender.id !== exports.APP_ID) {
    console.log('Received a message not from the app: ', sender);
    return;
  }
  if (message.type === 'open') {
    // An open request for a URL.
    var url = message.params.url;
    exports.openUrl(url);
    if (sendResponse) {
      sendResponse();
    }
  }
};

},{"../chrome-apis/runtime":3,"../chrome-apis/tabs":4}],2:[function(require,module,exports){
/* globals chrome */
'use strict';

/**
 * Promise-ified wrapper around the chrome.pageCapture API.
 */

/**
 * @param {object} details details object as specified in the
 * chrome.pageCapture API.
 *
 * @return {Promise -> Blob} Promise that resolves with the Blob of mhtml
 * content
 */
exports.saveAsMHTML = function(details) {
  return new Promise(function(resolve) {
    chrome.pageCapture.saveAsMHTML(details, function(blob) {
      resolve(blob);
    });
  });
};

},{}],3:[function(require,module,exports){
/* globals chrome */
'use strict';

/**
 * Wrapper around the chrome.runtime family of APIs.
 */

/**
 * Send a message using the chrome.runtime.sendMessage API.
 *
 * @param {string} appId
 * @param {any} message must be JSON-serializable
 */
exports.sendMessage = function(appId, message) {
  chrome.runtime.sendMessage(appId, message);
};

/**
 * Add a function as a listner to chrome.runtime.onMessageExternal.
 *
 * @param {function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

},{}],4:[function(require,module,exports){
/* global chrome */
'use strict';

/**
 * Wrapper around the chrome.tabs APIs.
 */

/**
 * Update the default tab with the given URL.
 *
 * @param {string} url the URL to open
 */
exports.update = function(url) {
  chrome.tabs.update({
    url: url
  });
};

/**
 * Get all the tabs that have the specified properties, or all tabs if no
 * properties are specified.
 *
 * @param {object} queryInfo object as specified by chrome.tabs.
 *
 * @return {Promise -> Array<Tab>} Promise that resolves with an Array of Tabs
 * matching queryInfo
 */
exports.query = function(queryInfo) {
  return new Promise(function(resolve) {
    chrome.tabs.query(queryInfo, function(tabs) {
      resolve(tabs);
    });
  });
};

/**
 * Capture the visible area of the currently active tab in the specified
 * window.
 *
 * @param {integer} windowId the target window, defaults to the current window
 * @param {object} options
 *
 * @return {Promise -> string} Promise that resolves with the captured image as
 * a data URL
 */
exports.captureVisibleTab = function(windowId, options) {
  return new Promise(function(resolve) {
    chrome.tabs.captureVisibleTab(windowId, options, function(dataUrl) {
      resolve(dataUrl);
    });
  });
};

},{}],5:[function(require,module,exports){
'use strict';

/**
 * API to be used by the Extension
 */

var capture = require('./chrome-apis/page-capture');
var tabs = require('./chrome-apis/tabs');
var datastore = require('./persistence/datastore');

exports.saveCurrentPage = function() {
  // Get all tabs.
  // Get the active tab.
  // Ask the datastore to perform the write.
  return new Promise(function(resolve, reject) {
    var fullUrl = null;
    tabs.query({ currentWindow: true, active: true})
      .then(tabs => {
        return tabs[0];
      })
      .then(activeTab => {
        fullUrl = activeTab.url;
        var tabId = activeTab.id;
        return capture.saveAsMHTML({ tabId: tabId });
      })
      .then(mhtmlBlob => {
        return datastore.savePage(fullUrl, mhtmlBlob); 
      })
      .then(() => {
        // all done
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
};

},{"./chrome-apis/page-capture":2,"./chrome-apis/tabs":4,"./persistence/datastore":6}],6:[function(require,module,exports){
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

},{"../app-bridge/messaging":1,"../chrome-apis/tabs":4}],7:[function(require,module,exports){
'use strict';

var api = require('./extension-api');

var spinner = document.getElementById('spinner');
var msgSuccess = document.getElementById('msg-success');
var msgError = document.getElementById('msg-error');

function handleSuccess() {
  msgSuccess.classList.remove('hide');

  msgError.classList.add('hide');
  spinner.classList.add('hide');
}

function handleError() {
  msgError.classList.remove('hide');

  spinner.classList.add('hide');
  msgSuccess.classList.add('hide');
}

api.saveCurrentPage()
  .then(() => {
    handleSuccess();
  })
  .catch(err => {
    console.log(err);
    handleError();
  });

},{"./extension-api":5}]},{},[7]);
