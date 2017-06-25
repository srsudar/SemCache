'use strict';

var dnssdSem = require('../dnssd/dns-sd-semcache');
var objects = require('./objects');
var peerIf = require('../peer-interface/common');
var peerIfMgr = require('../peer-interface/manager');
var util = require('./util');
var evaluation = require('../evaluation');

var EVAL_NUM_DIGESTS = 30;
var EVAL_NUM_PAGES_IN_DIGEST = 1000;

/**
 * This module is responsible for the digest strategy of cache coalescence.
 */

/**
 * This is the data structure in which we're storing the digests from peers.
 *
 * Contains objects 
 */
var BLOOM_FILTERS = [];

var IS_INITIALIZED = false;
var IS_INITIALIZING = false;

/**
 * An implementation of the coalescence strategy API.
 *
 * The Bloom filter strategy is to check a Bloom filter for URLs.
 * @constructor
 */
exports.BloomStrategy = function BloomStrategy() {
  if (!(this instanceof BloomStrategy)) {
    throw new Error('BloomStrategy must be called with new');
  }
  // Don't like that we are basically exposing module-level state that isn't
  // tied to this object, but going to leave it for now. This is basically
  // giving an object-based API onto the global state, which is a bit ugly but
  // I'm going to allow it for the near-term.
};

/**
 * Reset any state saved by this module
 */
exports.BloomStrategy.prototype.reset = function() {
  this.setBloomFilters([]);
  IS_INITIALIZED = false;
  // If an initialization is in progress, this could not be a complete reset.
  IS_INITIALIZING = false;
};

/**
 * Replace the saved Digest state with this new information.
 *
 * @param {Array.<BloomFilter>} digests
 */
exports.BloomStrategy.prototype.setBloomFilters = function(filters) {
  BLOOM_FILTERS = filters;
};

/**
 * Indicates if the module is ready to perform queries.
 *
 * @return {boolean} true if queries can be performed
 */
exports.BloomStrategy.prototype.isInitialized = function() {
  return IS_INITIALIZED;
};

/**
 * Indicates if we are currently initializing.
 *
 * @return {boolean}
 */
exports.BloomStrategy.prototype.isInitializing = function() {
  return IS_INITIALIZING;
};

/**
 * Initialize the strategy.
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when
 * initialization is complete.
 */
exports.BloomStrategy.prototype.initialize = function() {
  if (this.isInitializing()) {
    // no-op
    return Promise.resolve();
  }
  if (this.isInitialized()) {
    // We're already initialized, just no-op.
    return Promise.resolve();
  }
  // Initialization consists of the following steps:
  // 1) Query the network for peers
  // 2) For each peer, get their digest
  // 3) Process the digests
  // 4) Update our module data structures with this information
  // 5) Declare that we are initialized
  IS_INITIALIZING = true;
  var that = this;

  return new Promise(function(resolve, reject) {
    // Changing this for evaluation.
    // console.warn('COALESCENCE IS IN EVALUATION MODE');
    // This code is for the real mode.
    dnssdSem.browseForSemCacheInstances()
    .then(peerInfos => {
      return util.removeOwnInfo(peerInfos);
    }).then(peerInfos => {
      var peerAccessor = peerIfMgr.getPeerAccessor();
      return that.getAndProcessDigests(peerAccessor, peerInfos);
    })
    // This code is for evaluation mode.
    // Promise.resolve()
    // .then(() => {
    //   return evaluation.generateDummyPeerBloomFilters(
    //     EVAL_NUM_DIGESTS, EVAL_NUM_PAGES_IN_DIGEST
    //   );
    // })
    .then(bloomFilters => {
      that.setBloomFilters(bloomFilters);
      IS_INITIALIZING = false;
      IS_INITIALIZED = true;
      resolve();
    })
    .catch(err => {
      IS_INITIALIZING = false;
      reject(err);
    });
  });
};

/**
 * Obtain digests from the peers indicated in peerInfos and process them. If
 * any peers could not be connected to, an error is logged but the process is
 * not terminated. Does not update any of the module's data structures.
 *
 * @param {WebrtcPeerAccessor|HttpPeerAccessor} peerInterface a peer interface
 * for the given transport protocol
 * @param {Array.<Object>} peerInfos the objects containing information to
 * connect to peers as returned from the browse service functions
 *
 * @return {Promise.<Array<Digest>>}
 */
exports.BloomStrategy.prototype.getAndProcessDigests = function(
  peerInterface, peerInfos
) {
  // Query them, create digests for those that succeed.
  // Note that there is some trickiness here about the best strategy by which
  // to do this. If we want to avoid congestion, we might want to query them
  // serially, not worrying if something has rejected. We need to tolerate
  // rejection in case a peer leaves while we are issuing the query. That is
  // ok and should be tolerated. The fulfillPromises in the evaluation module
  // could work for this.
  //
  // For now we are just going to countdown waiting for the promises to settle.
  return new Promise(function(resolve) {
    var pendingResponses = peerInfos.length;
    var result = [];
    peerInfos.forEach(peerInfo => {
      var params = peerIf.createListParams(
        peerInfo.ipAddress, peerInfo.port, null
      );
      peerInterface.getCacheDigest(params)
      .then(digestResponse => {
        var rawDigest = digestResponse.digest;
        pendingResponses--;
        var digest = new objects.Digest(peerInfo, rawDigest);
        result.push(digest);
        if (pendingResponses === 0) {
          resolve(result);
        }
      })
      .catch(err => {
        // Swallow this one, as we expect some errors
        console.log('Ignoreable error fetching digest: ', err);
        pendingResponses--;
        if (pendingResponses === 0) {
          resolve(result);
        }
      });
    });
  });
};

/**
 * Obtain access information for the given array of URLs. The result will be an
 * array of length <= urls.length. Only those that are available will be
 * present.
 *
 * Note that this strategy cannot set capture dates.
 *
 * @param {Array.<string>} urls Array of URLs for which to query
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an Object of
 * information about the urls or rejects with an Error. The Object is like the
 * following:
 *   {
 *     url: [NetworkCachedPage, NetworkCachedPage],
 *   }
 */
exports.BloomStrategy.prototype.performQuery = function(urls) {
  if (!this.isInitialized()) {
    console.warn('digest-strategy was queried but is not initialized');
  }
  return new Promise(function(resolve, reject) {
    Promise.resolve()
    .then(() => {
      var result = {};
      urls.forEach(url => {
        var copiesForUrl = [];
        BLOOM_FILTERS.forEach(bloomFilter => {
          var captureDate = bloomFilter.performQueryForPage(url);
          if (captureDate) {
            var NetworkCachedPage = new objects.NetworkCachedPage(
              'probable',
              {
                url: url,
              },
              bloomFilter.peerInfo
            );
            copiesForUrl.push(NetworkCachedPage);
          }
        });
        if (copiesForUrl.length > 0) {
          result[url] = copiesForUrl;
        }
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};
