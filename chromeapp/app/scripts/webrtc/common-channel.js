'use strict';

const EventEmitter = require('events').EventEmitter;

const protocol = require('./protocol');

const EV_CHUNK = 'chunk';
const EV_COMPLETE = 'complete';
const EV_ERR = 'error';

/**
 * These are the base classes for our WebRTC channel wrappers. Common
 * functionality lives here, and classes should extend these as necessary.
 */

class BaseClient extends EventEmitter {
  /**
   * @constructor
   *
   * @param {RTCPeerConnection} rawConnection a raw connection to a peer
   * @param {boolean} cacheChunks true if the Client it self should save
   * chunks. If true, the 'complete' event will include the final ArrayBuffer.
   * If false, chunks will be emitted only on 'chunk' events.
   * @param {Object} msg the message for the server. The peer being connected
   * to and represented by rawConnection is expected to know how to respond to
   * the message
   */
  constructor(rawConnection, cacheChunks, msg) {
    super();
    this.cacheChunks = cacheChunks;
    this.rawConnection = rawConnection;
    this.numChunksReceived = 0;
    this.streamInfo = null;
    this.awaitingFirstResponse = true;
    this.msg = msg;
    this.chunks = [];
    this.channel = null;
  }

  /**
   * Send the message to the server that initiates the transfer of the content.
   */
  sendStartMessage() {
    const msgBin = Buffer.from(JSON.stringify(this.msg));
    this.channel.send(msgBin);
  }

  /**
   * Handle an error from the Server.
   *
   * @param {ProtocolMessage} msg
   */
  handleErrorMessage(msg) {
    this.emitError(msg);
  }

  /**
   * Inform the server that we are ready for the next chunk.
   */
  requestChunk() {
    const continueMsg = BaseClient.createContinueMessage();
    const continueMsgBin = Buffer.from(JSON.stringify(continueMsg));
    try {
      this.channel.send(continueMsgBin);
    } catch (err) {
      this.emitError(err);
    }
  }

  /**
   * Respond to a message from the server. This handles all the basics as would
   * be expected of any of our channel implementations.
   *
   * @param {Object} msg the protocol message from the server
   *
   * @return {boolean} true if processed successfully, false if error
   */
  handleMessageFromServer(msg) {
    if (msg.isError()) {
      this.handleErrorMessage(msg);
      return false;
    }

    const dataBuff = msg.getData();

    // We expect a JSON message about our stream as the first message. All
    // subsequent messages will be ArrayBuffers. We know we receive them in
    // ordered fashion due to the guarantees of RTCDataChannel.
    if (this.awaitingFirstResponse) {
      this.streamInfo = JSON.parse(dataBuff.toString());
      this.awaitingFirstResponse = false;
      this.requestChunk();
    } else {
      // Otherwise, we've received a chunk of our data.
      if (this.cacheChunks) {
        this.chunks.push(dataBuff);
      }
      this.numChunksReceived++;
      this.emitChunk(dataBuff);

      if (this.numChunksReceived === this.streamInfo.numChunks) {
        // We're done.
        this.channel.close();
        this.emitComplete();
      }
    }
    return true;
  }

  /**
   * Request the information from the server and start receiving data.
   */
  start() {
    const self = this;
    const channel = this.rawConnection.createDataChannel(this.msg.channelName);
    this.channel = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = function() {
      self.sendStartMessage();
    };

    channel.onmessage = function(event) {
      const eventBuff = Buffer.from(event.data);
      const msg = protocol.from(eventBuff);
      self.handleMessageFromServer(msg);
    };
  }

  /**
   * Emit a 'chunk' event with the Buffer representing this chunk.
   *
   * @param {Buffer} buff the Buffer object representing this chunk
   */
  emitChunk(buff) {
    this.emit(EV_CHUNK, buff);
  }

  /**
   * Emit an error event.
   *
   * @param {any} msg the message to emit with the error
   */
  emitError(msg) {
    this.emit(EV_ERR, msg);
  }

