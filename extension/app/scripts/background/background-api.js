'use strict';

var popupApi = require('../popup/popup-api');
// Directly requiring a script from the Chrome App. This seems risky, but I
// feel it's better than code duplication.
var evaluation = require('../../../../chromeapp/app/scripts/evaluation');

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
