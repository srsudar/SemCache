'use strict';

var commonChannel = require('./common-channel');
var protocol = require('./protocol');

/**
 * This object communicates binary data over a data channel using the buffered
 * amount low event to throttle on the sending side. Tests showed this to be
 * considerably faster than chunking-channel, though buffered-channel lacks a
 * backpressure mechanism. As a result it is possible that a sender might
 * overwhelm a receiver.
 */

/**
 * The size of chunks that will be sent over WebRTC at a given time. This is
 * supposedly a reasonable value for Chrome, according to various documents
 * online.
 */
exports.CHUNK_SIZE = 16384;  // 16 mibibytes
/**
 * The amount of data at which we will consider the buffer full. This should be
 * well within the range Chrome allows, according to the internet. Some
 * samples I found online used CHUNK_SIZE / 2, but this was considerably slower
 * than the 5 chunks value I am using here.
 */
exports.BUFFER_FULL_THRESHOLD = exports.CHUNK_SIZE * 5;
exports.BUFFER_LOW_THRESHOLD = exports.CHUNK_SIZE / 2;

class BufferedChannelClient extends commonChannel.BaseClient {

}

class BufferedChannelServer extends commonChannel.BaseServer {
  constructor(
    channel,
    chunkSize = exports.CHUNK_SIZE,
    bufferLowThreshold = exports.BUFFER_LOW_THRESHOLD,
    bufferFullThreshold = exports.BUFFER_FULL_THRESHOLD
) {
    super(channel, chunkSize);

    this.chunkSize = chunkSize;
    this.bufferLowThreshold = bufferLowThreshold;
    this.bufferFullThreshold = bufferFullThreshold;
    this.channel.bufferedAmountLowThreshold = this.bufferLowThreshold;
  }

  /**
   * Send buff over the channel using chunks. The channel must have already
   * been used to request a response--i.e. a ChannelClient must be listening.
   *
   * Note that currently this does not support streaming--buff must be able to
   * be held in memory. It is not difficult to imagine this API being modified
   * to change that, however.
   *
   * @param {Buffer} buff the buffer to send
   */
  sendBuffer(buff) {
    super.prepareToSend(buff);
    super.sendFirstMessage();
  }

  handleMessageFromClient(msg) {
    // First we invoke the superclass method to perform common error handling.
    super.handleMessageFromClient(msg);

    // Start sending like crazy, leaving the other methods to get us to back
    // off as necessary.
    this.sendAsMuchAsPossible();
  }

  /**
   * Should be set to listen for the 'bufferedamountlow' event on the channel.
   */
  bufferedAmountLowListener() {
    this.channel.removeEventListener(
      // 'bufferedamountlow', this._lowBufferListener
      'bufferedamountlow', this.bufferedAmountLowListener
    );
    this.sendAsMuchAsPossible();
  }

  sendAsMuchAsPossible() {
    // this._lowBufferListener = this.bufferedAmountLowListener.bind(this);
    const gen = this.chunkGenerator;
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
          // 'bufferedamountlow', this._lowBufferListener
          'bufferedamountlow', this.bufferedAmountLowListener
        );
        return;
      }
      
      // Otherwise, send data.
      try {
        // The number of chunks must be incremented before the send, otherwise
        // if an ack comes back very quickly (impossibly quickly except in test
        // conditions?) you can send the same chunk twice.
        this.chunksSent++;
        var chunk = item.value;
        var chunkMsg = protocol.createSuccessMessage(chunk);
        this.channel.send(chunkMsg.asBuffer());
        item = gen.next();
      } catch (err) {
        this.chunksSent--;
        console.log('Error sending chunk: ', err);
      }
    }
    this._pendingItem = null;
    this._activeGenerator = null;
  }
}

exports.BufferedChannelClient = BufferedChannelClient;
exports.BufferedChannelServer = BufferedChannelServer;
