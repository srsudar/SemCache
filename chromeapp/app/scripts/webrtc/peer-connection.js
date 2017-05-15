'use strict';

var _ = require('underscore');
var chunkingChannel = require('./chunking-channel');
var EventEmitter = require('wolfy87-eventemitter');
var message = require('./message');

var EV_CLOSE = 'close';

/**
 * Handles a connection to a SemCache peer. 
 */

/**
 * PeerConnection is a wrapper around the raw WebRTC machinery to provide a
 * SemCache-specific API.
 *
 * @constructor
 * 
 * @param {RTCPeerConnection} rawConnection the raw RTCPeerConnection that will
 * be backing this connection. This rawConnection has its onclose handler
 * modified to allow the PeerConnection to emit its own 'close' event.
 */
exports.PeerConnection = function PeerConnection(rawConnection) {
  if (!(this instanceof PeerConnection)) {
    throw new Error('PeerConnection must be called with new');
  }
  var self = this;

  this.rawConnection = rawConnection;

  this.rawConnection.onclose = function() {
    self.emitClose();
  };
};

_.extend(exports.PeerConnection.prototype, new EventEmitter());

/**
 * Emit a close event.
 */
exports.PeerConnection.prototype.emitClose = function() {
  this.emit(EV_CLOSE);
};

/**
 * Return the raw WebRTC connection backing this PeerConnection.
 *
 * @return {RTCPeerConnection} 
 */
exports.PeerConnection.prototype.getRawConnection = function() {
  return this.rawConnection;
};

/**
 * Get the list of available files from the peer.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the JSON list
 * of the directory contents
 */
exports.PeerConnection.prototype.getList = function() {
  // For now we are going to assume that all messages can be held in memory.
  // This means that a single message can be processed without worrying about
  // piecing it together from other messages. It is a simplification, but one
  // that seems reasonable.
  var self = this;
  return new Promise(function(resolve, reject) {
    var msg = message.createListMessage();
    var rawConnection = self.getRawConnection();

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
 * Get the digest of page information from the peer.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the JSON object
 * representing the digest or rejects with an Error.
 */
exports.PeerConnection.prototype.getCacheDigest = function() {
  // For now we are going to assume that all messages can be held in memory.
  // This means that a single message can be processed without worrying about
  // piecing it together from other messages. It is a simplification, but one
  // that seems reasonable.
  var self = this;
  return new Promise(function(resolve, reject) {
    var msg = message.createDigestMessage();
    var rawConnection = self.getRawConnection();

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
 * @param {string} remotePath the identifier on the remote machine
 *
 * @return {Promise.<Buffer, Error>} Promise that resolves when the get is
 * complete
 */
exports.PeerConnection.prototype.getFile = function(remotePath) {
  // For now we are assuming that all files can be held in memory and do not
  // need to be written to disk as they are received. This is reasonable, I
  // believe, given the way mhtml is displayed.
  var self = this;
  return new Promise(function(resolve, reject) {
    var msg = message.createFileMessage(remotePath);
    var rawConnection = self.getRawConnection();
    exports.sendAndGetResponse(rawConnection, msg)
    .then(buffer => {
      // Close so that we don't re-use during this tests.
      console.log('received buffer, emitting close');
      self.emitClose();
      resolve(buffer);
    })
    .catch(err => {
      reject(err);
    });
  });
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
 * @param {Object} msg the message to send to the peer
 * 
 * @return {Promise.<ArrayBuffer, Error>} Promise that resolves with the
 * ArrayBuffer message received on the channel or with an Error if something
 * went wrong. Callers are responsible for any parsing of the ArrayBuffer
 * object, eg to reclaim a JSON response.
 */
exports.sendAndGetResponse = function(pc, msg) {
  return new Promise(function(resolve, reject) {
    var ccClient = new chunkingChannel.Client(pc, true, msg);

    ccClient.on('complete', buff => {
      resolve(buff);
    });

    ccClient.on('error', err => {
      reject(err);
    });

    ccClient.start();
  });
};
