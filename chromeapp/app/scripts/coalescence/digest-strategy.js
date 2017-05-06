'use strict';

var dnssdSem = require('../dnssd/dns-sd-semcache');
var objects = require('./objects');
var peerIf = require('../peer-interface/common');
var peerIfMgr = require('../peer-interface/manager');

/**
 * This module is responsible for the digest strategy of cache coalescence.
 *
 * The digest strategy is to obtain a list of all the available pages from
 * peers and check those lists.
 */

/**
 * This is the data structure in which we're storing the digests from peers.
 *
 * Contains objects 
 */
var DIGESTS = [];

var IS_INITIALIZED = false;
var IS_INITIALIZING = false;

/**
 * Reset any state saved by this module
 */
exports.reset = function() {
  exports.setDigests([]);
  IS_INITIALIZED = false;
  // If an initialization is in progress, this could not be a complete reset.
  IS_INITIALIZING = false;
};

/**
 * Replace the saved Digest state with this new information.
 *
 * @param {Array.<Digest>} digests
 */
exports.setDigests = function(digests) {
  DIGESTS = digests;
};

/**
 * Indicates if the module is ready to perform queries.
 *
 * @return {boolean} true if queries can be performed
 */
exports.isInitialized = function() {
  return IS_INITIALIZED;
};

/**
 * Indicates if we are currently initializing.
 *
 * @return {boolean}
 */
exports.isInitializing = function() {
  return IS_INITIALIZING;
};

/**
 * Initialize the strategy.
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when
 * initialization is complete.
 */
exports.initialize = function() {
  if (exports.isInitializing()) {
    // no-op
    return Promise.resolve();
  }
  if (exports.isInitialized()) {
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

  return new Promise(function(resolve, reject) {
    dnssdSem.browseForSemCacheInstances()
    .then(peerInfos => {
      var peerAccessor = peerIfMgr.getPeerAccessor();
      return exports.getAndProcessDigests(peerAccessor, peerInfos);
    })
    .then(digests => {
      exports.setDigests(digests);
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
exports.getAndProcessDigests = function(peerInterface, peerInfos) {
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
      .then(rawDigest => {
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
 * @param {Array.<string>} urls Array of URLs for which to query
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an Object of
 * information about the urls or rejects with an Error. The Object is like the
 * following:
 *   {
 *     url: [NetworkCachedPage, NetworkCachedPage],
 *   }
 */
exports.performQuery = function(urls) {
  if (!exports.isInitialized()) {
    console.warn('digest-strategy was queried but is not initialized');
  }
  return new Promise(function(resolve, reject) {
    Promise.resolve()
    .then(() => {
      var result = {};
      urls.forEach(url => {
        var copiesForUrl = [];
        DIGESTS.forEach(digest => {
          var captureDate = digest.performQueryForPage(url);
          if (captureDate) {
            var NetworkCachedPage = new objects.NetworkCachedPage(
              'probable',
              {
                url: url,
                captureDate: captureDate
              },
              digest.peerInfo
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