  /**
   * Emit a 'complete' event signifying that everything has been received. If
   * cacheChunks is true, the event will be emitted with a single buffer
   * containing all concatenated chunks.
   */
  emitComplete() {
    if (this.cacheChunks) {
      const reclaimed = Buffer.concat(this.chunks);
      this.emit(EV_COMPLETE, reclaimed);
    } else {
      this.emit(EV_COMPLETE);
    }
  }

  /**
   * Create an object to be sent to the server to signify that the next chunk
   * is ready to be received.
   *
   * @return {Object}
   */
  static createContinueMessage() {
    return { message: 'next' };
  }
}

class BaseServer extends EventEmitter {
  /**
   * Create a Server to respond to Client requests.
   *
   * @constructor
   *
   * @param {RTCDataChannel} channel a channel that has been initiated by a
   * Client.
   */
  constructor(channel, chunkSize) {
    super();
    this.channel = channel;
    this.chunkSize = chunkSize;
    this.numChunks = null;
    this.streamInfo = null;
    this.chunksSent = null;
    // This is the active generator we are using to create chunks.
    this._activeGenerator = null;
  }

  /**
   * Create the chunk generator or return the existing active generator.
   */
  get chunkGenerator() {
    if (!this._activeGenerator) {
      this._activeGenerator = this.createChunkGenerator();
    }
    return this._activeGenerator;
  }

  /**
   * Send a message indicating an error to the client. This is similar to
   * replying with a 500 error for a web server.
   *
   * @param {any} err error to send to the client.
   */
  sendError(err) {
    const msg = protocol.createErrorMessage(err);
    this.channel.send(msg.asBuffer());
  }

  sendFirstMessage() {
    // Start the process by sending the streamInfo to the client.
    let streamInfoMsg = protocol.createSuccessMessage(
      Buffer.from(JSON.stringify(this.streamInfo))
    );
    this.channel.send(streamInfoMsg.asBuffer());
  }

  /**
   * Initialize state to prepare for sending the buffer. The channel must have
   * already been used to request a response--i.e. a ChannelClient must be
   * listening.
   *
   * This must should be called by subclasses to handle common bookkeeping.
   *
   * @param {Buffer} buff the buffer to send
   */
  prepareToSend(buff) {
    this.buffToSend = buff;
    this.numChunks = Math.ceil(buff.length / this.chunkSize);
    this.streamInfo = BaseServer.createStreamInfo(this.numChunks);
    this.chunksSent = 0;

    let self = this;
    this.channel.onmessage = function(event) {
      let dataBuff = Buffer.from(event.data);
      let msg = JSON.parse(dataBuff);
      
      self.handleMessageFromClient(msg);
    };
  }

  /**
   * Respond to a message from the client. This handles all the basics as would
   * be expected of any of our channel implementations.
   *
   * @param {Object} msg the protocol message from the server
   */
  handleMessageFromClient(msg) {
    if (msg.message !== 'next') {
      throw new Error('Unrecognized control signal');
    }
  }

  /**
   * Generate chunks of the buffer we are sending. Throws an error if this is
   * called when buffToSend is not set.
   */
  *createChunkGenerator() {
    if (!this.buffToSend) {
      throw new Error('buffer not set');
    }
    const totalNumChunks = this.numChunks;
    let chunksYielded = 0;
    while (chunksYielded < totalNumChunks) {
      let chunkStart = chunksYielded * this.chunkSize;
      let chunkEnd = chunkStart + this.chunkSize;
      chunkEnd = Math.min(chunkEnd, this.buffToSend.length);
      let chunk = this.buffToSend.slice(chunkStart, chunkEnd);
      chunksYielded++;
      yield chunk;
    }
  }

  /**
   * Create a stream info object. This is the first message sent by the Server.
   *
   * @param {integer} numChunks the total number of chunks that will be sent.
   * This is not the total number of messages, but the number of chunks in the
   * file.
   */
  static createStreamInfo(numChunks) {
    return { numChunks: numChunks };
  }
}

exports.BaseClient = BaseClient;
exports.BaseServer = BaseServer;
