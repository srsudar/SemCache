'use strict';

var browserAction = require('../chrome-apis/browser-action');
var appMessaging = require('../app-bridge/messaging');
var popupApi = require('../popup/popup-api');
var tabs = require('../chrome-apis/tabs');

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
 * @return {Promise.<CachedPage, Error>} Promise that resolves when complete or
 * rejects with an error.
 */
exports.queryForPage = function(tabId, url) {
  return new Promise(function(resolve, reject) {
    appMessaging.isPageSaved(url)
    .then(result => {
      if (!result.response || result.response === null) {
        // No page saved.
        console.log('did not find saved copy of page: ', url);
        resolve(null);
      } else {
        console.log('setting icon for tabId: ', tabId);
        console.log('query result: ', result);
        browserAction.setIcon({
          path: 'images/cloud-off-24.png',
          tabId: tabId
        });
        tabs.sendMessage(
          tabId,
          {
            type: 'queryResult',
            from: 'background',
            tabId: tabId,
            page: result.response
          }
        );
        resolve(result.response);
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
