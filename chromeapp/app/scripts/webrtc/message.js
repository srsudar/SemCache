'use strict';

/**
 * Request messages for communicating with peers.
 *
 * API:
 * {
 *   channelName: /name of the channel to listen to/
 *   type: { list | file },
 *   auth: /some object that can later be used for roles permissions/,
 *   request: {
 *     / depends on the object itself. could be a file path, eg /
 *   }
 * }
 */

exports.TYPE_LIST = 'list';
exports.TYPE_FILE = 'file';

/** Valid types of request messages. */
var VALID_TYPES = [exports.TYPE_LIST, exports.TYPE_FILE];

/**
 * An increasing suffix of numbers to ensure we create unique channel names.
 * Although we could use UUIDs, using integers will help with debugging.
 */
var CHANNELS_CREATED = 0;

/**
 * Creates a uuid-based channel name for a message request.
 *
 * @returns {String} name for a channel
 */
exports.createChannelName = function() {
  var result = 'responseChannel_' + CHANNELS_CREATED;
  // Handle rollover.
  if (CHANNELS_CREATED === Number.MAX_SAFE_INTEGER) {
    // Will be unlikely to ever happen.
    console.log('Resetting number of channels to 0, maxed out');
    CHANNELS_CREATED = 0;
  } else {
    CHANNELS_CREATED++;
  }
  return result;
};

exports.createListMessage = function() {
  return exports.createMessage(exports.TYPE_LIST);
};

exports.createFileMessage = function(filePath) {
  var result = exports.createMessage(exports.TYPE_FILE);
  var request = {};
  request.accessPath = filePath;
  result.request = request;
  return result;
};

exports.createMessage = function(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error('Unrecognized message type: ' + type);
  }

  var result = {};

  result.channelName = exports.createChannelName();
  result.type = type;

  return result;
};

exports.isList = function(msg) {
  return msg.type && msg.type === exports.TYPE_LIST;
};

exports.isFile = function(msg) {
  return msg.type && msg.type === exports.TYPE_FILE;
};
