/* globals Promise */
'use strict';

/**
 * API to be used by the popup. This assumes to only be valid in the context of
 * a popup, eg that the active tab will be the popup tab, etc.
 */

var capture = require('../chrome-apis/page-capture');
var datastore = require('../persistence/datastore');
var messaging = require('../app-bridge/messaging');
var tabs = require('../chrome-apis/tabs');
var util = require('../util/util');

/**
 * Save the currently active page.
 *
 * @return {Promise} Promise that resolves when the save completes, or rejects
 * if the save fails
 */
exports.saveCurrentPage = function() {
  return Promise.resolve()
  .then(() => {
    return util.getActiveTab();
  })
  .then(tab => {
    return datastore.saveTab('popup', tab);
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
    var tabId = tab.id;
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
      var message = exports.createLoadMessage();
      tabs.sendMessage(tab.id, message, function(resp) {
        console.log('Got response from tab: ', resp);
        resolve(resp);
      });
    });
  });
};

/**
 * Open the CachedPage in the current tab.
 *
 * @param {string} serviceName
 * @param {string} href
 *
 * @return {Promise.<Object, Error>}
 */
exports.openCachedPage = function(serviceName, href) {
  return new Promise(function(resolve, reject) {
    // Note that we are assuming the page is available locally.
    messaging.sendMessageToOpenPage('popup', serviceName, href)
    .then(response => {
      resolve(response);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Ask the content script if the current page is saved.
 *
 * @return {Promise.<Array.<CPInfo>, Error>}
 */
exports.getLocalPageInfo = function() {
  return Promise.resolve()
  .then(() => {
    return util.getActiveTab();
  })
  .then(tab => {
    return messaging.queryForPagesLocally('popup', [ tab.url ]);
  })
  .then(responderBody => {
    if (Object.keys(responderBody).length === 0) {
      return null;
    } else {
      let url = Object.keys(responderBody)[0];
      return responderBody[url];
    }
  });
};
