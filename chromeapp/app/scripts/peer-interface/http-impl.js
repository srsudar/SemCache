'use strict';

const serverApi = require('../server/server-api');
const util = require('../util');

/**
 * @constructor
 */
exports.HttpPeerAccessor = function HttpPeerAccessor() {
  if (!(this instanceof HttpPeerAccessor)) {
    throw new Error('PeerAccessor must be called with new');
  }
  
};

/**
 * Retrieve a blob from the peer.
 *
 * @param {Object} params parameter object as created by peer-interface/common
 *
 * @return {Promise.<Blob, Error>}
 */
exports.HttpPeerAccessor.prototype.getFileBlob = function(params) {
  return new Promise(function(resolve, reject) {
    return util.fetch(params.fileUrl)
    .then(response => {
      return response.blob();
    })
    .then(blob => {
      resolve(blob);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Retrieve the list of pages in the peer's cache.
 *
 * @param {Object} params parameter object as created by peer-interface/common
 *
 * @return {Promise.<Object, Error>}
 */
exports.HttpPeerAccessor.prototype.getList = function(params) {
  return new Promise(function(resolve, reject) {
    util.fetch(params.listUrl)
    .then(response => {
      return response.json();
    })
    .then(json => {
      resolve(json);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Retrieve the list of cached pages available in this cache.
 *
 * @param {Object} params parameter object as created by peer-interface/common
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the digest
 * response or rejects with an Error.
 */
exports.HttpPeerAccessor.prototype.getCacheDigest = function(params) {
  return new Promise(function(resolve, reject) {
    util.fetch(params.digestUrl)
    .then(response => {
      return response.json();
    })
    .then(json => {
      resolve(json);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {Object} params
 *
 * @return {Promise.<BloomFilter, Error>}
 */
exports.HttpPeerAccessor.prototype.getCacheBloomFilter = function(params) {
  return util.fetch(params.bloomUrl)
  .then(response => {
    return response.arrayBuffer();
  })
  .then(arrayBuffer => {
    let buff = Buffer.from(arrayBuffer);
    let result = serverApi.parseResponseForBloomFilter(buff);
    return result;
  });
};
