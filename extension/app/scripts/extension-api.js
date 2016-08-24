/* globals Promise */
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
