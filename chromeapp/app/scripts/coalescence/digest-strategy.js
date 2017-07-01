'use strict';

const objects = require('./objects');
const coalescenceStrategy = require('./strategy');

const CoalescenceStrategy = coalescenceStrategy.CoalescenceStrategy;


/**
 * This module is responsible for the digest strategy of cache coalescence.
 */

/**
 * An implementation of the coalescence strategy API.
 *
 * The digest strategy is to obtain a list of all the available pages from
 * peers and check those lists.
 */
class DigestStrategy extends CoalescenceStrategy {
  getResourceFromPeer(peerAccessor, peerInfo) {
    return peerAccessor.getCacheDigest()
      .then(digestResponse => {
        let rawDigest = digestResponse;
        let digest = new objects.Digest(peerInfo, rawDigest);
        return digest;
      });
  }

  /**
   * Obtain access information for the given array of URLs. The result will be
   * an array of length <= urls.length. Only those that are available will be
   * present.
   *
   * @param {Array.<string>} urls Array of URLs for which to query
   *
   * @return {Promise.<Object, Error>} Promise that resolves with an Object of
   * information about the urls or rejects with an Error. The Object is like
   * the following:
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
  performQuery(urls) {
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
          self.getResources().forEach(digest => {
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
  }
}

exports.DigestStrategy = DigestStrategy;
