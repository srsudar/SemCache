'use strict';

var _ = require('underscore');
var EventEmitter = require('wolfy87-eventemitter');

/**
 * This object provides a way to communicate with a peer to chunk binary data
 * by default.
 */

// Events
// start
// ready-for-chunk
// chunk
// end

/**
 * @constructor
 * @param {RTCPeerConnection} rawConnection a raw connection to a peer
 */
exports.ChunkingChannel = function ChunkingChannel(rawConnection) {
  if (!(this instanceof ChunkingChannel)) {
    throw new Error('ChunkingChannel must be called with new');
  }

  this.rawConnection = rawConnection;
};

_.extend(exports.ChunkingChannel.prototype, new EventEmitter());

exports.ChunkingChannel.prototype.doPing = function() {
  this.emit('ping', {foo: 'bar'});
};
