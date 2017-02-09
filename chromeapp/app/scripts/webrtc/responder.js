'use strict';

var Buffer = require('buffer').Buffer;

var binUtil = require('../dnssd/binary-utils').BinaryUtils;
var chunkingChannel = require('./chunking-channel');
var fileSystem = require('../persistence/file-system');
var fsUtil = require('../persistence/file-system-util');
var message = require('./message');
var serverApi = require('../server/server-api');

/**
 * This module is responsible for responding to incoming requests.
 */

/**
 * Handler for the connection's ondatachannel event.
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
 */
exports.onList = function(channel) {
  serverApi.getResponseForAllCachedPages()
  .then(json => {
    var jsonBuff = Buffer.from(JSON.stringify(json));
    var ccServer = new chunkingChannel.Server(channel);
    ccServer.sendBuffer(jsonBuff);
  });
};

/**
 * Handler that responds to a request for a file.
 *
 * Sends the contents of the file to the peer.
 *
 * @param {RTCDataChannel} channel the data channel on which to send the
 * response
 * @param {JSON} msg the message requesting the information
 */
exports.onFile = function(channel, msg) {
  // Similar code is implemented in server/handlers.js. That code writes as the
  // file as read--we are going to try not doing that here, given our decision
  // to not chunk files at this point in time.
  var fileName = api.getCachedFileNameFromPath(msg.request.accessPath);

  // TODO: implement
  console.log('onFile channel: ', channel);
  console.log('onFile msg: ', msg);
  throw new Error('peer-connection.onFile not yet implemented');
};
