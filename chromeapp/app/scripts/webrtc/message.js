'use strict';

/**
 * Request messages for communicating with peers.
 *
 * API:
 * {
 *   channelName: /name of the channel to listen to/
 *   type: { list | etc },
 *   auth: /some object that can later be used for roles permissions/,
 *   request: {
 *     / depends on the object itself. could be a file path, eg /
 *   }
 * }
 */

exports.TYPE_LIST = 'list';
exports.TYPE_DIGEST = 'digest';
exports.TYPE_CACHED_PAGE = 'cachedpage';
exports.TYPE_BLOOM_FILTER = 'bloomfilter';

/** Valid types of request messages. */
let VALID_TYPES = [
  exports.TYPE_LIST,
  exports.TYPE_DIGEST,
  exports.TYPE_CACHED_PAGE,
  exports.TYPE_BLOOM_FILTER,
];

/**
 * An increasing suffix of numbers to ensure we create unique channel names.
 * Although we could use UUIDs, using integers will help with debugging.
 */
let CHANNELS_CREATED = 0;

/**
 * Creates a uuid-based channel name for a message request.
 *
 * @return {string} name for a channel
 */
exports.createChannelName = function() {
  let result = 'responseChannel_' + CHANNELS_CREATED;
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

/**
 * @param {number} offset
 * @param {number} limit
 *
 * @return {Object}
 */
exports.createListMessage = function(offset, limit) {
  let request = { offset, limit };
  let result = exports.createMessage(exports.TYPE_LIST);
  result.request = request;
  return result;
};

/**
 * @return {Object}
 */
exports.createDigestMessage = function() {
  return exports.createMessage(exports.TYPE_DIGEST);
};

/**
 * @return {Object}
 */
exports.createBloomFilterMessage = function() {
  return exports.createMessage(exports.TYPE_BLOOM_FILTER);
};

/**
 * @param {string} href href of the cached page you are requesting
 *
 * @return {Object}
 */
exports.createCachedPageMessage = function(href) {
  let result = exports.createMessage(exports.TYPE_CACHED_PAGE);
  let request = {};
  request.href = href;
  result.request = request;
  return result;
};

/**
 * @param {string} type
 *
 * @return {Object}
 */
exports.createMessage = function(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error('Unrecognized message type: ' + type);
  }

  let result = {};

  result.channelName = exports.createChannelName();
  result.type = type;

  return result;
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isList = function(msg) {
  return msg.type && msg.type === exports.TYPE_LIST;
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isDigest = function(msg) {
  return msg.type && msg.type === exports.TYPE_DIGEST;
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isBloomFilter = function(msg) {
  return msg.type && msg.type === exports.TYPE_BLOOM_FILTER;
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isCachedPage = function(msg) {
  return msg.type && msg.type === exports.TYPE_CACHED_PAGE;
};
