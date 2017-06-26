'use strict';

const cmgr = require('../webrtc/connection-manager');
const util = require('../util');

class WebrtcPeerAccessor {
  /**
   * @param {string} ipaddr
   * @param {number} port
   */
  constructor({ ipaddr, port } = {}) {
    this.ipaddr = ipaddr;
    this.port = port;
  }

  /**
   * @return {Promise.<PeerConnection, Error>}
   */
  getConnection() {
    return cmgr.getOrCreateConnection(this.ipaddr, this.port);
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
   * Retrieve a blob from the peer.
   *
   * @return {Promise.<Blob, Error>}
   */
  getFileBlob(params) {
    return new Promise(function(resolve, reject) {
      cmgr.getOrCreateConnection(params.ipAddress, params.port)
      .then(peerConnection => {
        return peerConnection.getFile(params.fileUrl);
      })
      .then(binary => {
        let blob = util.getBufferAsBlob(binary);
        resolve(blob);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Retrieve the list of pages in the peer's cache.
   *
   * @param {Object} params parameters for list request, as created by
   * peer-interface/common.
   *
   * @return {Promise.<Object, Error>}
   */
  getList(params) {
    return new Promise(function(resolve, reject) {
      cmgr.getOrCreateConnection(params.ipAddress, params.port)
      .then(peerConnection => {
        return peerConnection.getList();
      })
      .then(json => {
        resolve(json);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Retrieve the list of cached pages available in this cache.
   *
   * @param {Object} params parameter object as created by peer-interface/common
   *
   * @return {Promise.<Object, Error>} Promise that resolves with the digest
   * response or rejects with an Error.
   */
  getCacheDigest(params) {
    return new Promise(function(resolve, reject) {
      cmgr.getOrCreateConnection(params.ipAddress, params.port)
      .then(peerConnection => {
        return peerConnection.getCacheDigest();
      })
      .then(json => {
        resolve(json);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * @param {Object} params
   *
   * @return {Promise.<BloomFilter, Error>}
   */
  getCacheBloomFilter(params) {
    return cmgr.getOrCreateConnection(params.ipAddress, params.port)
    .then(peerConnection => {
      return peerConnection.getCacheBloomFilter();
    });
  }
}

exports.WebrtcPeerAccessor = WebrtcPeerAccessor;
