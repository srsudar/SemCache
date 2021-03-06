'use strict';

const TextDecoder = require('text-encoding').TextDecoder;

const bufferedChannel = require('./buffered-channel');
const message = require('./message');
const serverApi = require('../server/server-api');


/**
 * This module is responsible for responding to incoming requests via WebRTC.
 */

/**
 * Handler for the connection's ondatachannel event.
 *
 * @param {Event} event
 */
exports.onDataChannelHandler = function(event) {
  console.log('Data channel has been created by client');
  // Wrap the call to ensure that we can get a handle to the channel receiving
  // the message in order to directly reply.
  let channel = event.channel;
  event.channel.onmessage = function(msgEvent) {
    exports.onDataChannelMessageHandler(channel, msgEvent);
  };
};

/**
 * @param {RTCDataChannel} channel
 * @param {Event} event
 */
exports.onDataChannelMessageHandler = function(channel, event) {
  // We expect ArrayBuffers containing JSON objects as messages.
  let jsonBin = event.data;
  let jsonStr = new TextDecoder().decode(jsonBin);
  let msg = JSON.parse(jsonStr);

  if (message.isList(msg)) {
    exports.onList(channel, msg);
  } else if (message.isDigest(msg)) {
    exports.onDigest(channel, msg);
  } else if (message.isCachedPage(msg)) {
    exports.onCachedPage(channel, msg);
  } else if (message.isBloomFilter(msg)) {
    exports.onBloomFilter(channel, msg);
  } else {
    console.log('Unrecognized message type: ', msg.type, msg);
  }
};

/**
 * Handler that responds to a list request
 *
 * Sends the listed directory contents to the peer.
 * 
 * @param {RTCDataChannel} channel the data channel on which to send the
 * response
 * @param {Object} message
 *
 * @return {Promise.<undefined, Error>} Promise that returns after sending has
 * begun.
 */
exports.onList = function(channel, message) {
  return new Promise(function(resolve, reject) {
    let { offset, limit } = message.request;
    serverApi.getResponseForList(offset, limit)
    .then(buff => {
      return exports.sendBufferOverChannel(channel, buff);
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Handler that responds to a request for a digest of available files.
 *
 * @param {RTCDataChannel} channel the data channel on which to send the
 * response
 *
 * @return {Promise.<undefined, Error>} Promise that returns after sending has
 * begun
 */
exports.onDigest = function(channel) {
  return new Promise(function(resolve, reject) {
    serverApi.getResponseForAllPagesDigest()
    .then(buff => {
      return exports.sendBufferOverChannel(channel, buff);
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Handler that responds to a request for a Bloom filter.
 *
 * @param {RTCDataChannel} channel the data channel on which to send the
 * response
 *
 * @return {Promise.<undefined, Error>} Promise that returns after sending has
 * begun
 */
exports.onBloomFilter = function(channel) {
  return serverApi.getResponseForBloomFilter()
  .then(buff => {
    return exports.sendBufferOverChannel(channel, buff);
  });
};

exports.onCachedPage = function(channel, msg) {
  return new Promise(function(resolve, reject) {
    serverApi.getResponseForCachedPage(msg.request.href)
    .then(buff => {
      return exports.sendBufferOverChannel(channel, buff);   
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {RTCDataChannel} channel
 * @param {Buffer} buff
 *
 * @return {Promise.<undefined>}
 */
exports.sendBufferOverChannel = function(channel, buff) {
  return new Promise(function(resolve, reject) {
    Promise.resolve()
    .then(() => {
      let ccServer = exports.createChannelServer(channel);
      ccServer.sendBuffer(buff);
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Factory method for creating a ChunkingChannel.Server object.
 *
 * Exposed for testing.
 *
 * @param {RTCDataChannel} channel
 *
 * @return {ChannelServer} a new Server object wrapping the channel
 */
exports.createChannelServer = function(channel) {
  return new bufferedChannel.BufferedChannelServer(channel);
};
