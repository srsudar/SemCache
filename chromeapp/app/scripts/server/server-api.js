'use strict';

/**
 * Controls the API for the server backing SemCache.
 */

var datastore = require('../persistence/datastore');

var HTTP_SCHEME = 'http://';

var VERSION = 0.0;

/** 
 * The path from the root of the server that serves cached pages.
 */
var PATH_LIST_PAGE_CACHE = 'list_pages';
var PATH_GET_CACHED_PAGE = 'pages';

/**
 * Create the metadata object that is returned in server responses.
 */
exports.createMetadatObj = function() {
  var result = {};
  result.version = VERSION;
  return result;
};

/**
 * Returns an object mapping API end points to their paths. The paths do not
 * include leading or trailing slashes, but they can contain internal slashes
 * (e.g. 'foo' or 'foo/bar' but never '/foo/bar'). The paths do not contain
 * scheme, host, or port.
 *
 * @return {object} an object mapping API end points to string paths, like the
 * following:
 * {
 *   pageCache: '',
 *   listPageCache: ''
 * }
 */
exports.getApiEndpoints = function() {
  return {
    pageCache: PATH_GET_CACHED_PAGE,
    listPageCache: PATH_LIST_PAGE_CACHE
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

/**
 * Return a JSON object response for the all cached pages endpoing.
 *
 * @return {Promise} Promise that resolves with an object like the following:
 * {
 *   metadata: {},
 *   cachedPages: [CachedPage, CachedPage]
 * }
 */
exports.getResponseForAllCachedPages = function() {
  return new Promise(function(resolve, reject) {
    datastore.getAllCachedPages()
      .then(pages => {
        var result = {};
        result.metadata = exports.createMetadatObj();
        result.cachedPages = pages;
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Get the file name of the file that is being requested.
 *
 * @param {string} path the path of the request
 */
exports.getCachedFileNameFromPath = function(path) {
  var parts = path.split('/');
  // The file name is the last part of the path.
  var result = parts[parts.length - 1];
  return result;
};
