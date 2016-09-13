'use strict';

/**
 * Functionality useful to evaluating SemCache.
 */

var json2csv = require('json2csv');

var datastore = require('./persistence/datastore');
var api = require('./server/server-api');
var storage = require('./chrome-apis/storage');
var appc = require('./app-controller');
var util = require('./util');

/** The prefix value for timing keys we will use for local storage. */
var TIMING_KEY_PREFIX = 'timing_';

/**
 * Create a scoped version of key for to safely put in local storage
 *
 * @param {string} key
 *
 * @return {string} a scoped key, e.g. timing_key
 */
exports.createTimingKey = function(key) {
  return TIMING_KEY_PREFIX + key;
};

/**
 * Generate an Array of CachedPage objects useful for creating a response to
 * mimic response pages during an evaluation.
 *
 * @param {integer} numPages the number of CachedPages to generate. The number
 * of elements in the returned Array
 * @param {string} nonce a string that will be incorporated somehow into the
 * captureUrl value of the CachedPage. This is intended to allow the querier to
 * verify that the response has been generated based solely on this request.
 *
 * @return {Array<CachedPage>}
 */
exports.generateDummyPages = function(numPages, nonce) {
  var result = [];

  for (var i = 0; i < numPages; i++) {
    var page = exports.generateDummyPage(i, nonce);
    result.push(page);
  }

  return result;
};

/**
 * @param {integer} index position in the final Array for this page
 * @param {string} nonce the unique string that will be contained in the
 * captureUrl value of the resulting CachedPage
 *
 * @return {CachedPage}
 */
exports.generateDummyPage = function(index, nonce) {
  var captureUrl = 'www.' + nonce + '.' + index + '.com';
  var captureDate = new Date().toISOString();
  var path = 'http://somepath';
  var metadata = { muchMeta: 'so data' };

  var result = new datastore.CachedPage(
    captureUrl,
    captureDate,
    path,
    metadata
  );
  return result;
};

/**
 * Generate a response mirroring the functionality of
 * server-api.getResponseForAllCachedPages to be used for evaluation.
 *
 * @param {integer} numPages the number of responses to return
 * @param {string} nonce a string to incorporate into answers
 *
 * @return {object} the JSON server response
 */
exports.getDummyResponseForAllCachedPages = function(numPages, nonce) {
  var pages = exports.generateDummyPages(numPages, nonce);
  var result = {};
  result.metadata = api.createMetadatObj();
  result.cachedPages = pages;
  return result;
};

/**
 * @return {number} return window.performance.now()
 */
exports.getNow = function() {
  return window.performance.now();
};

/**
 * Log an event time to local storage. The key will be scoped for timing and
 * time will be added to a list of times to that value. E.g. logTim('foo', 3)
 * would result in a value like { timing_foo: [ 3 ] } being added to local
 * storage. Subsequent calls would append to that list.
 *
 * @param {string} key the key that will be scoped and set in chrome.storage
 * @param {number} time the timing value that will be logged
 *
 * @return {Promise} Promise that resolves when the write completes
 */
exports.logTime = function(key, time) {
  var scopedKey = exports.createTimingKey(key);
  return new Promise(function(resolve) {
    exports.getTimeValues(key)
      .then(existingValues => {
        var setObj = {};
        if (existingValues) {
          existingValues.push(time);
          setObj[scopedKey] = existingValues;
        } else {
          // New value.
          setObj[scopedKey] = [ time ];
        }
        return storage.set(setObj);
      })
      .then(() => {
        resolve();
      });
  });
};

/**
 * Get the list of values logged for a particular key. This is essentially just
 * a getter that accounts for the prefix scoping applied to the key by this
 * module. E.g. if you save an event as 'foo', it will be scoped in chrome
 * storage as something like 'timing_foo'. Passing 'foo' to this method will
 * scope the key and return the result.
 *
 * @param {string} key
 *
 * @return {Promise -> any} Promise that resolves with the value paired to this
 * key in storage. Returns null if the value is not present.
 */
exports.getTimeValues = function(key) {
  return new Promise(function(resolve) {
    var scopedKey = exports.createTimingKey(key);
    storage.get(scopedKey)
    .then(existingValues => {
      if (existingValues && existingValues[scopedKey]) {
        resolve(existingValues[scopedKey]);
      } else {
        // Not present.
        resolve(null);
      }
    });
  });
};

