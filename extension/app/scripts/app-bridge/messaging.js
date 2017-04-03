'use strict';

var chromeRuntime = require('../chrome-apis/runtime');
var chromeTabs = require('../chrome-apis/tabs');
var backgroundApi = require('../background/background-api');

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
 * Send a message to the extension, expecting a response. This essentially just
 * hides the complexity around dealing with Chrome's callback-based response
 * mechanism, promisify-ing it in a single place, allowing callers to interact
 * with a promise.
 *
 * @param {any} message JSON serializable message for the app
 * @param {number} timeout a timeout to apply to the message. If falsey, uses
 * default.
 *
 * @return {Promise.<any, Error>} Promise that resolves with the response from
 * the app or rejects with an Error if something went wrong or if the response
 * times out. Note that the Promise resolves if communication was successful,
 * even if the request failed gracefully.
 */
exports.sendMessageForResponse = function(message, timeout) {
  timeout = timeout || exports.DEFAULT_TIMEOUT;
  return new Promise(function(resolve, reject) {
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
      resolve(response);
    };
    exports.sendMessageToApp(message, callbackForApp);

    exports.setTimeout(
      function() {
        if (!settled) {
          settled = true;
          reject(new Error(exports.MSG_TIMEOUT));
        }
      },
      timeout
    );
  });
};

/**
 * Perform a query to see if this page is available via the local cache. This
 * will communicate with the app.
 *
 * @param {string} url the url of the page you are querying for
 * @param {Object} options
 * @param {number} timeout number of milliseconds to wait. If falsey, uses
 * default.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the
 * result of the query.
 */
exports.isPageSaved = function(url, options, timeout) {
  var message = {
    type: 'query',
    params: {
      url: url,
      options: options
    }
  };
  return exports.sendMessageForResponse(message, timeout);
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

    exports.sendMessageForResponse(message, timeout)
    .then(response => {
      if (response.result === 'success') {
        resolve(response);
      } else {
        reject(response);
      }

    })
    .catch(err => {
      reject(err);
    });
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

/**
 * A callback to be registered via chrome.runtime.onMessage.addListener.
 *
 * After being added, this function is responsible for responding to messages
 * that come from within the Extension.
 *
 * @param {any} message
 * @param {MessageSender} sender
 * @param {function} sendResponse
 */
exports.onMessageCallback = function(message, sender, sendResponse) {
  if (message.type === 'savePageForContentScript') {
    backgroundApi.savePageForContentScript(sender.tab)
      .then(response => {
        sendResponse(response);
      });
  } else {
    console.warn('Received unrecognized message from self: ', message);
  }

  // Return true to indicate we are handling this asynchronously.
  return true;
};
