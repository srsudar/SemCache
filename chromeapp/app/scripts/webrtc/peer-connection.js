'use strict';

/**
 * Handles a connection to a SemCache peer. 
 */

/**
 * PeerConnection is a wrapper around the raw WebRTC machinery to provide a
 * SemCache-specific API.
 */
exports.PeerConnection = function PeerConnection(rawConnection) {
  if (!(this instanceof PeerConnection)) {
    throw new Error('PeerConnection must be called with new');
  }

  this.rawConnection = rawConnection;
};

/**
 * Return the raw WebRTC connection backing this PeerConnection.
 *
 * @param {String} foo
 *
 * @return {RTCPeerConnection} 
 */
exports.PeerConnection.prototype.getRawConnection = function() {
  return this.rawConnection;
};

/**
 * Get the list of available files from the peer.
 *
 * @return {Promise -> JSON} Promise that resolves with the JSON list of the
 * directory contents
 */
exports.PeerConnection.prototype.getList = function() {
  // TODO: implement
  // Generate a request object.
  // Add this request to the queue you're monitoring.
  // Issue the request.
  // Resolve completing it. Hmm.
  // For now we are going to assume that all messages can be held in memory.
  // This means that a single message can be processed without worrying about
  // piecing it together from other messages. It is a simplification, but one
  // that seems reasonable.
};

/**
 * Get the file from the peer.
 *
 * @param {String} remotePath the identifier on the remote machine
 * @param {String} savePath the local path to which the file will be saved
 *
 * @return {Promise} Promise that resolves when the get is complete
 */
exports.PeerConnection.prototype.getFile = function(remotePath, savePath) {
  // TODO: implement
  // TODO: should we stream this?
};

/**
 * Handler for the connection's ondatachannel event.
 */
exports.onDataChannelHandler = function(event) {
  // TODO: implement
};

/**
 * Handler that responds to a list request
 *
 * Sends the listed directory contents to the peer.
 * 
 * @param {object} request object representing the request.
 */
exports.onList = function(request) {
  // TODO: implement
};

/**
 * Handler that responds to a request for a file.
 *
 * Sends the contents of the file to the peer.
 *
 * @param {object} request object representing the request
 */
exports.onFile = function(request) {
  // TODO: implement
};
