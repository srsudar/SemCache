'use strict';

const bloomFilter = require('./bloom-filter');

const BloomFilter = bloomFilter.BloomFilter;


/**
 * Objects relevant to coalescence between instances on the local network.
 */

/**
 * Create a Digest object from a list of pages saved on a peer. This
 * associates information about the peer as well as access information.
 *
 * @constructor
 */
class Digest {
  constructor(peerInfo, pageInfos) {
    this.peerInfo = peerInfo;

    // Now process the pageInfos.
    this.digestInfo = {};
    pageInfos.forEach(pageInfo => {
      this.digestInfo[pageInfo.fullUrl] = pageInfo.captureDate;
    });
  }

  /**
   * Query the digest to see if the page contains the given URL.
   *
   * @param {string} url
   *
   * @return {string|null} null if the digest does not contain the page,
   * otherwise the timestamp of the page
   */
  performQueryForPage(url) {
    let captureDate = this.digestInfo[url];
    if (captureDate) {
      return captureDate;
    } else {
      return null;
    }
  }
}

/**
 * Wrapper around the pure Bloom filter implementation that includes
 * information about the peer itself.
 */
class PeerBloomFilter {
  /**
   * @param {Object} peerInfo
   * @param {BloomFilter|Buffer} bloom
   */
  constructor(peerInfo, bloom) {
    this.peerInfo = peerInfo;

    // Now process the pageInfos.
    if (Buffer.isBuffer(bloom)) {
      this.bloomFilter = BloomFilter.fromBuffer(bloom);
    } else if (bloom instanceof BloomFilter) {
      this.bloomFilter = bloom;
    } else {
      console.log(bloom);
      throw new Error('bloom must be Buffer or BloomFilter');
    }
  }

  /**
   * Query the Bloom filter to see if it contains the given url.
   *
   * @param {string} url
   *
   * @return {boolean} true if the peer likely has the URL, else false. Note
   * that we cannot return a capture date with the Bloom filter strategy, so we
   * do not have complete API parity with the Digest strategy.
   */
  performQueryForPage(url) {
    return this.bloomFilter.test(url);
  }
}

exports.Digest = Digest;
exports.PeerBloomFilter = PeerBloomFilter;
