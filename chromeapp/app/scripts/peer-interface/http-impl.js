'use strict';

var util = require('../util');

/**
 * @constructor
 */
exports.PeerAccessor = function PeerAccessor() {
  if (!(this instanceof PeerAccessor)) {
    throw new Error('PeerAccessor must be called with new');
  }
  
};

/**
 * Retrieve a blob from the peer.
 *
 * @param {JSON} params parameter object as created by peer-interface/common
 *
 * @returns {Promise.<Blob, Error>}
 */
exports.PeerAccessor.prototype.getFileBlob = function(params) {
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
 * @param {JSON} params parameter object as created by peer-interface/common
 *
 * @returns {Promise.<JSON, Error>}
 */
exports.PeerAccessor.prototype.getList = function(params) {
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
