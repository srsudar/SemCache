'use strict';

const csApi = require('./cs-api');
const runtime = require('../chrome-apis/runtime');
const storage = require('../chrome-apis/storage');
const util = require('../util/util');

const appEval = require('../../../../chromeapp/app/scripts/evaluation');


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
 * A key into chrome.storage indicating list of URLs for which we are
 * performing the reload trial.
 */
exports.KEY_URL_LIST = 'evalCS_urlList';

/**
 * The index into the URL list pointing to the URL we are currently evaluating.
 */
exports.KEY_URL_LIST_INDEX = 'evalCS_urlListIndex';

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
 * @return {Promise -> object} Promise that resolves with an object like the
 * following, defining the parameters of this trial:
 * {
 *   key: user defined key,
 *   numIterations: number we are running,
 *   currentIter: the current iteration we are on,
 *   urlList: the list of URLs we are evaluating,
 *   urlListIndex: index into the urlList pointing at the active list,
 *   activeUrl: an element in urlList that is the current URL we are
 *       evaluating. This is determined by urlList[urlListIndex] and is
 *       included for convenience. The value is null if the trial is complete,
 *       and all URLs have been evaluated.
 * }
 */
exports.getParameters = function() {
  return new Promise(function(resolve) {
    let keys = [
      exports.KEY_NUM_ITERATIONS,
      exports.KEY_CURRENT_ITERATION,
      exports.KEY_LOG_KEY,
      exports.KEY_URL_LIST,
      exports.KEY_URL_LIST_INDEX
    ];
    storage.get(keys)
    .then(getResult => {
      let urlList = getResult[exports.KEY_URL_LIST];
      let urlListIndex = getResult[exports.KEY_URL_LIST_INDEX];
      // Start out null to indicate the end of the trial. We'll update the
      // value below if we haven't moved past the end of the array.
      let activeUrl = null;
      if (urlListIndex < urlList.length) {
        // Then we haven't yet finished the trial.
        activeUrl = urlList[urlListIndex];
      }
      let result = {
        key: getResult[exports.KEY_LOG_KEY],
        numIterations: getResult[exports.KEY_NUM_ITERATIONS],
        currentIter: getResult[exports.KEY_CURRENT_ITERATION],
        urlList: getResult[exports.KEY_URL_LIST],
        urlListIndex: urlListIndex,
        activeUrl: activeUrl
      };
      resolve(result);
    });
  });
  
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
 * Start a trial for loading and saving the page. This trial consists of
 * reloading the page and saving it, measuring the time it takes to accomplish
 * both. This sets the page-level variables and reloads the page. It is
 * expected that for this to mean anything, the Content Script itself must
 * check onReady and initiate the appropriate functions.
 *
 * @param {Array<string>} urls the Array of URLs we want to load. These should
 * be directly equivalent to window.location.href when the page is loaded.
 * Redirects, hashes or query parameters added during a load, etc, are not
 * expected to be handled
 * @param {integer} numIterations the total number of iterations in this trial
 * @param {string} key the key by which your want to access these results
 *
 * @return {Promise} Promise that tries to resolve after the call to reload.
 * This will likely fail in production but facilitates testing.
 */
exports.startSavePageTrial = function(urls, numIterations, key) {
  return new Promise(function(resolve) {
    let setArg = {};
    setArg[exports.KEY_NUM_ITERATIONS] = numIterations;
    setArg[exports.KEY_PERFORMING_TRIAL] = true;
    setArg[exports.KEY_CURRENT_ITERATION] = 0;
    setArg[exports.KEY_LOG_KEY] = key;
    setArg[exports.KEY_URL_LIST] = urls;
    setArg[exports.KEY_URL_LIST_INDEX] = 0;

    storage.set(setArg)
      .then(() => {
        resolve();
      });
  });
};

/**
 * Start a trial for timing the time required to annotate links.
 */
exports.startAnnotateLinksTrial = function(key, numIterations) {
  let setArg = {};
  setArg[exports.LINK_ANNOTATION_KEYS.totalIterations] = numIterations;
  setArg[exports.LINK_ANNOTATION_KEYS.currentIteration] = 0;
  setArg[exports.LINK_ANNOTATION_KEYS.key] = key;

  console.log('Beginning trial');

  storage.set(setArg)
  .then(() => {
    return util.wait(2000);
  })
  .then(() => {
    util.getWindow().location.reload(true);
  });
};

/**
 * Send a message to the Background Script requesting that this page be saved.
 *
 * @return {Promise -> any} Promise that resolves when the save completes,
 * resolving whatever savePageForContentScript resolves
 */
exports.requestSavePage = function() {
  let message = { type: 'savePageForContentScript' };
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
 * @return {Promise} Promise that resolves when the iteration is complete.
 */
exports.runSavePageIteration = function() {
  return new Promise(function(resolve) {
    // wait a short while just to try and not overload things.
    util.wait(1000)
      .then(() => {
        return exports.savePage();
      })
      .then(timingInfo => {
        resolve(timingInfo);
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
  let keys = [
    exports.KEY_PERFORMING_TRIAL,
    exports.KEY_NUM_ITERATIONS,
    exports.KEY_CURRENT_ITERATION,
    exports.KEY_LOG_KEY,
    exports.KEY_URL_LIST,
    exports.KEY_URL_LIST_INDEX
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
        let domCompleteTime = csApi.getFullLoadTime();
        let totalTime = domCompleteTime + response.timeToWrite;
        let result = {
          domCompleteTime: domCompleteTime,
          timeToWrite: response.timeToWrite,
          totalTime: totalTime
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
  let href = util.getWindow().location.href;
  let date = util.getToday().toString();
  let result = {
    href: href,
    date: date
  };
  return result;
};

/**
 * @return {string} result of window.location.href
 */
exports.getHref = function() {
  return util.getWindow().location.href;
};

/**
 * Checks the current state and initiates a trial if necessary.
 *
 * @return {Promise} Promise that resolves when the current iteration logic is
 * complete for this page (unless the page reloads or navigates to a new page,
 * in which the Promise won't have a chance to resolve)
 */
exports.onPageLoadComplete = function() {
  return new Promise(function(resolve, reject) {
    let params = null;
    let doneWithAllUrls = false;
    exports.isPerformingTrial()
      .then(isTrial => {
        if (!isTrial) {
          console.log('Not performing a save page trial.');
          throw new Error('jump to end');
        } else {
          return exports.getParameters();
        }
      })
      .then(returnedParams => {
        params = returnedParams;
        let href = exports.getHref(); 
        // Some pages are adding '/' on the end, which should be fine, so also
        // check for this.
        let activeUrlSlash = params.activeUrl + '/';
        if (href !== params.activeUrl && href !== activeUrlSlash) {
          console.log('Running a trial, but not on this page.');
          throw new Error('jump to end');
        } else {
          // We're in a trial
          return exports.runSavePageIteration(
            params.currentIter,
            params.numIterations,
            params.key
          );
        }
      })
      .then(timingInfo => {
        // Log the results
        let toLog = {};
        toLog.timing = timingInfo;
        toLog.metadata = exports.createMetadataForLog();
        toLog.iteration = params.currentIter;
        toLog.numIterations = params.numIterations;
        toLog.url = params.activeUrl;
        toLog.urlListIndex = params.urlListIndex;
        return appEval.logTime(params.key, toLog); 
      })
      .then(() => {
        // Update the variables.
        let setArg = {};
        let nextIter = params.currentIter + 1;
        setArg[exports.KEY_CURRENT_ITERATION] = nextIter;
        if (nextIter >= params.numIterations) {
          // We're done with this page. Increment the url list index.
          params.currentIter = 0;
          params.urlListIndex = params.urlListIndex + 1;
          setArg[exports.KEY_CURRENT_ITERATION] = params.currentIter;
          setArg[exports.KEY_URL_LIST_INDEX] = params.urlListIndex;
        }
        if (params.urlListIndex >= params.urlList.length) {
          // We're done. Delete all our variables and stop.
          doneWithAllUrls = true;
          return exports.deleteStorageHelperValues();
        }
        // Set the helper parameters.
        return storage.set(setArg); 
      })
      .then(() => {
        if (doneWithAllUrls) {
          return Promise.resolve();
        }
        // If we're on the first iteration, navigate to the page.
        if (params.currentIter === 0) {
          let nextUrl = params.urlList[params.urlListIndex];
          util.getWindow().location.href = nextUrl;
          return Promise.resolve();
        } else {
          // We're just re-running our usual trial. Refresh without the cache.
          util.getWindow().location.reload(true);
          return Promise.resolve();
        }
      })
      .then(() => {
        exports.logResult(params.key);
        resolve();
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
  });
};
