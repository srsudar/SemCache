'use strict';

/**
 * Controls the API for the server backing SemCache.
 */

var datastore = require('../persistence/datastore');
var appController = require('../app-controller');

var HTTP_SCHEME = 'http://';

var VERSION = 0.0;

/** 
 * The path from the root of the server that serves cached pages.
 */
var PATH_LIST_PAGE_CACHE = 'list_pages';
var PATH_GET_CACHED_PAGE = 'pages';
var PATH_GET_PAGE_DIGEST = 'page_digest';
/** The path we use for mimicking the list_pages endpoing during evaluation. */
var PATH_EVAL_LIST_PAGE_CACHE = 'eval_list';
var PATH_RECEIVE_WRTC_OFFER = 'receive_wrtc';

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
 * @return {Object} an object mapping API end points to string paths, like the
 * following:
 * {
 *   pageCache: '',
 *   listPageCache: ''
 * }
 */
exports.getApiEndpoints = function() {
  return {
    pageCache: PATH_GET_CACHED_PAGE,
    listPageCache: PATH_LIST_PAGE_CACHE,
    pageDigest: PATH_GET_PAGE_DIGEST,
    evalListPages: PATH_EVAL_LIST_PAGE_CACHE,
    receiveWrtcOffer: PATH_RECEIVE_WRTC_OFFER
  };
};

/**
 * Return the URL where the list of cached pages can be accessed.
 *
 * @param {string} ipAddress the IP address of the cache
 * @param {integer} port the port where the server is listening at ipAddress
 */
exports.getListPageUrlForCache = function(ipAddress, port) {
  var scheme = HTTP_SCHEME;
  var endpoint = exports.getApiEndpoints().listPageCache;
  
  var result = scheme + ipAddress + ':' + port + '/' + endpoint;
  return result;
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
  // TODO: this might have to strip the path of directory where things are
  // stored--it basically maps between the two urls.
  var httpIface = appController.getListeningHttpInterface();
  var addressAndPort = httpIface.address + ':' + httpIface.port;
  var apiPath = exports.getApiEndpoints().pageCache;
  var result = scheme + [addressAndPort, apiPath, fullPath].join('/');
  return result;
};

/**
 * Return a JSON object response for the all cached pages endpoint.
 *
 * @return {Promise.<Object, Error} Promise that resolves with an object like
 * the following:
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
 * Return a JSON object representing the digest of all pages available on this
 * cache.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the response or
 * rejects with an Error. The response will be like the following:
 * {
 *   metadata: Object,
 *   digest:
 *     [
 *       {
 *         fullUrl: full URL of the page that was captured
 *         captureDate: the date the page was captured
 *       },
 *       ...
 *     ]
 * }
 */
exports.getResponseForAllPagesDigest = function() {
  return new Promise(function(resolve, reject) {
    datastore.getAllCachedPages()
    .then(pages => {
      var result = {};
      result.metadata = exports.createMetadatObj();
      
      var pageInfos = [];
      pages.forEach(page => {
        var info = {};
        info.fullUrl = page.metadata.fullUrl;
        info.captureDate = page.captureDate;
        pageInfos.push(info);
      });

      result.digest = pageInfos;
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
