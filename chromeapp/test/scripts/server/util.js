'use strict';

const api = require('../../../app/scripts/server/server-api');
const putil = require('../persistence/persistence-util');


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
  // We expect something like:
  // {
  //   metadata: {},
  //   cachedPages: [CPsummary, CPSummary]
  // }
  return {
    metadata: api.createMetadatObj(),
    cachedPages: [...putil.genCPSummaries(2)]
  };
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
  return Buffer.from(JSON.stringify(exports.getListResponseJson()));
};

exports.getCachedPageResponseObj = function() {
  return putil.genCPDisks(1).next().value;
};

exports.getCachedPageResponseBuff = function() {
  return exports.getCachedPageResponseObj().toBuffer();
};

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

exports.getDigestResponseBuff = function() {
  let json = exports.getDigestResponseJson();
  return Buffer.from(JSON.stringify(json));
};
