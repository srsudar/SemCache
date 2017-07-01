'use strict';

const stratBloom = require('./bloom-strategy');
const stratDig = require('./digest-strategy');
const util = require('../util');


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
  bloom: 'bloom'
};

/**
 * The amount of time to wait between refreshing the coalescence strategy.
 */
exports.REFRESH_CYCLE_MILLIS = 60000;

/**
 * The current startegy for resolving coalescence requests.
 */
exports.CURRENT_STRATEGY = exports.STRATEGIES.digest;

exports.ACTIVE_SRAT_OBJECT = null;

/**
 * Restore state for the coalescence module.
 */
exports.reset = function() {
  if (exports.ACTIVE_SRAT_OBJECT) {
    exports.ACTIVE_SRAT_OBJECT.reset();
  }
  exports.ACTIVE_SRAT_OBJECT = null;
};

/**
 * Start the coalescence manager.
 */
exports.initialize = function() {
  let strategy = exports.getStrategy();
  strategy.initialize();
};

/**
 * Initialize a refresh cycle for the active strategy. Stops when there is no
 * active strategy object.
 */
exports.enqueueRefresh = function() {
  return new Promise(function(resolve) {
    util.wait(exports.REFRESH_CYCLE_MILLIS)
    .then(() => {
      console.log('Refreshing');
      if (exports.ACTIVE_SRAT_OBJECT) {
        exports.ACTIVE_SRAT_OBJECT.refresh();
        exports.enqueueRefresh();
        resolve();
      } else {
        console.log('No active coalescence strategy, stopping refresh');
        resolve();
      }
    });
  });
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
exports.queryForUrls = function(urls) {
  return new Promise(function(resolve, reject) {
    let strategy = exports.getStrategy();
    strategy.initialize()
    .then(() => {
      return strategy.performQuery(urls);
    })
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get the implementation of the current coalescence strategy.
 *
 * @return {DigestStrategy|BloomStrategy}
 */ 
exports.getStrategy = function() {
  if (exports.ACTIVE_SRAT_OBJECT) {
    return exports.ACTIVE_SRAT_OBJECT;
  }
  let result = null;
  if (exports.CURRENT_STRATEGY === exports.STRATEGIES.digest) {
    result = new stratDig.DigestStrategy();
  } else if (exports.CURRENT_STRATEGY === exports.STRATEGIES.bloom) {
    result = new stratBloom.BloomStrategy();
  } else {
    throw new Error('Unrecognized strategy: ' + exports.CURRENT_STRATEGY);
  }
  exports.ACTIVE_SRAT_OBJECT = result;
  return result;
};
