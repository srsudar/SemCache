/* globals Promise */
'use strict';

/**
 * API to be used by the popup. This assumes to only be valid in the context of
 * a popup, eg that the active tab will be the popup tab, etc.
 */

var capture = require('../chrome-apis/page-capture');
var datastore = require('../persistence/datastore');
var messaging = require('../app-bridge/messaging');
var runtime = require('../chrome-apis/runtime');
var tabs = require('../chrome-apis/tabs');
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
        console.log('active tab: ', tab);
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
 * @param {CachedPage} page
 *
 * @return {Promise.<undefined, Error>}
 */
exports.openCachedPage = function(page) {
  // Safety check to keep the popup from crashing.
  if (!page) {
    return;
  }
  return new Promise(function(resolve, reject) {
    // Note that we are assuming the page is available locally.
    messaging.sendMessageToOpenPage(page)
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
 * @return {Promise.<CachedPage, Error>}
 */
exports.getLocalPageInfo = function() {
  return new Promise(function(resolve, reject) {
    function onResponse(response) {
      if (response && response.status === 'success') {
        resolve(response.result);
      } else if (response.status === 'error') {
        reject(response.result);
      }
    }

    util.getActiveTab()
    .then(tab => {
      var params = {
        url: tab.url,
        tabId: tab.id
      };
      runtime.sendMessage(
        {
          from: 'popup',
          type: 'queryForPage',
          params: params
        },
        onResponse
      );
    })
    .catch(err => {
      reject(err);
    });
  });
};
