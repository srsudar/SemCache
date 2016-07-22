'use strict';

/**
 * Controls the API for the server backing SemCache.
 */

var HTTP_SCHEME = 'http://';

/** 
 * The path from the root of the server that serves cached pages.
 */
var PATH_PAGE_CACHE = 'pages';

/**
 * Returns an object mapping API end points to their paths. The paths do not
 * include leading or trailing slashes, but they can contain internal slashes
 * (e.g. 'foo' or 'foo/bar' but never '/foo/bar'). The paths do not contain
 * scheme, host, or port.
 *
 * @return {object} an object mapping API end points to string paths, like the
 * following:
 * {
 *   pageCache: ''
 * }
 */
exports.getApiEndpoints = function() {
  return {
    pageCache: PATH_PAGE_CACHE
  };
};

/**
 * Create the full access path that can be used to access the cached page.
 *
 * @param {string} fullPath the full path of the file that is to be accessed
 *
 * @return {string} a fully qualified and valid URL
 */
exports.getAccessUrlForCachedPage = function(fullPath) {
  var scheme = HTTP_SCHEME;
  // TODO: expose a method that gets the current address and port.
  // TODO: this might have to strip the path of directory where things are
  // stored--it basically maps between the two urls.
  var addressAndPort = '127.0.0.1:8081';
  var apiPath = exports.getApiEndpoints().pageCache;
  var result = scheme + [addressAndPort, apiPath, fullPath].join('/');
  return result;
};
