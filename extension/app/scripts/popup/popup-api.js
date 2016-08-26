/* globals Promise */
'use strict';

/**
 * API to be used by the Extension
 */

var capture = require('../chrome-apis/page-capture');
var tabs = require('../chrome-apis/tabs');
var datastore = require('../persistence/datastore');
var util = require('../util/util');

exports.saveCurrentPage = function() {
  // Get all tabs.
  // Get the active tab.
  // Ask the datastore to perform the write.
  return new Promise(function(resolve, reject) {
    var tab = null;
    tabs.query({ currentWindow: true, active: true})
      .then(tabs => {
        tab = tabs[0];
        return tab;
      })
      .then(activeTab => {
        var tabId = activeTab.id;
        return capture.saveAsMHTML({ tabId: tabId });
      })
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
