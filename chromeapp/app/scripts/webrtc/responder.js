'use strict';

var Buffer = require('buffer').Buffer;

var binUtil = require('../dnssd/binary-utils').BinaryUtils;
var message = require('./message');
var serverApi = require('../server/server-api');

/**
 * The size of chunks that will be sent over WebRTC at a given time. This is
 * supposedly a reasonable value for Chrome, according to various documents
 * online.
 */
exports.CHUNK_SIZE = 16000;

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
    var jsonStr = JSON.stringify(json);
    var jsonBin = Buffer.from(jsonStr);

    var numChunks = Math.ceil(jsonBin.length / exports.CHUNK_SIZE);
    var streamInfo = { numChunks: numChunks };

    var chunksSent = 0;
    channel.onmessage = function(event) {
      var msg = JSON.parse(Buffer.from(event.data).toString());
      if (msg.message !== 'next') {
        console.log('Unrecognized control signal: ', msg);
        return;
      }
      var chunkStart = chunksSent * exports.CHUNK_SIZE;
      var chunkEnd = chunkStart + exports.CHUNK_SIZE;
      chunkEnd = Math.min(chunkEnd, jsonBin.length);
      var chunk = jsonBin.slice(chunkStart, chunkEnd);
      chunksSent++;
      channel.send(chunk);
    };

    // Start the streaming process
    channel.send(Buffer.from(JSON.stringify(streamInfo)));
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
  // TODO: implement
  console.log('onFile channel: ', channel);
  console.log('onFile msg: ', msg);
  throw new Error('peer-connection.onFile not yet implemented');
};
