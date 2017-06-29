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
 * The Bloom filter strategy is to check a Bloom filter for URLs.
 */
class BloomStrategy {
  constructor() {
    /**
     * This is the data structure in which we're storing the Bloom filters from
     * peers.
     *
     * Contains objects 
     */
    this.BLOOM_FILTERS = [];

    this.IS_INITIALIZED = false;
    this.IS_INITIALIZING = false;
  }

  /**
   * Reset any state saved by this module
   */
  reset() {
    this.setBloomFilters([]);
    this.IS_INITIALIZED = false;
    // If an initialization is in progress, this could not be a complete reset.
    this.IS_INITIALIZING = false;
  }

  /**
   * Replace the saved Digest state with this new information.
   *
   * @param {Array.<PeerBloomFilter>} digests
   */
  setBloomFilters(filters) {
    this.BLOOM_FILTERS = filters;
  }

  /**
   * Indicates if the module is ready to perform queries.
   *
   * @return {boolean} true if queries can be performed
   */
  isInitialized() {
    return this.IS_INITIALIZED;
  }

  /**
   * Indicates if we are currently initializing.
   *
   * @return {boolean}
   */
  isInitializing() {
    return this.IS_INITIALIZING;
  }

  /**
   * Initialize the strategy.
   *
   * @return {Promise.<undefined, Error>} Promise that resolves when
   * initialization is complete.
   */
  initialize() {
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
      // Changing this for evaluation.
      // console.warn('COALESCENCE IS IN EVALUATION MODE');
      // This code is for the real mode.
      dnssdSem.browseForSemCacheInstances()
      .then(peerInfos => {
        return util.removeOwnInfo(peerInfos);
      }).then(peerInfos => {
        let peerAccessor = peerIfMgr.getPeerAccessor();
        return self.getAndProcessBloomFilters(peerAccessor, peerInfos);
      })
      // This code is for evaluation mode.
      // Promise.resolve()
      // .then(() => {
      //   return evaluation.generateDummyPeerBloomFilters(
      //     EVAL_NUM_DIGESTS, EVAL_NUM_PAGES_IN_DIGEST
      //   );
      // })
      .then(bloomFilters => {
        self.setBloomFilters(bloomFilters);
        self.IS_INITIALIZING = false;
        self.IS_INITIALIZED = true;
        resolve();
      })
      .catch(err => {
        self.IS_INITIALIZING = false;
        reject(err);
      });
    });
  }

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
   * @return {Promise.<Array<PeerBloomFilter>>}
   */
  getAndProcessBloomFilters(peerInterface, peerInfos) {
    // Query them, create digests for those that succeed.  Note that there is
    // some trickiness here about the best strategy by which to do this. If we
    // want to avoid congestion, we might want to query them serially, not
    // worrying if something has rejected. We need to tolerate rejection in
    // case a peer leaves while we are issuing the query. That is ok and should
    // be tolerated. The fulfillPromises in the evaluation module could work
    // for this.
    //
    // For now we are just going to countdown waiting for the promises to
    // settle.
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
        peerInterface.getCacheBloomFilter(params)
        .then(bloomFilter => {
          pendingResponses--;
          let peerBf = new objects.PeerBloomFilter(peerInfo, bloomFilter);
          result.push(peerBf);
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
  }

  /**
   * Obtain access information for the given array of URLs. The result will be
   * an array of length <= urls.length. Only those that are available will be
   * present.
   *
   * Note that this strategy cannot set capture dates.
   *
   * @param {Array.<string>} urls Array of URLs for which to query
   *
   * @return {Promise.<Object, Error>} Promise that resolves with an Object of
   * information about the urls or rejects with an Error. The Object is like
   * the following:
   *   {
   *     url: [NetworkCachedPage, NetworkCachedPage],
   *   }
   */
  performQuery(urls) {
    if (!this.isInitialized()) {
      console.warn('digest-strategy was queried but is not initialized');
    }
    let self = this;
    return new Promise(function(resolve, reject) {
      Promise.resolve()
      .then(() => {
        let result = {};
        urls.forEach(url => {
          let copiesForUrl = [];
          self.BLOOM_FILTERS.forEach(bloomFilter => {
            let isPresent = bloomFilter.performQueryForPage(url);
            if (isPresent) {
              let info = {
                friendlyName: bloomFilter.peerInfo.friendlyName,
                serviceName: bloomFilter.peerInfo.instanceName,
                captureHref: url
              };
              copiesForUrl.push(info);
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
  }
}

exports.BloomStrategy = BloomStrategy;
