'use strict';

var browserAction = require('../chrome-apis/browser-action');
var appMessaging = require('../app-bridge/messaging');
var popupApi = require('../popup/popup-api');

// Directly requiring a script from the Chrome App. This seems risky, but I
// feel it's better than code duplication.
var evaluation = require('../../../../chromeapp/app/scripts/evaluation');

var forbiddenTransitionTypes = [
  'generated',        // search results from the omnibox, eg
  'auto_subframe',    // automatic things in a subframe
  'auto_toplevel',    // the start page
  'form_submit',
  'keyword',          // non-default search via omnibox
];

/**
 * Save the current page on behalf of a content script. This should be invoked
 * in response to an onMessage event, where the requesting tab can be recovered
 * from the MessageSender object.
 *
 * @param {Tab} tab the tab that is requesting the save
 *
 * @return {Promise -> object} Promise that resolves when the save completes.
 * The resolved object contains the time the write took, e.g.
 * { timeToWrite: 1234.5}.
 */
exports.savePageForContentScript = function(tab) {
  return new Promise(function(resolve, reject) {
    var start = evaluation.getNow();
    popupApi.saveTab(tab)
      .then(() => {
        var end = evaluation.getNow();
        var totalTime = end - start;
        var result = { timeToWrite: totalTime };
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Query for a cached URL. If found, a message is passed to the content script
 * for the page with the CachedPage object.
 *
 * If successful the page is present, this updates the icon for the given tab
 * to indicate that the page is available offline and sends a message to the
 * tab with the saved page.
 *
 * @param {integer} tabId the tabId t
 * @param {string} url the URL to query for
 *
 * @return {Promise.<Array.<CPInfo>, Error>} Promise that resolves when
 * complete or rejects with an error.
 */
exports.queryForPage = function(tabId, url) {
  return new Promise(function(resolve, reject) {
    console.log(url);
    appMessaging.queryForPagesLocally('background', [url])
    .then(result => {
      // We expect { url: [ CPInfo.asJSON(), ... ] }
      if (Object.keys(result).length === 0) {
        // No page saved.
        console.log('did not find saved copy of page: ', url);
        resolve(null);
      } else {
        // We found a saved copy.
        console.log('setting icon for tabId: ', tabId);
        console.log('query result: ', result);
        browserAction.setIcon({
          path: 'images/cloud-off-24.png',
          tabId: tabId
        });
        resolve(result);
      }
    })
    .catch(err => {
      console.log('queryForPage received error: ', err);
      reject(err);
    });
  });
};

/**
 * Returns true if this is a navigation event that we are interested in
 * querying and checking for cached versions.
 *
 * This encapsulates the logic of things like querying for the top level frame,
 * ignoring google search events, etc.
 *
 * @param {Object} details the details object passed via webNavigation events
 *
 * @return {boolean} true if this is a web navigation we want to check for 
 */
exports.isNavOfInterest = function(details) {
  if (details.frameId !== 0) {
    return false;
  }
  if (forbiddenTransitionTypes.includes(details.transitionType)) {
    return false;
  }
  return true;
};

/**
 * Query for a page and respond with the local page info via a callback.
 *
 * Upon completion of the query the 
 *
 * @param {Object} params the parameters from the message. Should look like:
 *   {
 *     url: {string},
 *     tabId: {integer}
 *   }
 * @param {Function} responseCallback invoked with the result of the query. The
 * callback should expect a single argument of the form:
 *   {
 *     from: 'background-script',
 *     status: {'success'|'failure'},
 *     result: {<localPageInfo|null>|Error}
 *   }
 */
exports.queryForPageWithCallback = function(params, responseCallback) {
  exports.queryForPage(params.tabId, params.url)
  .then(localPageInfo => {
    var response = {
      from: 'background-script',
      status: 'success',
      result: localPageInfo
    };
    responseCallback(response);
  })
  .catch(err => {
    var response = {
      from: 'background-script',
      status: 'error',
      result: err
    };
    responseCallback(response);
  })
  .catch(err => {
    console.error('something went wrong sending message: ', err);
  });
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
  console.log('onMessageCallback in background');
  if (message.type === 'savePageForContentScript') {
    exports.savePageForContentScript(sender.tab)
      .then(response => {
        sendResponse(response);
      });
    // Return true to indicate we are handling this asynchronously.
    return true;
  } else if (message.from === 'popup' && message.type === 'queryForPage') {
    exports.queryForPageWithCallback(message.params, sendResponse);
    return true;
  } else {
    console.warn('Received unrecognized message from self: ', message);
  }
  return true;
};
