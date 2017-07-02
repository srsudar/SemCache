'use strict';

const objects = require('./objects');
const strategy = require('./strategy');

const CoalescenceStrategy = strategy.CoalescenceStrategy;

/**
 * An implementation of the coalescence strategy API.
 *
 * The Bloom filter strategy is to check a Bloom filter for URLs.
 */
class BloomStrategy extends CoalescenceStrategy {
  getResourceFromPeer(peerAccessor, peerInfo) {
    return peerAccessor.getCacheBloomFilter()
      .then(bloomFilter => {
        let peerBf = new objects.PeerBloomFilter(peerInfo, bloomFilter);
        return peerBf;
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
      console.warn('bloom-strategy was queried but is not initialized');
    }
    let self = this;
    return new Promise(function(resolve, reject) {
      Promise.resolve()
      .then(() => {
        let result = {};
        urls.forEach(url => {
          let copiesForUrl = [];
          self.getResources().forEach(bloomFilter => {
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
