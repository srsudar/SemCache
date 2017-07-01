'use strict';

const dnssdSem = require('../dnssd/dns-sd-semcache');
const peerIfMgr = require('../peer-interface/manager');


/**
 * Implements shared functionality of our coalescence strategies.
 */

class CoalescenceStrategy {
  constructor() {
    this.IS_INITIALIZED = false;
    this.IS_INITIALIZING = false;
    this.RESOURCES = [];
  }

  /**
   * Reset any state saved by this module
   */
  reset() {
    this.IS_INITIALIZED = false;
    // If an initialization is in progress, this could not be a complete reset.
    this.IS_INITIALIZING = false;
    // Clear the resources
    this.setResources([]);
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
   * Refresh the contents of the digest.
   *
   * @return {Promise.<Any>} the result of initialize()
   */
  refresh() {
    // We'll re-initialize.
    this.reset();
    return this.initialize();
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
   * Replace the saved resources we've fetched and processed from peers.
   *
   * @param {Array.<any>}
   */
  setResources(resources) {
    this.RESOURCES = resources;
  }

  /**
   * @return {Array.<any>}
   */
  getResources() {
    return this.RESOURCES;
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

    this.IS_INITIALIZING = true;
    let self = this;

    return new Promise(function(resolve, reject) {
      dnssdSem.browseForSemCacheInstances(true)
      .then(peerInfos => {
        if (!self.isInitializing()) {
          // We must have been reset during the fetch
          resolve();
          return;
        }
        return self.getAndProcessResources(peerInfos);
      })
      .then(resources => {
        if (!self.isInitializing()) {
          // We must have been reset during the fetch
          resolve();
          return;
        }
        self.setResources(resources);
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
   * Obtain access information for the given array of URLs. The result will be
   * an array of length <= urls.length. Only those that are available will be
   * present.
   *
   * Note that this strategy cannot set capture dates.
   *
   * @param {Array.<string>} urls Array of URLs for which to query
   *
   * @return {Promise.<Object, Error>} Promise that resolves with an Object of
   * information about the urls or rejects with an Error.
   */
  performQuery(urls) {
    console.log('performQuery called on CoalescenceStrategy, noop', urls);
    // No-op. Subclasses should implement.
  }

  /**
   *
   * Obtain resources from the peers indicated in peerInfos and process them.
   * If any peers could not be connected to, an error is logged but the process
   * is not terminated. Does not update any of the module's data structures.
   *
   * @param {Array.<Object>} peerInfos the objects containing information to
   * connect to peers as returned from the browse service functions
   *
   * @return {Promise.<Array, Error>}
   */
  getAndProcessResources(peerInfos) {
    let self = this;
    // Query them, create digests for those that succeed.
    // Note that there is some trickiness here about the best strategy by which
    // to do this. If we want to avoid congestion, we might want to query them
    // serially, not worrying if something has rejected. We need to tolerate
    // rejection in case a peer leaves while we are issuing the query. That is
    // ok and should be tolerated. The fulfillPromises in the evaluation module
    // could work for this.
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
        let peerInterface = peerIfMgr.getPeerAccessor(
          peerInfo.ipAddress, peerInfo.port
        );
        self.getResourceFromPeer(peerInterface, peerInfo)
        .then(resource => {
          pendingResponses--;
          result.push(resource);
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
   * Try and fetch a resource from a peer. This should be ready to be added to
   * the resource array via a call to setResources(). If the interaction with
   * the peer fails, the Promise should reject to allow the machinery to
   * swallow the error--if a peer has left the network, the whole fetch should
   * not fail.
   *
   * @param {HttpPeerAccessor|WebrtcPeerAccessor} peerAccessor
   * @param {Object} peerInfo
   *
   * @return {Promise.<Object, Error>}
   */
  getResourceFromPeer(peerAccessor, peerInfo) {
    console.log('getResourceFromPeer called on CoalescenceStrategy, no-op');
    console.log(peerAccessor);
  }
}

exports.CoalescenceStrategy = CoalescenceStrategy;
