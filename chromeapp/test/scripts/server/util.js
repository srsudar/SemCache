'use strict';

const Buffer = require('buffer/').Buffer;

const api = require('../../../app/scripts/server/server-api');
const bloomFilter = require('../../../app/scripts/coalescence/bloom-filter');
const putil = require('../persistence/persistence-util');
const tutil = require('../test-util');

const BloomFilter = bloomFilter.BloomFilter;


/**
 * Various helper functions for testing the server module.
 */

/**
 * Create an object as expected for the list pages endpoint. CPSummary objects
 * are included as their types.
 *
 * @return {Object}
 */
exports.getListResponseObj = function() {
  return {
    metadata: api.createMetadatObj(),
    cachedPages: [...putil.genCPSummaries(2)]
  };
};

exports.getListResponseParsed = function() {
  return exports.getListResponseJson().cachedPages;
};

/**
 * Create a pure JSON object for the list pages endpoint.
 *
 * @return {Object}
 */
exports.getListResponseJson = function() {
  let json = exports.getListResponseObj();
  json.cachedPages = json.cachedPages.map(cpsum => cpsum.toJSON());
  return json;
};

/**
 * Create a Buffer response for the list pages endpoint.
 *
 * @return {Buffer}
 */
exports.getListResponseBuff = function() {
  let str = JSON.stringify([]);
  console.log(str);
  console.log(str.length);
  return Buffer.from(str);
};

/**
 * The final, parsed response expected form the server. NOT necessarily the
 * message itself, which might contain metadata.
 */
exports.getCachedPageResponseParsed = function () {
  // We don't have any parsing to do here, we are assuming it is just a raw
  // CachedPage.
  return putil.genCPDisks(1).next().value;
};

/**
 * The Buffer value for the response from the server. This comes over the wire.
 */
exports.getCachedPageResponseBuff = function() {
  return exports.getCachedPageResponseParsed().toBuffer();
};

/**
 * The full JSON response of the server. This contains metadata.
 */
exports.getDigestResponseJson = function() {
  return {
    metadata: api.createMetadatObj(),
    digest: [
      {
        fullUrl: 'heyo',
        captureDate: '2017-05-04'
      },
      {
        fullUrl: 'bye bye',
        captureDate: '2017-06-04'
      }
    ]
  };
};

/**
 * The Buffer version of getDigestResponseJson().
 */
exports.getDigestResponseBuff = function() {
  let json = exports.getDigestResponseJson();
  return Buffer.from(JSON.stringify(json));
};

/**
 * The expected output of a call to the parse response of the digest. This is
 * not just the JSON value of getDigestResponseJson(), but the digest itself
 * extracted from that value.
 */
exports.getDigestResponseParsed = function() {
  return exports.getDigestResponseJson().digest;
};

/**
 * The raw buffer expected from the getBloomResponse server.
 */
exports.getBloomResponseBuff = function() {
  // No metadata object here, so we can just call it directly
  return exports.getBloomResponseParsed().toBuffer();
};

/**
 * The final parsed value expected from the server.
 */
exports.getBloomResponseParsed = function() {
  // No metadata object here, so we can just call it directly
  let result = new BloomFilter();
  for (let cpinfo of tutil.genCacheInfos(5)) {
    result.add(cpinfo.captureHref);
  }
  return result;
};
