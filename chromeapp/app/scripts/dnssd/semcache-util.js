/*jshint esnext:true*/
'use strict';

/**
 * Various functionality specific to SemCache.
 */

var SEMCACHE_SERVICE_STRING = '_semcache._tcp.local';

/**
 * Get the SemCache service string, e.g. _semcache._tcp.local.
 */
exports.getSemCacheServiceString = function() {
  return SEMCACHE_SERVICE_STRING;
};
