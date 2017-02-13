'use strict';

var cmgr = require('../webrtc/connection-manager');

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
 * @param {JSON} params parameters for the get, as created by
 * peer-interface/common.
 *
 * @returns {Promise.<Blob, Error>}
 */
exports.PeerAccessor.prototype.getFileBlob = function(params) {
  return new Promise(function(resolve, reject) {
    cmgr.getOrCreateConnection(params.ipAddress, params.port)
    .then(peerConnection => {
      return peerConnection.getFile(params.fileUrl);
    })
    .then(binary => {
      resolve(binary);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Retrieve the list of pages in the peer's cache.
 *
 * @param {JSON} params parameters for list request, as created by
 * peer-interface/common.
 *
 * @returns {Promise.<JSON, Error>}
 */
exports.PeerAccessor.prototype.getList = function(params) {
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
};

