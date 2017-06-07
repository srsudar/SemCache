'use strict';

/**
 * Functionality useful to evaluating SemCache.
 */

var json2csv = require('json2csv');

var api = require('./server/server-api');
var appc = require('./app-controller');
var bloomFilter = require('./coalescence/bloom-filter');
var chromep = require('./chrome-apis/chromep');
var coalObjects = require('./coalescence/objects');
var datastore = require('./persistence/datastore');
var ifCommon = require('./peer-interface/common');
var peerIfMgr = require('./peer-interface/manager');
var util = require('./util');

/** The prefix value for timing keys we will use for local storage. */
var TIMING_KEY_PREFIX = 'timing_';

/**
 * These URLs will be shared across all dummy Digests created for Digest query
 * evaluations.
 */
exports.SHARED_DUMMY_URLS = [
  // The trailing slashes here are important, since chrome's a.href adds a
  // trailing slash.
  'http://all-caches0.com/',
  'http://all-caches1.com/',
  'http://all-caches2.com/'
];

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
 * @return {Array.<CachedPage>}
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
 * @return {Object} the JSON server response
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
 * Wrapper around window.performance.
 *
 * @return {window.performance}
 */
exports.getPerf = function() {
  return window.performance;
};

/**
 * Wrapper around window.performance.mark(name).
 */
exports.mark = function(name) {
  exports.getPerf().mark(name);
};

/**
 * Generate keys from the marks that have been set during a test. These objects
 * will be keyed to times. If you issue two marks, 'alpha', 'beta', the
 * resulting object will be like the following:
 * {
 *   MARK_alpha: {number},
 *   MARK_beta: {number},
 *   MARK_alpha_TO_mark_beta: {number}
 * }
 *
 * @return {Object}
 */
