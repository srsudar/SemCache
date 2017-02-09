'use strict';

var _ = require('underscore');
var Buffer = require('buffer').Buffer;
var EventEmitter = require('wolfy87-eventemitter');

var EV_CHUNK = 'chunk';
var EV_COMPLETE = 'complete';
var EV_ERR = 'err';

/**
 * This object provides a way to communicate with a peer to chunk binary data
 * by default.
 */

/**
 * @constructor
 * @param {RTCPeerConnection} rawConnection a raw connection to a peer
 * @param {boolean} isClient true if this is a client that will be issuing a
 * request
 * @param {boolean} cacheChunks true if the ChunkingChannel it self should save
 * chunks. If true, the 'complete' event will include the final ArrayBuffer. If
 * false, chunks will be emitted only on 'chunk' events.
 * @param {JSON} msg the message for the server. The peer being connected to
 * and represented by rawConnection is expected to know how to respond to the
 * message
 */
exports.ChunkingChannel = function ChunkingChannel(
    rawConnection, isClient, cacheChunks, msg
) {
  if (!(this instanceof ChunkingChannel)) {
    throw new Error('ChunkingChannel must be called with new');
  }

  this.cacheChunks = cacheChunks;
  this.rawConnection = rawConnection;
  this.numChunksReceived = 0;
  this.streamInfo = null;
  this.awaitingFirstResponse = true;
  this.msg = msg;

  if (this.cacheChunks) {
    this.chunks = [];
  } else {
    this.chunks = null;
  }
};

_.extend(exports.ChunkingChannel.prototype, new EventEmitter());

exports.ChunkingChannel.prototype.doPing = function() {
  this.emit('ping', {foo: 'bar'});
};

exports.ChunkingChannel.prototype.sendStartMessage = function() {
  var msgBin = Buffer.from(JSON.stringify(this.msg));
  this.channel.send(msgBin);
};

/**
 * @param {JSON} msg the message that starts requesting data from the peer
 */
exports.ChunkingChannel.prototype.start = function() {
  var self = this;
  var channel = this.rawConnection.createDataChannel(this.msg.channelName);
  this.channel = channel;
  channel.binaryType = 'arraybuffer';

  channel.onopen = function() {
    self.sendStartMessage();
  };

  channel.onmessage = function(event) {
    var dataBuff = Buffer.from(event.data);

    // We expect a JSON message about our stream as the first message. All
    // subsequent messages will be ArrayBuffers. We know we receive them in
    // ordered fashion due to the guarantees of RTCDataChannel.
    if (self.awaitingFirstResponse) {
      self.streamInfo = JSON.parse(dataBuff.toString());
      self.awaitingFirstResponse = false;
      self.requestNext();
      return;
    }

    // Otherwise, we've received a chunk of our data.
    if (self.cacheChunks) {
      self.chunks.push(dataBuff);
    }
    self.numChunksReceived++;
    self.emitChunk(dataBuff);

    if (self.numChunksReceived === self.streamInfo.numChunks) {
      // We're done.
      self.emitComplete();
      self.channel.close();
    } else {
      self.requestNext();
    }
  };
};

exports.ChunkingChannel.prototype.requestNext = function() {
  var continueMsg = { message: 'next' };
  var continueMsgBin = Buffer.from(JSON.stringify(continueMsg));
  try {
    this.channel.send(continueMsgBin);
  } catch (err) {
    this.emit(EV_ERR, err);
  }
};

/**
 * Emit a 'chunk' event with the Buffer representing this chunk.
 *
 * @param {Buffer} buff the Buffer object representing this chunk
 */
exports.ChunkingChannel.prototype.emitChunk = function(buff) {
  this.emit(EV_CHUNK, buff);
};

exports.ChunkingChannel.prototype.emitComplete = function() {
  if (this.cacheChunks) {
    var reclaimed = Buffer.concat(this.chunks);
    this.emit(EV_COMPLETE, reclaimed);
  } else {
    this.emit(EV_COMPLETE);
  }
};
