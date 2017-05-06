'use strict';

/**
 * The coalescence/manager module is the API callers should use to interact
 * with all content in a local network of collaborators. A single client might
 * want to know if 'http://www.example.com' is available locally, for example.
 * The client should use coalescer/manager to determine this information.
 */

/**
 * Enum representing strategies for performing cache coalescence.
 */
exports.STRATEGIES = {
  /**
   * Maintain a list of all available cached pages from each peer.
   */
  digest: 'digest',
};

/**
 * Obtain access information for the given array of URLs. The result will be an
 * array of length <= urls.length. Only those that are available will be
 * present.
 *
 * @param {Array.<string>} urls Array of URLs for which to query
 *
 * @return {Promise.<Array.<NetworkCachedPage>, Error>} Promise that resolves
 * with an Array of information about the urls or rejects with an Error.
 */
exports.getPageAccessInformation = function(urls) {
  console.log(urls);
}; 

/**
 * Query peers using the digest strategy.
 *
 * @param {Array.<string>} urls Array of URLs for which to query
 *
 * @return {Promise.<Array.<NetworkCachedPage>, Error>} Promise that resolves
 * with an Array of information about the urls or rejects with an Error.
 */
exports.queryForDigest = function(urls) {
  // We basically want to say:
  // 1) Can we perform the query right now or do we need updated peers?
  // 2) Update the peers
  // 3) Update the coalescer
  // 4) Perform the query
  console.log(urls);
};