/**
 * Execute an array of Promise returning functions in order, one after another.
 *
 * @param{Array<function>} promises an Array of functions that return a Promise
 * that should be executed.
 * @return {Promise -> Array<object>} Promise that resolves with an array of
 * objects. Each object will be a key value pair of either { resolved: value }
 * or { rejected: value } representing the value that either resolved or
 * rejected from the Promise.
 */
exports.fulfillPromises = function(promises) {
  return new Promise(function(resolve) {
    var result = [];
    var seedPromise = Promise.resolve(null);

    // Now we have an array with all our promises. We want to execute them
    // sequentially, for which we will use reduce. seedPromise will be our
    // initial value--a promise that returns null.
    promises.reduce(function(cur, next) {
      return cur.then(time => {
        if (time !== null) {
          // should always have a value except for the first time
          result.push({ resolved: time });
        }
      })
      .catch(err => {
          result.push({ caught: err });
      })
      .then(next);
    }, seedPromise).then(lastVal => {
      // All executed.
      // lastVal is the resolved value of the last promise. 
      result.push({ resolved: lastVal });
      resolve(result);
    })
    .catch(lastVal => {
      result.push({ caught: lastVal });
      resolve(result);
    });
  });
};

/**
 * Run a time trial for discovering peers.
 *
 * @param {integer} numPeers the number of peers you are running against
 * @param {integer} numPages the number of pages you will tell each peer to
 * return
 * @param {integer} numIterations the number of times you wish to run the
 * trial
 * @param {string} key the key to which the trials will be logged in storage
 *
 * @return {Promise -> Array} Promise that resolves when all the trials
 * are complete. Resolves with an Array of the resolved results of the
 * individual iterations
 */
exports.runDiscoverPeerPagesTrial = function(
  numPeers,
  numPages,
  numIterations,
  key
  ) {
  key = key || 'lastEval';
  return new Promise(function(resolve) {
    // We will call runDiscoverPagesIteration and attach them all to a sequence
    // of Promises, such that they will resolve in order.
    var iteration = 0;
    var nextIter = function() {
      return exports.runDiscoverPeerPagesIteration(numPeers, numPages)
      .then(iterationResult => {
        var toLog = {};
        toLog.timing = iterationResult;
        toLog.type = 'discoverPeers';
        toLog.numPeers = numPeers;
        toLog.numPages = numPages;
        toLog.numIterations = numIterations;
        toLog.iteration = iteration;
        exports.logTime(key, toLog);
        iteration += 1;
        return Promise.resolve(iterationResult);
      });
    };

    var promises = [];
    for (var i = 0; i < numIterations; i++) {
      promises.push(nextIter);
    }

    // Now we have an array with all our promises.
    exports.fulfillPromises(promises)
    .then(results => {
      console.warn('Done with trial: ', results);
      resolve(results);
    });
  });
};

/**
 * @param {string} ipAddress
 * @param {integer} port
 * @param {integer} numPages
 *
 * @return {string} a complete URL that generates a mocked response for
 * evaluation
 */
exports.getEvalPagesUrl = function(ipAddress, port, numPages) {
  var result = 'http://' +
    ipAddress +
    ':' +
    port +
    '/' +
    api.getApiEndpoints().evalListPages +
    '?numPages=' +
    numPages;
  return result;
};

/**
 * Run a single iteration of a discover peers trial. This will query the
 * network for peers, expecting to discover numPeers number of peers. It will
 * then query each peer, expecting each peer to have numPages available. It
 * will time this occurence and resolve with the amount of time it took.
 *
 * @param {integer} numPeers the number of peers you expect
 * @param {integer} numPages the number of pages expected to be on each peer
 *
 * @return {Promise -> number} Promise that resolves with the time it took to
 * run the trial. Rejects if it cannot find the correct number of peers or
 * pages.
 */
