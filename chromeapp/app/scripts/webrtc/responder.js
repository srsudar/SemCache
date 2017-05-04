'use strict';

var Buffer = require('buffer/').Buffer;

var api = require('../server/server-api');
var binUtil = require('../dnssd/binary-utils').BinaryUtils;
var chunkingChannel = require('./chunking-channel');
var fileSystem = require('../persistence/file-system');
var message = require('./message');
var serverApi = require('../server/server-api');

/**
 * This module is responsible for responding to incoming requests.
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
  var channel = event.channel;
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
  var jsonBin = event.data;
  var jsonStr = binUtil.arrayBufferToString(jsonBin);
  var msg = JSON.parse(jsonStr);

  if (message.isList(msg)) {
    exports.onList(channel, msg);
  } else if (message.isFile(msg)) {
    exports.onFile(channel, msg);
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
 *
 * @return {Promise.<undefined, Error>} Promise that returns after sending has
 * begun.
 */
exports.onList = function(channel) {
  return new Promise(function(resolve, reject) {
    serverApi.getResponseForAllCachedPages()
    .then(json => {
      var jsonBuff = Buffer.from(JSON.stringify(json));
      var ccServer = exports.createCcServer(channel);
      ccServer.sendBuffer(jsonBuff);
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
    .then(json => {
      var jsonBuff = Buffer.from(JSON.stringify(json));
      var ccServer = exports.createCcServer(channel);
      ccServer.sendBuffer(jsonBuff);
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Handler that responds to a request for a file.
 *
 * Sends the contents of the file to the peer.
 *
 * @param {RTCDataChannel} channel the data channel on which to send the
 * response
 * @param {Object} msg the message requesting the information
 *
 * @return {Promise.<undefined, Error>} Promise that returns after sending has
 * begun.
 */
exports.onFile = function(channel, msg) {
  return new Promise(function(resolve, reject) {
    var ccServer = exports.createCcServer(channel);
    var fileName = api.getCachedFileNameFromPath(msg.request.accessPath);
    fileSystem.getFileContentsFromName(fileName)
    .then(buff => {
      ccServer.sendBuffer(buff);
      resolve();
    })
    .catch(err => {
      ccServer.sendError(err);
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
 * @return {Server} a new ChunkingChannel.Server object wrapping the channel.
 */
exports.createCcServer = function(channel) {
  return new chunkingChannel.Server(channel);
};

/**
 * Factory method for creating a ChunkingChannel.Client object.
 *
 * Exposed for testing.
 *
 * @param {RTCDataChannel} channel
 *
 * @return {Server} a new ChunkingChannel.Client object wrapping the channel.
 */
exports.createCcClient = function(channel) {
  return new chunkingChannel.Client(channel);
};
