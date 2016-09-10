'use strict';

var util = require('../util/util');
var runtime = require('../chrome-apis/runtime');
var csApi = require('./cs-api');
var storage = require('../../../../chromeapp/app/scripts/chrome-apis/storage');
var appEval = require('../../../../chromeapp/app/scripts/evaluation');

/**
 * Functionality for evaluating the framework. Note that unlike in the App,
 * different components of the Extension (i.e. Content Script, Background, and
 * Popup), have different API access and run in different contexts. This is the
 * component that expects to be run under the context of a Content Script.
 */

/**
 * A key into chrome.storage indicating whether or not a trial is currently
 * being performed.
 */
exports.KEY_PERFORMING_TRIAL = 'evalCS_performingTrial';

/**
 * A key into chrome.storage indicating the total number of iterations being
 * performed in the current trial.
 */
exports.KEY_NUM_ITERATIONS = 'evalCS_numIterations';

/**
 * A key into chrome.storage indicating the current iteration in the trial.
 */
exports.KEY_CURRENT_ITERATION = 'evalCS_currentIteration';

/**
 * A key into chrome.storage indicating the domain and path on which we are
 * performing the trial.
 */
exports.KEY_DOMAIN_AND_PATH = 'evalCS_domainAndPath';

exports.KEY_LOG_KEY = 'evalCS_logKey';

/**
 * Resolves true to indicat that we are currently performing a trial and have
 * more iterations to perform.
 * @return {Promise -> boolean}
 */
exports.isPerformingTrial = function() {
  return new Promise(function(resolve) {
    exports.getFromStorageHelper(exports.KEY_PERFORMING_TRIAL)
      .then(value => {
        if (value) {
          resolve(value);
        } else {
          resolve(false);
        }
      });
  });
};

/**
 * Resolves the number of iterations we should perform in this trial.
 * 
 * @return {Promise -> integer}
 */
exports.getTotalIterations = function() {
  return exports.getFromStorageHelper(exports.KEY_NUM_ITERATIONS);
};

/**
 * Get the key the user has defined that we will use to access the logs.
 *
 * @return {Promise -> string}
 */
exports.getLogKey = function() {
  return exports.getFromStorageHelper(exports.KEY_LOG_KEY);
};

/**
 * Resolves the current iteration we are performing. This should start at 0 and
 * go up to getTotalIterations() - 1 during the course of a trial.
 * @return {Promise -> integer}
 */
exports.getCurrentIteration = function() {
  return exports.getFromStorageHelper(exports.KEY_CURRENT_ITERATION);
};

/**
 * Resolves the domain and path upon which we are performing the evaluation.
 * This is expected to be retrieved by the Content Script when the page firsts
 * load and act as a safety measure so we refreshingly frantically on every
 * page after we initiate a trial on one page.
 */
exports.getDomainAndPath = function() {
  return exports.getFromStorageHelper(exports.KEY_DOMAIN_AND_PATH);
};

/**
 * A helper wrapping the logic of retrieving from chrome storage.
 *
 * @param {string} key
 *
 * @return {Promise -> any} Promise that resolves with the value that was in
 * storage
 */
exports.getFromStorageHelper = function(key) {
  return new Promise(function(resolve) {
    storage.get(key)
      .then(getResult => {
        resolve(getResult[key]);
      });
  });
};

/**
 * @return {string} the string we will use to define this page
 */
exports.createPageIdentifier = function() {
  var window = util.getWindow();
  var result = window.location.host + '/' + window.location.pathname;
  return result;
};

/**
 * Start a trial for loading and saving the page. This trial consists of
 * reloading the page and saving it, measuring the time it takes to accomplish
 * both. This sets the page-level variables and reloads the page. It is
 * expected that for this to mean anything, the Content Script itself must
 * check onReady and initiate the appropriate functions.
 *
 * @param {integer} numIterations the total number of iterations in this trial
 * @param {string} key the key by which your want to access these results
 *
 * @return {Promise} Promise that tries to resolve after the call to reload.
 * This will likely fail in production but facilitates testing.
 */
