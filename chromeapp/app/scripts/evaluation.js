'use strict';

/**
 * Functionality useful to evaluating SemCache.
 */

var datastore = require('./persistence/datastore');
var api = require('./server/server-api');
var storage = require('./chrome-apis/storage');

/** The prefix value for timing keys we will use for local storage. */
var TIMING_KEY_PREFIX = 'timing_';

/**
 * Create a scoped version of key for to safely put in local storage
 *
 * @param {string} key
 *
 * @return {string} a scoped key, e.g. timing_key
 */
exports.createTimingKey = function(key) {
  return TIMING_KEY_PREFIX + key;
};

/**
 * Generate an Array of CachedPage objects useful for creating a response to
 * mimic response pages during an evaluation.
 *
 * @param {integer} numPages the number of CachedPages to generate. The number
 * of elements in the returned Array
 * @param {string} nonce a string that will be incorporated somehow into the
 * captureUrl value of the CachedPage. This is intended to allow the querier to
 * verify that the response has been generated based solely on this request.
 *
 * @return {Array<CachedPage>}
 */
exports.generateDummyPages = function(numPages, nonce) {
  var result = [];

  for (var i = 0; i < numPages; i++) {
    var page = exports.generateDummyPage(i, nonce);
    result.push(page);
  }

  return result;
};

/**
 * @param {integer} index position in the final Array for this page
 * @param {string} nonce the unique string that will be contained in the
 * captureUrl value of the resulting CachedPage
 *
 * @return {CachedPage}
 */
exports.generateDummyPage = function(index, nonce) {
  var captureUrl = 'www.' + nonce + '.' + index + '.com';
  var captureDate = new Date().toISOString();
  var path = 'http://somepath';
  var metadata = { muchMeta: 'so data' };

  var result = new datastore.CachedPage(
    captureUrl,
    captureDate,
    path,
    metadata
  );
  return result;
};

/**
 * Generate a response mirroring the functionality of
 * server-api.getResponseForAllCachedPages to be used for evaluation.
 *
 * @param {integer} numPages the number of responses to return
 * @param {string} nonce a string to incorporate into answers
 *
 * @return {object} the JSON server response
 */
exports.getDummyResponseForAllCachedPages = function(numPages, nonce) {
  var pages = exports.generateDummyPages(numPages, nonce);
  var result = {};
  result.metadata = api.createMetadatObj();
  result.cachedPages = pages;
  return result;
};

/**
 * @return {number} return window.performance.now()
 */
exports.getNow = function() {
  return window.performance.now();
};

/**
 * Log an event time to local storage. The key will be scoped for timing and
 * time will be added to a list of times to that value. E.g. logTim('foo', 3)
 * would result in a value like { timing_foo: [ 3 ] } being added to local
 * storage. Subsequent calls would append to that list.
 *
 * @param {string} key the key that will be scoped and set in chrome.storage
 * @param {number} time the timing value that will be logged
 *
 * @return {Promise} Promise that resolves when the write completes
 */
exports.logTime = function(key, time) {
  return new Promise(function(resolve) {
    var scopedKey = exports.createTimingKey(key);
    storage.get(scopedKey)
      .then(existingValues => {
        if (existingValues && existingValues[scopedKey]) {
          existingValues[scopedKey].push(time);
          return storage.set(existingValues);
        } else {
          // New value.
          existingValues[scopedKey] = [ time ];
          return storage.set(existingValues);
        }
      })
      .then(() => {
        resolve();
      });
  });
};
