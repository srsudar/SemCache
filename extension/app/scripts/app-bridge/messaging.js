'use strict';

const chromeRuntime = require('../chrome-apis/runtime');
const chromeTabs = require('../chrome-apis/tabs');

const commonMsg = require('../../../../chromeapp/app/scripts/extension-bridge/common-messaging');

exports.DEBUG = false;

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
  message.timeSent = Date.now();
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
      if (exports.DEBUG) {
        console.log('got callback from app');
      }
      if (settled) {
        // do nothing
        return;
      }
      settled = true;
      if (commonMsg.isError(response)) {
        reject(response);
      } else if (commonMsg.isSuccess(response)) {
        resolve(response);
      } else {
        console.log('unrecognized message:', response);
        reject(response);
      }
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
 * @param {string} from the name of the component requesting the info
 * @param {Array.<string>} urls the urls you are searching for
 * @param {number} timeout number of milliseconds to wait. If falsey, uses
 * default.
 *
 * @return {Promise.<Array.<CPInfo>, Error>} Promise that resolves with the
 * result of the query.
 */
exports.queryForPagesLocally = function(from, urls, timeout) {
  return Promise.resolve()
  .then(() => {
    let message = commonMsg.createLocalQueryMessage(from, urls);
    return exports.sendMessageForResponse(message, timeout);
  })
  .then(response => {
    return response.body;
  });
};

/**
 * @param {string} from name of the component requesting the info
 * @param {Array.<string>} urls an array of URLs
 * @param {number} timeout number of milliseconds to wait. If falsey, uses the
 * default
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the result of
 * the query
 */
exports.queryForPagesOnNetwork = function(from, urls, timeout) {
  return Promise.resolve()
  .then(() => {
    let message = commonMsg.createNetworkQueryMessage(from, urls);
    return exports.sendMessageForResponse(message, timeout);
  })
  .then(response => {
    return response.body;
  });
};

/**
 * @param {string} from
 * @param {string} serviceName
 * @param {href} href
 *
 * @return {Promise.<Object, Error>}
 */
exports.sendMessageToOpenPage = function(from, serviceName, href, timeout) {
  return Promise.resolve()
  .then(() => {
    let message = commonMsg.createOpenMessage(from, serviceName, href);
    return exports.sendMessageForResponse(message, timeout);
  })
  .then(response => {
    return response.body;
  });
};

/**
 * Save a page as MHTML by calling the extension.
 *
 * @param {string} from
 * @param {Object} cpdiskJson CPDisk.asJSON() result
 * @param {number} timeout
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the response
 * from the receiving app if the write was successful. Rejects if the write
 * itself failed or if the request times out.
 */
exports.savePage = function(from, cpdiskJson, timeout) {
  return Promise.resolve()
  .then(() => {
    let message = commonMsg.createAddPageMessage(from, cpdiskJson);
    return exports.sendMessageForResponse(message, timeout);
  })
  .then(response => {
    return response.body;
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
    if (exports.DEBUG) {
      console.log('Received a message not from the app: ', sender);
    }
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