exports.startSavePageTrial = function(numIterations, key) {
  return new Promise(function(resolve) {
    var win = util.getWindow();
    var setArg = {};
    setArg[exports.KEY_NUM_ITERATIONS] = numIterations;
    setArg[exports.KEY_PERFORMING_TRIAL] = true;
    setArg[exports.KEY_CURRENT_ITERATION] = 0;
    setArg[exports.KEY_DOMAIN_AND_PATH] = exports.createPageIdentifier();
    setArg[exports.KEY_LOG_KEY] = key;

    storage.set(setArg)
      .then(() => {
        // Everything is prepared--kick it off.
        win.location.reload(true);
        resolve();
      });
  });
};

/**
 * Send a message to the Background Script requesting that this page be saved.
 *
 * @return {Promise -> any} Promise that resolves when the save completes,
 * resolving whatever savePageForContentScript resolves
 */
exports.requestSavePage = function() {
  var message = { type: 'savePageForContentScript' };
  return new Promise(function(resolve) {
    runtime.sendMessage(message, function(response) {
      resolve(response);
    });
  });
};

/**
 * Run a single save page iteration. Assuming the page has been refreshed
 * without hitting the cache, it then saves the page and records the time,
 * logging the result.
 *
 * It also increments the iteration counter and reloads the page if this is not
 * the last iteration.
 *
 * @param {integer} numIter the number of this iteration, 0 for the first
 * @param {integer} totalIterations the total number of iterations we intend to
 * run
 * @param {string} key the key to which we are saving the results of runs
 *
 * @return {Promise} Promise that resolves when the iteration is complete. This
 * will not occur during any except the final trial in production, as the
 * window will be reloaded
 */
exports.runSavePageIteration = function(numIter, totalIterations, key) {
  return new Promise(function(resolve) {
    var doneWithTrial = false;
    exports.savePage()
      .then(timingInfo => {
        var metadata = exports.createMetadataForLog();
        timingInfo.metadata = metadata;
        return appEval.logTime(key, timingInfo);
      })
      .then(() => {
        // Now handle the state that we need to take care of.
        console.log('in next iter');
        var nextIter = numIter + 1;
        if (nextIter < totalIterations) {
          // We have another iteration to run.
          // Persist the nextIter value and reload the page without the cache.
          var setArg = {};
          setArg[exports.KEY_CURRENT_ITERATION] = nextIter;
          return storage.set(setArg);
        } else {
          // We're done. 
          // Delete the storage variables.
          doneWithTrial = true;
          return exports.deleteStorageHelperValues();
        }
      })
      .then(() => {
        if (doneWithTrial) {
          console.log('complete with trial');
          exports.logResult();
          resolve();
        } else {
          util.getWindow().location.reload(true);
          resolve();
        }
      });
  });
};

/**
 * Log results stored by key. Convenience function for printing results after
 * the end of a trial.
 */
exports.logResult = function(key) {
  appEval.getTimeValues(key)
    .then(values => {
      console.log(values);
    });
};

/**
 * Delete the total number of iterations, running trial, and current iteration
 * variables from storage.
 *
 * @return {Promise} Promise that resolves when the deletes are complete.
 */
exports.deleteStorageHelperValues = function() {
  var keys = [
    exports.KEY_PERFORMING_TRIAL,
    exports.KEY_NUM_ITERATIONS,
    exports.KEY_CURRENT_ITERATION
  ];
  return storage.remove(keys);
};

/**
 * Save the current page.
 *
 * @return {Promise -> object} Promise that resolves when the iteration
 * completes. Returns an object like the following:
 * {
 *   totalLoadTime: the time it took from navigation start to dom complete
 *   timeToWrite: the time it took for the write to be iniatiated to complete,
 *                  as returned by background-api
 * }
 */
exports.savePage = function() {
  return new Promise(function(resolve) {
    // We assume that the page has been loaded fresh, avoiding the cache,
    // allowing us to start immediately without trying to clear the state.
    util.getOnCompletePromise()
      .then(() => {
        // The load has completed, meaning it's safe to save.
        return exports.requestSavePage();
      })
      .then(response => {
        var domCompleteTime = csApi.getFullLoadTime();
        var result = {
          totalLoadTime: domCompleteTime,
          timeToWrite: response.timeToWrite
        };
        resolve(result);
      });
  });
};

/**
 * Create the metadata object to be associated with this timing event. This is
 * intended to provide context to the value being persisted to the database.
 *
 * @return {object}
 */
exports.createMetadataForLog = function() {
  // This is rather arbitrary and subject to change.
  var href = util.getWindow().location.href;
  var date = util.getToday().toString();
  var result = {
    href: href,
    date: date
  };
  return result;
};