exports.getKeysFromMarks = function() {
  var marks = exports.getPerf().getEntriesByType('mark');
  var prefix = 'MARK_';
  var infix = '_TO_';

  var result = {};
  
  marks.forEach(mark => {
    var key = prefix + mark.name;
    result[key] = mark.startTime;
  });

  for (var i = 1; i < marks.length; i++) {
    var a = marks[i - 1];
    var b = marks[i];
    var key = (prefix + a.name) + infix + (prefix + b.name);
    var duration = b.startTime - a.startTime;
    result[key] = duration;
  }

  return result;
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
  return new Promise(function(resolve, reject) {
    var scopedKey = exports.createTimingKey(key);
    exports.getTimeValues(key)
    .then(existingValues => {
      var setObj = {};
      var objToLog = time;
      var keysFromMarks = exports.getKeysFromMarks();
      if (time !== null && typeof time !== 'object') {
        objToLog = { time: time };
      }
      objToLog.keysFromMarks = keysFromMarks;
      util.getPerf().clearMarks();
      if (existingValues) {
        existingValues.push(objToLog);
        setObj[scopedKey] = existingValues;
      } else {
        // New value.
        setObj[scopedKey] = [ objToLog ];
      }
      return chromep.getStorageLocal().set(setObj);
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
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
 * @return {Promise.<any, Error>} Promise that resolves with the value paired
 * to this key in storage. Returns null if the value is not present.
 */
exports.getTimeValues = function(key) {
  return new Promise(function(resolve, reject) {
    var scopedKey = exports.createTimingKey(key);
    chromep.getStorageLocal().get(scopedKey)
    .then(existingValues => {
      if (existingValues && existingValues[scopedKey]) {
        resolve(existingValues[scopedKey]);
      } else {
        // Not present.
        resolve(null);
      }
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Execute an array of Promise returning functions in order, one after another.
 *
 * @param{Array.<function>} promises an Array of functions that return a
 * Promise that should be executed.
 *
 * @return {Promise.<Array<object>>} Promise that resolves with an array of
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
 * @param {boolean} lazyResolve if true, resolve the peers lazily
 * @param {integer} resolveDelay the number of ms to wait between resolutions
 * if doing a lazy resolve
 *
 * @return {Promise.<Array<any>>} Promise that resolves when all the trials
 * are complete. Resolves with an Array of the resolved results of the
 * individual iterations
 */
exports.runDiscoverPeerPagesTrial = function(
  numPeers,
  numPages,
  numIterations,
  key,
  lazyResolve,
  resolveDelay
  ) {
  key = key || 'lastEval';
  return new Promise(function(resolve) {
    // We will call runDiscoverPagesIteration and attach them all to a sequence
    // of Promises, such that they will resolve in order.
    var iteration = 0;
    var nextIter = function() {
      var toLog = {};
      toLog.type = 'discoverPeers';
      toLog.numPeers = numPeers;
      toLog.numPages = numPages;
      toLog.numIterations = numIterations;
      toLog.iteration = iteration;
      iteration += 1;
      
      // We are seeing different results between clicking the button manually
      // (highly reliable) and automating it (unreliable). We're going to wait
      // a spell to try and narrow down differences.
      return util.wait(8000)
      .then(() => {
        if (lazyResolve) {
          return exports.runDiscoverPeerPagesIterationLazy(
            numPeers, numPages, resolveDelay
          );
        } else {
          return exports.runDiscoverPeerPagesIteration(numPeers, numPages);
        }
      })
      .then(function resolved(iterationResult) {
        toLog.timing = iterationResult;
        exports.logTime(key, toLog);
        return Promise.resolve(iterationResult);
      },
      function rejected(iterationResult) {
        toLog.timing = iterationResult;
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
 * Resolve all peers with timing information.
 *
 * @param {Array.<Object>} cacheNames an Array of objects as returned by
 * appc.getPeerCacheNames()
 * @param {integer} resolveDelay the number of seconds to delay a resolve
 * request, in ms. Attempts to ease the burden on the network.
 * @param {Object} toLog an object that will be logged at the end of the trial
 *
 * @return {Promise.<Array<Object>>} Promise that resolves with an Array of
 * objects as returned by fulfillPromises. Resolved objects will be Objects as
 * returned by appc.resolveCache(). The rejected objects will the errors
 * rejecting in resolveCache().
 */
exports.resolvePeers = function(cacheNames, resolveDelay, toLog) {
  return new Promise(function(resolve) {
    toLog.resolves = [];
    toLog.serviceNames = [];

    var iteration = 0;
    var nextIter = function() {
      var cacheName = cacheNames[iteration];
      var serviceName = cacheName.serviceName;
      var startResolve = null;
      iteration += 1;

      return new Promise(function(resolve, reject) {
        util.wait(resolveDelay)
        .then(() => {
          startResolve = exports.getNow();
          return appc.resolveCache(serviceName);
        })
        .then(cache => {
          var endResolve = exports.getNow();
          var totalResolve = endResolve - startResolve;
          toLog.resolves.push(totalResolve);
          toLog.serviceNames.push(serviceName);
          resolve(cache);
        })
        .catch(err => {
          reject(err); 
        });
      });
    };

    var promises = [];
    for (var i = 0; i < cacheNames.length; i++) {
      promises.push(nextIter);
    }

    exports.fulfillPromises(promises)
    .then(results => {
      resolve(results);
    });
  });
};


/**
 * Run a single iteration of a discover peers trial. Unlike the non-lazy
 * version of this method, however, it only resolves caches as it uses them.
 * This is less likely to overwhelm the network and better respects the DNSSD
 * spec, which suggests only resolving IP address and port lazily, as needed.
 *
 * @param {integer} numPeers the number of peers you expect
 * @param {integer} numPages the number of pages expected to be on each peer
 * @param {integer} resolveDelay the number of milliseconds to wait between
 * resolving each peer.
 *
 * @return {Promise.<Array.<number>>} Promise that resolves with the timing
 * information of the trial
 */
exports.runDiscoverPeerPagesIterationLazy = function(
    numPeers, 
    numPages,
    resolveDelay
) {
  return new Promise(function(resolve, reject) {
    var startBrowse = exports.getNow();
    var finishBrowsePeers = null;
    var finishBrowsePages = null;
    var logInfo = {};
    logInfo.resolveErrs = [];
    logInfo.type = 'discoverPeersLazy';
    appc.getPeerCacheNames()
    .then(cacheNames => {
      console.log('found peer cache names: ', cacheNames);

      if (cacheNames.length !== numPeers) {
        var message = 'missing peer: found ' +
          cacheNames.length +
          ', expected ' +
          numPeers;
        reject({
          err: message
        });
      }

      finishBrowsePeers = exports.getNow();

      return exports.resolvePeers(cacheNames, resolveDelay, logInfo);
    })
    .then(cacheResults => {
      // We'll create a fetch for each listUrl.
      var promises = [];
      cacheResults.forEach(cacheResult => {
        if (!cacheResult.resolved) {
          // probably caught
          logInfo.resolveErrs.push(cacheResult);
          return;
        }
        var cache = cacheResult.resolved;
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
        totalTime: totalTime,
        peerResolves: logInfo
      };

      resolve(result);
    });
  });
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
 * @return {Promise.<number, Error>} Promise that resolves with the time it
 * took to run the trial. Rejects if it cannot find the correct number of peers
 * or pages.
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
 * @return {Promise.<Array.<number>, Error>} Promise that resolves with the
 * results of the trial when it is complete
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
      console.warn('Trial for cache complete: ', results);
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
    var iteration = 0;
    var nextIter = function() {
      var toLog = {};
      toLog.captureUrl = captureUrl;
      toLog.numIterations = numIterations;
      toLog.mhtmlUrl = mhtmlUrl;
      toLog.fullUrl = metadata.fullUrl;
      toLog.type = 'loadPage';
      toLog.iteration = iteration;

      iteration += 1;

      return util.wait(1000)
      .then(() => {
        return exports.runLoadPageIteration(
          captureUrl,
          captureDate,
          mhtmlUrl,
          metadata
        );
      })
      .then(function resolved(iterationResult) {
        toLog.timeToOpen = iterationResult;
        exports.logTime(key, toLog);
        return Promise.resolve(iterationResult);
      }, function caught(iterationResult) {
        toLog.timeToOpen = iterationResult;
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

exports.runFetchFileTrial = function(
  numIterations, key, mhtmlUrl, ipAddr, port, waitMillis
) {
  key = key || 'lastFetch';
  waitMillis = waitMillis || 8000;
  
  return new Promise(function(resolve, reject) {
    var iteration = 0;
    
    // We want to run these trials serially. We're basically using this
    // function as a generator that we'll pass to fulfillPromises.
    var nextIter = function() {
      var toLog = {
        key: key,
        waitMillis: waitMillis,
        mhtmlUrl: mhtmlUrl,
        type: 'fetchFile',
        iteration: iteration,
        numIterations: numIterations
      };

      iteration += 1;

      return util.wait(waitMillis)
      .then(() => {
        return exports.runFetchFileIteration(mhtmlUrl, ipAddr, port);
      })
      .then(iterationResult => {
        toLog.timeToFetch = iterationResult.timeToFetch;
        toLog.fileSize = iterationResult.fileSize;
        exports.logTime(key, toLog);
        return Promise.resolve(iterationResult);
      })
      .catch(err => {
        toLog.error = err;
        exports.logTime(key, toLog);
        return Promise.reject(err);
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
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Fetch a file and report on the information that went into fetching it.
 *
 * @param {string} mhtmlUrl
 * @param {string} ipAddr
 * @param {integer} port
 *
 * @return {Object} Return an object like:
 * {
 *   timeToFetch: {number},
 *   fileSize: {number}
 * }
 */
exports.runFetchFileIteration = function(mhtmlUrl, ipAddr, port) {
  return new Promise(function(resolve, reject) {
    var start = exports.getNow();
    var params = ifCommon.createFileParams(ipAddr, port, mhtmlUrl);
    peerIfMgr.getPeerAccessor().getFileBlob(params)
    .then(blob => {
      // We are fetching, not writing to disk.
      var end = exports.getNow();
      var totalTime = end - start;
      var result = {
        timeToFetch: totalTime,
        fileSize: blob.size
      };
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Generate an array of dummy Digest objects for use in evaluation.
 *
 * @param {integer} numPeers the number of Digests to create
 * @param {integer} numPages the number of pages per Digest. This must be
 * greater than 10, just to make sure we can include our shared page.
 *
 * @return {Array.<Digest>}
 */
exports.generateDummyDigests = function(numDigests, numPages) {
  if (numPages < 10) {
    throw new Error('numPages must be > 10');
  }
  var result = [];

  for (var i = 0; i < numDigests; i++) {
    var ipAddr = i + '.' + i + '.' + i + '.' + i;
    var peerInfo = {
      ipAddress: ipAddr,
      port: i
    };

    var pageInfos = exports.generateDummyPageInfos(numPages, i);

    var digest = new coalObjects.Digest(peerInfo, pageInfos);
    result.push(digest);
  }

  return result;
};

/**
 * Generate an array of dummy Digest objects for use in evaluation.
 *
 * @param {integer} numPeers the number of Digests to create
 * @param {integer} numPages the number of pages per Digest. This must be
 * greater than 10, just to make sure we can include our shared page.
 *
 * @return {Array.<Digest>}
 */
exports.generateDummyPeerBloomFilters = function(numPeers, numPages) {
  if (numPages < 10) {
    throw new Error('numPages must be > 10');
  }
  var result = [];

  for (var i = 0; i < numPeers; i++) {
    var ipAddr = i + '.' + i + '.' + i + '.' + i;
    var peerInfo = {
      ipAddress: ipAddr,
      port: i
    };

    var pageInfos = exports.generateDummyPageInfos(numPages, i);

    var filter = new bloomFilter.BloomFilter();
    pageInfos.forEach(info => {
      filter.add(info.fullUrl);
    });

    var digest = new coalObjects.PeerBloomFilter(peerInfo, filter.serialize());
    result.push(digest);
  }

  return result;
};

/**
 * Generate a list of dummy pageInfos for use with Digest mocking.
 *
 * The url 'http://all-caches.com' will be in all caches. Otherwise the URLs
 * will be 'http://peer2.com/page25/foo-bar-baz-upsidedowncake'. In this way
 * not all the URLs are shared or realistic, necessarily, but they are
 * reproducible.
 *
 * @param {integer} numPages
 * @param {interger} peerNumber this is an integer value of a peer. This is
 * used to generat a name of a URL domain in order to create unique URLs.
 *
 * @return {Array.<Object>} an arry of Objects like:
 * {
 *   fullUrl: 'http://foo.com',
 *   captureDate: 'someDate'
 * }
 */
exports.generateDummyPageInfos = function(numPages, peerNumber) {
  var result = [];
  var pagesRemaining = numPages;

  // Add our shared URLs.
  exports.SHARED_DUMMY_URLS.forEach(commonUrl => {
    pagesRemaining--;
    result.push({
      fullUrl: commonUrl,
      captureDate: new Date().toISOString()
    });
  });

  var pathSuffix = '/foo-bar-baz-upsidedowncake/';
  var urlPrefix = 'http://peer' + peerNumber + '.com/';
  while (pagesRemaining > 0) {
    var pagePath = 'page' + pagesRemaining;
    var fullUrl = urlPrefix + pagePath + pathSuffix;
    var captureDate = new Date().toISOString();

    var pageInfo = {
      fullUrl: fullUrl,
      captureDate: captureDate
    };
    result.push(pageInfo);
    pagesRemaining--;
  }
  
  return result;
};
