'use strict';

var _ = require('underscore');
var Buffer = require('buffer/').Buffer;
var EventEmitter = require('wolfy87-eventemitter');

var protocol = require('./protocol');
var util = require('../util');

var EV_CHUNK = 'chunk';
var EV_COMPLETE = 'complete';
var EV_ERR = 'error';

/**
 * The size of chunks that will be sent over WebRTC at a given time. This is
 * supposedly a reasonable value for Chrome, according to various documents
 * online.
 */
// Let's try bumping to 16mibibytes
exports.CHUNK_SIZE = 16384;
// Based on
// https://github.com/webrtc/samples/blob/gh-pages/src/content/datachannel/datatransfer/js/main.js
// exports.BUFFER_FULL_THRESHOLD = exports.CHUNK_SIZE / 2;
exports.BUFFER_FULL_THRESHOLD = exports.CHUNK_SIZE * 5;

/**
 * This object provides a way to communicate with a peer to chunk binary data
 * by default.
 */

/**
 * @constructor
 *
 * @param {RTCPeerConnection} rawConnection a raw connection to a peer
 * @param {boolean} cacheChunks true if the Client it self should save
 * chunks. If true, the 'complete' event will include the final ArrayBuffer. If
 * false, chunks will be emitted only on 'chunk' events.
 * @param {Object} msg the message for the server. The peer being connected to
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
  this.channel.send(msgBin.buffer);
};

/**
 * Handle an error from the Server.
 *
 * @param {ProtocolMessage} msg
 */
exports.Client.prototype.handleErrorMessage = function(msg) {
  this.emitError(msg);
};

window.onmessageNum = 0;
window.onmessageTotal = 0;

window.askAnswerNum = 0;
window.askAnswerTotal = 0;

/**
 * Request the information from the server and start receiving data.
 */
