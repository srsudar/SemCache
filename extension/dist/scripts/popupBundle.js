(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var chromeRuntime = require('../chrome-apis/runtime');
var chromeTabs = require('../chrome-apis/tabs');

/** Message indicating that a timeout occurred waiting for the app. */
exports.MSG_TIMEOUT = 'timed out waiting for response from app';

/** Default timeout value. Can be tuned. */
exports.DEFAULT_TIMEOUT = 10000;

/**
 * ID of the Semcache Chrome App.
 */
exports.APP_ID = 'dfafijifolbgimhdeahdmkkpapjpabka';

/**
 * Send a message to the SemCache app.
 *
 * @param {any} message JSON serializable message for the app
 * @param {function} callback option callback to be invoked by the receiving
 * app or extension
 */
exports.sendMessageToApp = function(message, callback) {
  chromeRuntime.sendMessage(exports.APP_ID, message, callback);
};

/**
 * Save a page as MHTML by calling the extension.
 *
 * @param {string} captureUrl the URL of the captured page
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {string} dataUrl the blob of MHTMl data as a data URL
 * @param {object} metadata metadata to store about the page
 * @param {integer} timeout number of ms to wait before timing out and
 * rejecting if a response is not received from the app. Default is
 * DEFAULT_TIMEOUT.
 *
 * @return {Promise -> any} Promise that resolves with the response from the
 * receiving app if the write was successful. Rejects if the write itself
 * failed or if the request times out.
 */
exports.savePage = function(
  captureUrl, captureDate, dataUrl, metadata, timeout
) {
  timeout = timeout || exports.DEFAULT_TIMEOUT;
  return new Promise(function(resolve, reject) {
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

    // And now we begin the process of resolving/rejecting based on whether or
    // not the app invokes our callback.
    var settled = false;
    // We'll update this if we've already resolved or rejected.
    var callbackForApp = function(response) {
      console.log('got callback from app');
      if (settled) {
        // do nothing
        return;
      }
      settled = true;
      if (response.result === 'success') {
        resolve(response);
      } else {
        reject(response);
      }

    };
    exports.sendMessageToApp(message, callbackForApp);

    exports.setTimeout(
      function() {
        if (!settled) {
          settled = true;
          reject(exports.MSG_TIMEOUT);
        }
      },
      timeout
    );
  });
};

/**
 * Wrapper around setTimeout to permit testing.
 */
exports.setTimeout = function(fn, timeout) {
  setTimeout(fn, timeout);
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
 * @param {function} responseCallback
 */
exports.sendMessage = function(appId, message, responseCallback) {
  chrome.runtime.sendMessage(appId, message, responseCallback);
};

/**
 * Add a function as a listner to chrome.runtime.onMessageExternal.
 *
 * @param {function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

/**
 * Add a function as a listener on chrome.runtime.onMessage.
 *
 * @param {function} fn
 */
exports.addOnMessageListener = function(fn) {
  chrome.runtime.onMessage.addListener(fn);
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

/**
 * Send a message to a particular tab.
 *
 * @param {integer} tabId
 * @param {any} message must be JSON serializable
 * @param {function} callback
 */
exports.sendMessage = function(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, callback);
};

},{}],5:[function(require,module,exports){
/* globals Promise */
'use strict';

var tabs = require('../chrome-apis/tabs');
var messaging = require('../app-bridge/messaging');
var util = require('../util/util');

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
 * @param {Tab} tab Chrome Tab object that is being saved
 * @param {blob} mhtmlBlob the mhtml blob as returned by chrome.pagecapture
 *
 * @return {Promise} a Promise that resolves when the save is complete or
 * rejects if the save fails.
 */
exports.savePage = function(tab, mhtmlBlob) {
  var fullUrl = tab.url;
  var domain = exports.getDomain(fullUrl);
  var captureDate = exports.getDateForSave();

  return new Promise(function(resolve, reject) {
    var mhtmlDataUrl = null;
    exports.getBlobAsDataUrl(mhtmlBlob)
      .then(dataUrl => {
        mhtmlDataUrl = dataUrl;
        return exports.createMetadataForWrite(tab);
      })
      .then(metadata => {
        return messaging.savePage(domain, captureDate, mhtmlDataUrl, metadata);
      })
      .then(msgFromApp => {
        resolve(msgFromApp);
      })
      .catch(err => {
        reject(err);
      });
  });
};

},{"../app-bridge/messaging":1,"../chrome-apis/tabs":4,"../util/util":8}],6:[function(require,module,exports){
/* globals Promise */
'use strict';

/**
 * API to be used by the Extension
 */

var capture = require('../chrome-apis/page-capture');
var tabs = require('../chrome-apis/tabs');
var datastore = require('../persistence/datastore');
var util = require('../util/util');

/**
 * Save the currently active page.
 *
 * @return {Promise} Promise that resolves when the save completes, or rejects
 * if the save fails
 */
exports.saveCurrentPage = function() {
  // Get all tabs.
  // Get the active tab.
  // Ask the datastore to perform the write.
  return new Promise(function(resolve, reject) {
    util.getActiveTab()
      .then(activeTab => {
        return exports.saveTab(activeTab);
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

/**
 * Save the given tab to the datastore.
 *
 * @param {Tab} tab the tab to save
 *
 * @return {Promise} Promise that resolves when the save completes.
 */
exports.saveTab = function(tab) {
  return new Promise(function(resolve, reject) {
    var tabId = tab.tabId;
    capture.saveAsMHTML({ tabId: tabId })
    .then(mhtmlBlob => {
      return datastore.savePage(tab, mhtmlBlob);
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

/**
 * Create a message that indicates a caller is interested in when
 * document.readyState is complete.
 *
 * E.g. this is the messaged passed to the content script to indicate it should
 * inform the caller via a callback that the load is complete with how long the
 * load took.
 */
exports.createLoadMessage = function() {
  return {
    type: 'readystateComplete'
  };
};

/**
 * Wait until the current tab is finished loading. If the load is already
 * complete, the Promise will resolve immediately. Resolves with the message
 * returned from the content script running in the current page.
 *
 * @return {Promise -> object} Promise that resolves when document.readyState
 * is 'complete' on the current tab. The resolved object is the message passed
 * back by the tab.
 */
exports.waitForCurrentPageToLoad = function() {
  console.log('in waitForCurrentPageToLoad');
  return new Promise(function(resolve) {
    util.getActiveTab()
      .then(tab => {
        console.log('active tab: ', tab);
        var message = exports.createLoadMessage();
        tabs.sendMessage(tab.id, message, function(resp) {
          console.log('Got response from tab: ', resp);
          resolve(resp);
        });
      });
  });
};

},{"../chrome-apis/page-capture":2,"../chrome-apis/tabs":4,"../persistence/datastore":5,"../util/util":8}],7:[function(require,module,exports){
'use strict';

var api = require('./popup-api');
var messaging = require('../app-bridge/messaging');

var spinner = document.getElementById('spinner');
var message = document.getElementById('message');
var timing1 = document.getElementById('timing1');
var timing2 = document.getElementById('timing2');
var divSaveTime = document.getElementById('save-time');
var divLoadTime = document.getElementById('load-time');

// Crazy value to make sure we notice if there are errors.
var saveStart = -10000;
var domCompleteTime = null;

function round(num) {
  // Round to two decimal places
  var factor = 100;
  var result = Math.round(num * factor) / factor;
  return result;
}

function finishTiming() {
  var saveEnd = window.performance.now();
  var totalSaveTime = saveEnd - saveStart;

  var totalLoadTime = domCompleteTime;

  console.log('un-rounded totalSaveTime: ', totalSaveTime);
  console.log('un-rounded totalLoadTime: ', totalLoadTime);

  timing1.classList.remove('hide');
  timing2.classList.remove('hide');

  divSaveTime.innerText = round(totalSaveTime);
  divLoadTime.innerText = round(totalLoadTime);

}

function hideSpinner() {
  spinner.classList.add('hide');
}

function handleSuccess() {
  finishTiming();
  message.innerText = 'Page saved!';

  hideSpinner();
}

/**
 * @param {boolean} timedOut if the error is because waiting for the app timed
 * out
 */
function handleError(timedOut) {
  finishTiming();

  if (timedOut) {
    message.innerText = 'Timed out waiting for App';
  } else {
    message.innerText = 'Something went wrong...';
  }
}

function beforeLoadComplete() {
  message.classList.remove('hide');
  message.innerText = 'Page Loading';
}


function afterLoadComplete(msgFromTab) {
  saveStart = window.performance.now();
  domCompleteTime = msgFromTab.loadTime;
  message.innerText = 'Saving';
  api.saveCurrentPage()
    .then(() => {
      handleSuccess();
    })
    .catch(err => {
      console.log(err);
      var timedOut = err === messaging.MSG_TIMEOUT;
      handleError(timedOut);
    });
}


beforeLoadComplete();

api.waitForCurrentPageToLoad()
  .then(msgFromTab => {
    afterLoadComplete(msgFromTab);
  });

},{"../app-bridge/messaging":1,"./popup-api":6}],8:[function(require,module,exports){
/* globals fetch */
'use strict';

var tabs = require('../chrome-apis/tabs');

/**
 * Very thin wrapper around the global fetch API to enable mocks during test.
 *
 * @param {string} url URL against which to issue the fetch
 *
 * @return {Promise} Promise that is the result of the global fetch API
 */
exports.fetch = function(url) {
  return fetch(url);
};

/**
 * @return {document} the global document object
 */
exports.getDocument = function() {
  return document;
};

/**
 * @return {window} the global window object
 */
exports.getWindow = function() {
  return window;
};

/**
 * @return {Promise} Promise that resolves when document.readyState is
 * complete, indicating that all resources have been loaded (and thus the page
 * is presumably safe to save
 */
exports.getOnCompletePromise = function() {
  // Modeled on Jake Archibald's svgomg utils:
  // https://github.com/jakearchibald/svgomg/blob/master/src/js/page/utils.js
  var doc = exports.getDocument();
  return new Promise(function(resolve) {
    var checkState = function() {
      if (doc.readyState === 'complete') {
        resolve();
      }
    };
    doc.addEventListener('readystatechange', checkState);
    checkState();
  });
};

/**
 * @return {Promise -> Tab} Promise that resolves with the current active Tab
 */
exports.getActiveTab = function() {
  return new Promise(function(resolve) {
    tabs.query({ currentWindow: true, active: true})
      .then(tabs => {
        var tab = tabs[0];
        resolve(tab);
      });
  });
};

},{"../chrome-apis/tabs":4}]},{},[7]);
