'use strict';

var util = require('../util');

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
