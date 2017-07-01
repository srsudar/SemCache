'use strict';

const common = require('./common');
const serverApi = require('../server/server-api');
const util = require('../util');

const PeerAccessor = common.PeerAccessor;


class HttpPeerAccessor extends PeerAccessor {
  /**
   * Retrieve a cached page from a peer.
   *
   * @param {string} href
   *
   * @return {Promise.<CPDisk, Error>}
   */
  getCachedPage(href) {
    let self = this;
    return Promise.resolve()
    .then(() => {
      let cpUrl = serverApi.getAccessUrlForCachedPage(
        self.getIpAddress(), self.getPort(), href
      );
      return util.fetch(cpUrl);
    })
    .then(response => {
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      let buffer = Buffer.from(arrayBuffer);
      return serverApi.parseResponseForCachedPage(buffer);
    });
  }

  /**
   * Retrieve the list of pages in the peer's cache.
   *
   * @param {Object} params parameter object as created by peer-interface/common
   *
   * @return {Promise.<Object, Error>}
   */
  getList() {
    let self = this;
    return new Promise(function(resolve, reject) {
      let listUrl = serverApi.getListPageUrlForCache(
        self.ipAddress, self.port
      );
      util.fetch(listUrl)
      .then(response => {
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        let buff = Buffer.from(arrayBuffer);
        resolve(serverApi.parseResponseForList(buff));
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
  getCacheDigest() {
    let self = this;
    return new Promise(function(resolve, reject) {
      let digestUrl = serverApi.getUrlForDigest(
        self.getIpAddress(), self.getPort()
      );
      util.fetch(digestUrl)
      .then(response => {
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        let buffer = Buffer.from(arrayBuffer);
        resolve(serverApi.parseResponseForDigest(buffer));
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
  getCacheBloomFilter() {
    let self = this;
    return Promise.resolve()
    .then(() => {
      let bloomUrl = serverApi.getUrlForBloomFilter(
        self.getIpAddress(), self.getPort()
      );
      return util.fetch(bloomUrl);
    })
    .then(response => {
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      let buff = Buffer.from(arrayBuffer);
      let result = serverApi.parseResponseForBloomFilter(buff);
      return result;
    });
  }
}

exports.HttpPeerAccessor = HttpPeerAccessor;
