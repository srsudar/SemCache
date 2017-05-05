'use strict';

var cmgr = require('../webrtc/connection-manager');
var util = require('../util');

/**
 * @constructor
 */
exports.WebrtcPeerAccessor = function WebrtcPeerAccessor() {
  if (!(this instanceof WebrtcPeerAccessor)) {
    throw new Error('PeerAccessor must be called with new');
  }
  
};

/**
 * Retrieve a blob from the peer.
 *
 * @param {Object} params parameters for the get, as created by
 * peer-interface/common.
 *
 * @return {Promise.<Blob, Error>}
 */
exports.WebrtcPeerAccessor.prototype.getFileBlob = function(params) {
  return new Promise(function(resolve, reject) {
    cmgr.getOrCreateConnection(params.ipAddress, params.port)
    .then(peerConnection => {
      return peerConnection.getFile(params.fileUrl);
    })
    .then(binary => {
      var blob = util.getBufferAsBlob(binary);
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
 * @param {Object} params parameters for list request, as created by
 * peer-interface/common.
 *
 * @return {Promise.<Object, Error>}
 */
exports.WebrtcPeerAccessor.prototype.getList = function(params) {
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

/**
 * Retrieve the list of cached pages available in this cache.
 *
 * @param {Object} params parameter object as created by peer-interface/common
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the digest
 * response or rejects with an Error.
 */
exports.WebrtcPeerAccessor.prototype.getCacheDigest = function(params) {
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
};
