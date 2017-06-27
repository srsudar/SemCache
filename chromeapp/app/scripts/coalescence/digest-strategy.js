'use strict';

const dnssdSem = require('../dnssd/dns-sd-semcache');
const objects = require('./objects');
const peerIf = require('../peer-interface/common');
const peerIfMgr = require('../peer-interface/manager');
const util = require('./util');


/**
 * This module is responsible for the digest strategy of cache coalescence.
 */

/**
 * An implementation of the coalescence strategy API.
 *
 * The digest strategy is to obtain a list of all the available pages from
 * peers and check those lists.
 * @constructor
 */
exports.DigestStrategy = function DigestStrategy() {
  if (!(this instanceof DigestStrategy)) {
    throw new Error('DigestStrategy must be called with new');
  }
  // Don't like that we are basically exposing module-level state that isn't
  // tied to this object, but going to leave it for now. This is basically
  // giving an object-based API onto the global state, which is a bit ugly but
  // I'm going to allow it for the near-term.

  /**
   * This is the data structure in which we're storing the digests from peers.
   *
   * Contains objects 
   */
  this.DIGESTS = [];

  this.IS_INITIALIZED = false;
  this.IS_INITIALIZING = false;
};

/**
 * Reset any state saved by this module
 */
exports.DigestStrategy.prototype.reset = function() {
  this.setDigests([]);
  this.IS_INITIALIZED = false;
  // If an initialization is in progress, this could not be a complete reset.
  this.IS_INITIALIZING = false;
};

/**
 * Replace the saved Digest state with this new information.
 *
 * @param {Array.<Digest>} digests
 */
exports.DigestStrategy.prototype.setDigests = function(digests) {
  this.DIGESTS = digests;
};

/**
 * Indicates if the module is ready to perform queries.
 *
 * @return {boolean} true if queries can be performed
 */
exports.DigestStrategy.prototype.isInitialized = function() {
  return this.IS_INITIALIZED;
};

/**
 * Indicates if we are currently initializing.
 *
 * @return {boolean}
 */
exports.DigestStrategy.prototype.isInitializing = function() {
  return this.IS_INITIALIZING;
};

/**
 * Initialize the strategy.
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when
 * initialization is complete.
 */
exports.DigestStrategy.prototype.initialize = function() {
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
  this.IS_INITIALIZING = true;
  let self = this;

  return new Promise(function(resolve, reject) {
    dnssdSem.browseForSemCacheInstances()
    .then(peerInfos => {
      return util.removeOwnInfo(peerInfos);
    }).then(peerInfos => {
      let peerAccessor = peerIfMgr.getPeerAccessor();
      return self.getAndProcessDigests(peerAccessor, peerInfos);
    })
    .then(digests => {
      self.setDigests(digests);
      self.IS_INITIALIZING = false;
      self.IS_INITIALIZED = true;
      resolve();
    })
    .catch(err => {
      self.IS_INITIALIZING = false;
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
exports.DigestStrategy.prototype.getAndProcessDigests = function(
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
    if (peerInfos.length === 0) {
      resolve([]);
      return;
    }
    let pendingResponses = peerInfos.length;
    let result = [];
    peerInfos.forEach(peerInfo => {
      let params = peerIf.createListParams(
        peerInfo.ipAddress, peerInfo.port, null
      );
      peerInterface.getCacheDigest(params)
      .then(digestResponse => {
        let rawDigest = digestResponse.digest;
        pendingResponses--;
        let digest = new objects.Digest(peerInfo, rawDigest);
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
 *     url: [ Object, ... ]
 *   }
 *
 * The Object is like:
 * {
 *   friendlyName: 'Sam Cache',
 *   serviceName: 'Sam Cache._semcache._tcp.local',
 *   href: 'http://foo.org',
 *   captureDate: iso date string
 * }
 */
exports.DigestStrategy.prototype.performQuery = function(urls) {
  let self = this;
  if (!this.isInitialized()) {
    console.warn('digest-strategy was queried but is not initialized');
  }
  return new Promise(function(resolve, reject) {
    Promise.resolve()
    .then(() => {
      let result = {};
      urls.forEach(url => {
        let copiesForUrl = [];
        self.DIGESTS.forEach(digest => {
          let captureDate = digest.performQueryForPage(url);
          if (captureDate) {
            let page = {
              friendlyName: digest.peerInfo.friendlyName,
              serviceName: digest.peerInfo.instanceName,
              captureHref: url,
              captureDate: captureDate
            };
            copiesForUrl.push(page);
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
