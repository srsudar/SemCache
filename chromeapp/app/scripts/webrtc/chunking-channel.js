'use strict';

var _ = require('underscore');
var Buffer = require('buffer').Buffer;
var EventEmitter = require('wolfy87-eventemitter');

var EV_CHUNK = 'chunk';
var EV_COMPLETE = 'complete';
var EV_ERR = 'err';

/**
 * The size of chunks that will be sent over WebRTC at a given time. This is
 * supposedly a reasonable value for Chrome, according to various documents
 * online.
 */
exports.CHUNK_SIZE = 16000;

/**
 * This object provides a way to communicate with a peer to chunk binary data
 * by default.
 */

/**
 * @constructor
 * @param {RTCPeerConnection} rawConnection a raw connection to a peer
 * @param {boolean} cacheChunks true if the Client it self should save
 * chunks. If true, the 'complete' event will include the final ArrayBuffer. If
 * false, chunks will be emitted only on 'chunk' events.
 * @param {JSON} msg the message for the server. The peer being connected to
 * and represented by rawConnection is expected to know how to respond to the
 * message
 */
exports.Client = function Client(
    rawConnection, cacheChunks, msg
) {
  if (!(this instanceof Client)) {
    throw new Error('Client must be called with new');
  }

  this.cacheChunks = cacheChunks;
  this.rawConnection = rawConnection;
  this.numChunksReceived = 0;
  this.streamInfo = null;
  this.awaitingFirstResponse = true;
  this.msg = msg;
  this.chunks = [];
};

_.extend(exports.Client.prototype, new EventEmitter());

/**
 * Send the message to the server that initiates the transfer of the content.
 */
exports.Client.prototype.sendStartMessage = function() {
  var msgBin = Buffer.from(JSON.stringify(this.msg));
  this.channel.send(msgBin);
};

/**
 * Request the information from the server and start receiving data.
 */
exports.Client.prototype.start = function() {
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

/**
 * Inform the server that we are ready for the next chunk.
 */
exports.Client.prototype.requestNext = function() {
  var continueMsg = exports.createContinueMessage();
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
exports.Client.prototype.emitChunk = function(buff) {
  this.emit(EV_CHUNK, buff);
};

/**
 * Emit a 'complete' event signifying that everything has been received. If
 * cacheChunks is true, the event will be emitted with a single buffer
 * containing all concatenated chunks.
 */
exports.Client.prototype.emitComplete = function() {
  if (this.cacheChunks) {
    var reclaimed = Buffer.concat(this.chunks);
    this.emit(EV_COMPLETE, reclaimed);
  } else {
    this.emit(EV_COMPLETE);
  }
};

/**
 * Create a Server to respond to Client requests.
 *
 * @constructor
 * @param {RTCDataChannel} channel a channel that has been initiated by a
 * Client.
 */
exports.Server = function Server(channel) {
  if (!(this instanceof Server)) {
    throw new Error('Server must be called with new');
  }

  this.channel = channel;
  this.numChunks = null;
  this.streamInfo = null;
  this.chunksSent = null;
};

/**
 * Send buff over the channel using chunks. The channel must have already been
 * used to request a response--i.e. a ChannelClient must be listening.
 *
 * Note that currently this does not support streaming--buff must be able to be
 * held in memory. It is not difficult to imagine this API being modified to
 * change that, however.
 *
 * @param {Buffer} buff the buffer to send
 */
exports.Server.prototype.sendBuffer = function(buff) {
  this.buffToSend = buff;
  this.numChunks = Math.ceil(buff.length / exports.CHUNK_SIZE);
  this.streamInfo = exports.createStreamInfo(this.numChunks);
  this.chunksSent = 0;

  var self = this;
  this.channel.onmessage = function(event) {
    var dataBuff = Buffer.from(event.data);
    var msg = JSON.parse(dataBuff);

    if (msg.message !== 'next') {
      console.log('Unrecognized control signal: ', msg);
      return;
    }

    var chunkStart = self.chunksSent * exports.CHUNK_SIZE;
    var chunkEnd = chunkStart + exports.CHUNK_SIZE;
    chunkEnd = Math.min(chunkEnd, buff.length);
    var chunk = buff.slice(chunkStart, chunkEnd);

    try {
      // The number of chunks must be incremented before the send, otherwise if
      // an ack comes back very quickly (impossibly quickly except in test
      // conditions?) you can send the same chunk twice.
      self.chunksSent++;
      self.channel.send(chunk);
    } catch (err) {
      console.log('Error sending chunk: ', err);
    }
  };
  
  // Start the process by sending the streamInfo to the client.
  try {
    this.channel.send(Buffer.from(JSON.stringify(this.streamInfo)));
  } catch (err) {
    console.log('Error sending streamInfo: ', this.streamInfo);
  }
};

/**
 * Create a stream info object. This is the first message sent by the Server.
 *
 * @param {integer} numChunks the total number of chunks that will be sent.
 * This is not the total number of messages, but the number of chunks in the
 * file.
 */
exports.createStreamInfo = function(numChunks) {
  return { numChunks: numChunks };
};

/**
 * Create an object to be sent to the server to signify that the next chunk is
 * ready to be received.
 *
 * @return {JSON}
 */
exports.createContinueMessage = function() {
  return { message: 'next' };
};
