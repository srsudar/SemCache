'use strict';

const cmgr = require('../webrtc/connection-manager');


class WebrtcClient {
  /**
   * @param {string} ipAddress
   * @param {number} port
   */
  constructor({ ipAddress, port } = {}) {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  getIpAddress() {
    return this.ipAddress;
  }

  getPort() {
    return this.port;
  }

  /**
   * @return {Promise.<PeerConnection, Error>}
   */
  getConnection() {
    return cmgr.getOrCreateConnection(this.getIpAddress(), this.getPort());
  }

  /**
   * Retrieve a cached page from a peer.
   *
   * @param {string} href
   *
   * @return {Promise.<CPDisk, Error>}
   */
  getCachedPage(href) {
    return this.getConnection()
      .then(peerConnection => {
        return peerConnection.getCachedPage(href);
      });
  }

  /**
   * Retrieve the list of pages in the peer's cache.
   *
   * @param {number} offset
   * @param {number} limit
   *
   * @return {Promise.<Object, Error>}
   */
  getList(offset, limit) {
    return this.getConnection()
      .then(peerConnection => {
        return peerConnection.getList(offset, limit);
      });
  }

  /**
   * Retrieve the list of cached pages available in this cache.
   *
   * @return {Promise.<Object, Error>} Promise that resolves with the digest
   * response or rejects with an Error.
   */
  getCacheDigest() {
    return this.getConnection()
      .then(peerConnection => {
        return peerConnection.getCacheDigest();
      });
  }

  /**
   * @return {Promise.<BloomFilter, Error>}
   */
  getCacheBloomFilter() {
    return this.getConnection()
      .then(peerConnection => {
        return peerConnection.getCacheBloomFilter();
      });
  }
}

exports.WebrtcClient = WebrtcClient;
