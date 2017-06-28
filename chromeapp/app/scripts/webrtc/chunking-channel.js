'use strict';

const commonChannel = require('./common-channel');
const protocol = require('./protocol');


/**
 * The size of chunks that will be sent over WebRTC at a given time. This is
 * supposedly a reasonable value for Chrome, according to various documents
 * online.
 */
exports.CHUNK_SIZE = 1024 * 16;

/**
 * This object provides a way to communicate with a peer to chunk binary data
 * by default.
 */

class ChunkingChannelClient extends commonChannel.BaseClient {
  handleMessageFromServer(msg) {
    // We have to override default behavior here to manually request another
    // chunk.
    const success = super.handleMessageFromServer(msg);
    if (!success) {
      // There was an error. Assume the super class handled it.
      return false;
    }
      
    // If we haven't received all the chunks we expect, request the next one.
    // The only exception to this is if we haven't received any chunks at all,
    // which means this was the very first message we've received. In that
    // case, we expect the superclass to have called requestChunk.
    if (this.numChunksReceived < this.streamInfo.numChunks &&
        this.numChunksReceived > 0) {
      this.requestChunk();
    }
    return true;
  }
}

class ChunkingChannelServer extends commonChannel.BaseServer {
  constructor(channel, chunkSize = exports.CHUNK_SIZE) {
    super(channel, chunkSize);
  }

  sendBuffer(buff) {
    super.prepareToSend(buff);
    super.sendFirstMessage();
  }

  handleMessageFromClient(msg) {
    // First we invoke the superclass method to perform common error handling.
    // In this class we are only responding to acks, so get the next chunk.
    super.handleMessageFromClient(msg);

    const item = this.chunkGenerator.next();

    if (!item.done) {
      try {
        // The number of chunks must be incremented before the send, otherwise
        // if an ack comes back very quickly (impossibly quickly except in test
        // conditions?) you can send the same chunk twice.
        this.chunksSent++;
        let chunk = item.value;
        let chunkMsg = protocol.createSuccessMessage(chunk);
        this.channel.send(chunkMsg.toBuffer());
      } catch (err) {
        console.log('Error sending chunk: ', err);
      }
    }
  }
}

exports.ChunkingChannelClient = ChunkingChannelClient;
exports.ChunkingChannelServer = ChunkingChannelServer;