exports.Client.prototype.start = function() {
  var self = this;
  var perf = util.getPerf();
  perf.mark('createDataChannel-start');
  var channel = this.rawConnection.createDataChannel(this.msg.channelName);
  this.channel = channel;
  channel.binaryType = 'arraybuffer';

  channel.onopen = function() {
    perf.mark('createDataChannel-end');
    window.askStart = perf.now();
    self.sendStartMessage();
  };

  channel.onmessage = function(event) {
    // window.askAnswerNum++;
    // var timeForAnswer = perf.now() - window.askStart;
    // window.askAnswerTotal += timeForAnswer;
    // console.log('num askAnswer:', window.askAnswerNum, 'time askAnswer:', timeForAnswer, 'mean time:',
    //   window.askAnswerTotal / window.askAnswerNum);
    // var start = perf.now();
    var eventBuff = Buffer.from(event.data);

    var msg = protocol.from(eventBuff);
    if (msg.isError()) {
      self.handleErrorMessage(msg);
      return;
    }

    var dataBuff = msg.getData();

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
      // console.time('chunks.push');
      self.chunks.push(dataBuff);
      // console.timeEnd('chunks.push');
    }
    self.numChunksReceived++;
    self.emitChunk(dataBuff);

    if (self.numChunksReceived === self.streamInfo.numChunks) {
      // We're done.
      self.emitComplete();
      self.channel.close();
    } else {
      // var end = perf.now();
      // var totalTime = end - start;
      // console.log('This is how long it takes to process a message and request another');
      // window.onmessageNum++;
      // window.onmessageTotal += totalTime;
      // console.log('num onmessage:', window.onmessageNum, 'total time:', window.onmessageTotal, 'mean:',
      //   window.onmessageTotal / window.onmessageNum);
      // window.askStart = perf.now();
      // self.requestNext();
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
    this.channel.send(continueMsgBin.buffer);
  } catch (err) {
    this.emitError(err);
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
 * Emit an error event.
 *
 * @param {any} msg the message to emit with the error
 */
exports.Client.prototype.emitError = function(msg) {
  this.emit(EV_ERR, msg);
};

/**
 * Emit a 'complete' event signifying that everything has been received. If
 * cacheChunks is true, the event will be emitted with a single buffer
 * containing all concatenated chunks.
 */
exports.Client.prototype.emitComplete = function() {
  if (this.cacheChunks) {
    // console.time('Buffer.concat');
    var reclaimed = Buffer.concat(this.chunks);
    // console.timeEnd('Buffer.concat');
    this.emit(EV_COMPLETE, reclaimed);
  } else {
    this.emit(EV_COMPLETE);
  }
};

/**
 * Create a Server to respond to Client requests.
 *
 * @constructor
 *
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

  this.channel.bufferedAmountLowThreshold = exports.BUFFER_FULL_THRESHOLD;
};

exports.Server.prototype.chunkGenerator = function*() {
  // this.buffToSend = buff;
  // this.numChunks = Math.ceil(buff.length / exports.CHUNK_SIZE);
  // this.streamInfo = exports.createStreamInfo(this.numChunks);
  // this.chunksSent = 0;

  var buff = this.buffToSend;
  var endOfLastSent = -1;
  while (endOfLastSent < buff.length) {
    var chunkStart = this.chunksSent * exports.CHUNK_SIZE;
    var chunkEnd = chunkStart + exports.CHUNK_SIZE;
    chunkEnd = Math.min(chunkEnd, buff.length);
    endOfLastSent = chunkEnd;
    // console.time('slice');
    var chunk = buff.slice(chunkStart, chunkEnd);
    // console.timeEnd('slice');
    yield chunk;
  }
};

exports.Server.prototype.bufferedAmountLowListener = function() {
  // Looks like the this object is the channel itself?
  this.channel.removeEventListener(
    'bufferedamountlow', this._lowBufferListener
  );
  this.sendAsMuchAsPossible();
};

exports.Server.prototype.sendAsMuchAsPossible = function() {
  this._lowBufferListener = this.bufferedAmountLowListener.bind(this);
  var gen = this._activeGenerator;
  // pick up where we left off.
  var item = this._pendingItem;
  this._pendingItem = null;
  if (!item) {
    item = gen.next();
  }

  while (!item.done) {
    if (this.channel.bufferedAmount > exports.BUFFER_FULL_THRESHOLD) {
      // Save our pending item, which we can't send yet.
      this._pendingItem = item;
      this.channel.addEventListener(
        'bufferedamountlow', this._lowBufferListener
      );
      return;
    }
    
    // Otherwise, send data.
    try {
      // The number of chunks must be incremented before the send, otherwise if
      // an ack comes back very quickly (impossibly quickly except in test
      // conditions?) you can send the same chunk twice.
      this.chunksSent++;
      var chunk = item.value;
      var chunkMsg = protocol.createSuccessMessage(chunk);
      this.channel.send(chunkMsg.asBuffer().buffer);
      item = gen.next();
    } catch (err) {
      this.chunksSent--;
      console.log('Error sending chunk: ', err);
    }
  }
  this._activeGenerator = null;
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
    // console.time('parse-onmessage');
    var dataBuff = Buffer.from(event.data);
    var msg = JSON.parse(dataBuff);
    // console.timeEnd('parse-onmessage');

    if (msg.message !== 'next') {
      console.log('Unrecognized control signal: ', msg);
      return;
    }

    // var chunkStart = self.chunksSent * exports.CHUNK_SIZE;
    // var chunkEnd = chunkStart + exports.CHUNK_SIZE;
    // chunkEnd = Math.min(chunkEnd, buff.length);
    // console.time('slice');
    // var chunk = buff.slice(chunkStart, chunkEnd);
    // console.timeEnd('slice');

    self._activeGenerator = self.chunkGenerator();
    self.sendAsMuchAsPossible();

    // try {
    //   // The number of chunks must be incremented before the send, otherwise if
    //   // an ack comes back very quickly (impossibly quickly except in test
    //   // conditions?) you can send the same chunk twice.
    //   self.chunksSent++;
    //   var chunkMsg = protocol.createSuccessMessage(chunk);
    //   self.channel.send(chunkMsg.asBuffer().buffer);
    // } catch (err) {
    //   console.log('Error sending chunk: ', err);
    // }
  };
  
  // Start the process by sending the streamInfo to the client.
  try {
    var streamInfoMsg = protocol.createSuccessMessage(
      Buffer.from(JSON.stringify(this.streamInfo))
    );
    this.channel.send(streamInfoMsg.asBuffer().buffer);
  } catch (err) {
    console.log('Error sending streamInfo: ', this.streamInfo);
  }
};

/**
 * Send a message indicating an error to the client. This is similar to
 * replying with a 500 error for a web server.
 *
 * @param {any} err error to send to the client.
 */
exports.Server.prototype.sendError = function(err) {
  var msg = protocol.createErrorMessage(err);
  this.channel.send(msg.asBuffer().buffer);
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
 * @return {Object}
 */
exports.createContinueMessage = function() {
  return { message: 'next' };
};
