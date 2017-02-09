'use strict';

var chunkingChannel = require('./chunking-channel');
var message = require('./message');

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
 * @return {Promise.<JSON, Error>} Promise that resolves with the JSON list of
 * the directory contents
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
  var msg = message.createListMessage();
  var rawConnection = this.getRawConnection();

  return new Promise(function(resolve, reject) {
    exports.sendAndGetResponse(rawConnection, msg)
    .then(buff => {
      var str = buff.toString();
      var result = JSON.parse(str);
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get a file from the peer.
 *
 * @param {String} remotePath the identifier on the remote machine
 *
 * @return {Promise.<ArrayBuffer, Error>} Promise that resolves when the get is
 * complete
 */
exports.PeerConnection.prototype.getFile = function(remotePath) {
  // TODO: implement
  // TODO: should we stream this?
  var msg = message.createFileMessage(remotePath);
  var rawConnection = this.getRawConnection();
  return exports.sendAndGetResponse(rawConnection, msg);
};

/**
 * Helper for common functionality of creating a channel, sending a request
 * message, and resolving after a response is received.
 *
 * After the response is received, the channel that was used to send the
 * message will be closed. The response is resolved after the first message is
 * received.
 *
 * @param {RTCPeerConnection} pc the connection over which to send the message
 * @param {JSON} msg the message to send to the peer
 * 
 * @return {Promise.<ArrayBuffer, Error>} Promise that resolves with the
 * ArrayBuffer message received on the channel or with an Error if something
 * went wrong. Callers are responsible for any parsing of the ArrayBuffer
 * object, eg to reclaim a JSON response.
 */
exports.sendAndGetResponse = function(pc, msg) {
  return new Promise(function(resolve, reject) {
    var ccClient = new chunkingChannel.Client(pc, true, true, msg);

    ccClient.on('complete', buff => {
      resolve(buff);
    });

    ccClient.on('error', err => {
      reject(err);
    });

    ccClient.start();
  });
};