exports.runDiscoverPeerPagesIteration = function(numPeers, numPages) {
  return new Promise(function(resolve, reject) {
    var startBrowse = exports.getNow();
    var finishBrowsePeers = null;
    var finishBrowsePages = null;
    appc.getBrowseableCaches()
    .then(caches => {
      console.log('found peers: ', caches);

      if (caches.length !== numPeers) {
        var message = 'missing peer: found ' +
          caches.length +
          ', expected ' +
          numPeers;
        reject({
          err: message
        });
      }

      finishBrowsePeers = exports.getNow();
      
      // We'll create a fetch for each listUrl.
      var promises = [];
      caches.forEach(cache => {
        var evalUrl = exports.getEvalPagesUrl(
          cache.ipAddress,
          cache.port,
          numPages
        );
        var prom = util.fetchJson(evalUrl);
        promises.push(prom);
      });

      return Promise.all(promises);
    })
    .then(cacheJsons => {
      console.log('found caches: ', cacheJsons);

      cacheJsons.forEach(cacheJson => {
        if (cacheJson.cachedPages.length !== numPages) {
          var message = 'missing pages: found ' +
            cacheJson.cachedPages.length +
            ', expected ' +
            numPages;
          reject({
            err: message
          });
        }
      });
      finishBrowsePages = exports.getNow();
    })
    .then(() => {
      var timeBrowsePeers = finishBrowsePeers - startBrowse;
      var timeBrowsePages = finishBrowsePages - finishBrowsePeers;
      var totalTime = finishBrowsePages - startBrowse;

      var result = {
        timeBrowsePeers: timeBrowsePeers,
        timeBrowsePages: timeBrowsePages,
        totalTime: totalTime
      };

      resolve(result);
    });
  });
};

/**
 * Load every page in the cache numIterations results and log the results.
 *
 * @param {integer} numIterations the number of times to load each page
 * @param {string} key the key to which the results will be stored in chrome
 * storage
 * @param {string} listPagesUrl the URL of the cache the exposes the JSON end
 * point with the contents of the cache
 *
 * @return {Promise} Promise that resolves with the results of the trial when
 * it is complete
 */
exports.runLoadPageTrialForCache = function(numIterations, key, listPagesUrl) {
  return new Promise(function(resolve) {
    // Start by waiting five seconds. This is really just a convenience to keep
    // us from retching and opening in the console window immediately after we
    // start the function, which somehow seems
    // to reliably crash chrome.
    util.wait(5000)
      .then(() => {
        return util.fetchJson(listPagesUrl);
      })
      .then(cache => {
        // We will call runDiscoverPagesIteration and attach them all to a
        // sequence of Promises, such that they will resolve in order.
        var numCalls = 0;
        var nextIter = function() {
          var cachedPage = cache.cachedPages[numCalls];
          numCalls += 1;
          return exports.runLoadPageTrial(
            numIterations,
            key,
            cachedPage.captureUrl,
            cachedPage.captureDate,
            cachedPage.accessPath,
            cachedPage.metadata
          );
        };

        var promises = [];
        for (var i = 0; i < cache.cachedPages.length; i++) {
          promises.push(nextIter);
        }

        // Now we have an array with all our promises.
        return exports.fulfillPromises(promises);
      })
      .then(results => {
        resolve(results);
      });
  });
};

exports.runLoadPageIteration = function(
  captureUrl,
  captureDate,
  mhtmlUrl,
  metadata
) {
  return appc.saveMhtmlAndOpen(captureUrl, captureDate, mhtmlUrl, metadata);
};

exports.runLoadPageTrial = function(
  numIterations,
  key,
  captureUrl,
  captureDate,
  mhtmlUrl,
  metadata
) {
  key = key || 'lastLoad';
  return new Promise(function(resolve) {
    // We will call runDiscoverPagesIteration and attach them all to a sequence
    // of Promises, such that they will resolve in order.
    var nextIter = function() {
      return exports.runLoadPageIteration(
        captureUrl,
        captureDate,
        mhtmlUrl,
        metadata
      )
      .then(iterationResult => {
        var toLog = {};
        toLog.timeToOpen = iterationResult;
        toLog.captureUrl = captureUrl;
        toLog.numIterations = numIterations;
        toLog.mhtmlUrl = mhtmlUrl;
        toLog.fullUrl = metadata.fullUrl;
        exports.logTime(key, toLog);
        return Promise.resolve(iterationResult);
      });
    };

    var promises = [];
    for (var i = 0; i < numIterations; i++) {
      promises.push(nextIter);
    }

    // Now we have an array with all our promises.
    exports.fulfillPromises(promises)
    .then(results => {
      resolve(results);
    });
  });
};

/**
 * @param {string} key the key of time results to download as csv
 */
exports.downloadKeyAsCsv = function(key) {
  exports.getTimeValues(key)
  .then(values => {
    if (values === null) {
      console.log('no results saved for key: ', key);
    } else {
      console.log(values);
      // And now download a CSV.
      var csv = json2csv({data: values, flatten: true});
      util.downloadText(csv, key + '.csv');
    }
  });
};
