'use strict';

/**
 * This module is responsible for generating responses coming from peers. It
 * does not handle sending to peers, it only generates responses. It
 * essentially provides endpoints that expose server-like functionality for the
 * instance. E.g. listing saved pages, providing saved pages, etc.
 */

const appController = require('../app-controller');
const BloomFilter = require('../coalescence/bloom-filter').BloomFilter;
const datastore = require('../persistence/datastore');
const objects = require('../persistence/objects');

const HTTP_SCHEME = 'http://';

const VERSION = 0.0;

/** 
 * The path from the root of the server that serves cached pages.
 */
const PATH_LIST_PAGE_CACHE = 'list_pages';
const PATH_GET_CACHED_PAGE = 'pages';
const PATH_GET_PAGE_DIGEST = 'page_digest';
/** The path we use for mimicking the list_pages endpoing during evaluation. */
const PATH_EVAL_LIST_PAGE_CACHE = 'eval_list';
const PATH_RECEIVE_WRTC_OFFER = 'receive_wrtc';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 50;

/**
 * Create the metadata object that is returned in server responses.
 */
exports.createMetadatObj = function() {
  let result = {};
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
  let scheme = HTTP_SCHEME;
  let endpoint = exports.getApiEndpoints().listPageCache;
  
  let result = scheme + ipAddress + ':' + port + '/' + endpoint;
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
  let scheme = HTTP_SCHEME;
  // TODO: this might have to strip the path of directory where things are
  // stored--it basically maps between the two urls.
  let httpIface = appController.getListeningHttpInterface();
  let addressAndPort = httpIface.address + ':' + httpIface.port;
  let apiPath = exports.getApiEndpoints().pageCache;
  let result = scheme + [addressAndPort, apiPath, fullPath].join('/');
  return result;
};

/**
 * Return a JSON object response for the all cached pages endpoint.
 *
 * @return {Promise.<Buffer, Error} Promise that resolves with Buffer from an
 * object like the following:
 * {
 *   metadata: {},
 *   cachedPages: [CPSummary, CPSummary]
 * }
 */
exports.getResponseForAllCachedPages = function() {
  return new Promise(function(resolve, reject) {
    datastore.getCachedPageSummaries(DEFAULT_OFFSET, DEFAULT_LIMIT)
    .then(cpsums => {
      let result = {};
      result.metadata = exports.createMetadatObj();
      result.cachedPages = cpsums.map(cpsum => cpsum.asJSON());
      resolve(Buffer.from(JSON.stringify(result)));
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {Object} params parameters for the request
 * @param {string} params.href the href of the requested page
 *
 * @return {Promise.<Buffer, Error>} Promise that resolves with a Buffer
 * representing the CPDisk, or a null value if the page is not found.
 */
exports.getResponseForCachedPage = function(params) {
  return new Promise(function(resolve, reject) {
    let href = params.href;
    datastore.getCPDiskForHrefs(href)
    .then(cpdiskArr => {
      if (cpdiskArr.length === 0) {
        // No matching pages.
        resolve(null);
      } else {
        resolve(cpdiskArr[0].asBuffer());
      }
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
 * @return {Promise.<Buffer, Error>} Promise that resolves with the response or
 * rejects with an Error. The response will be a Buffer from an object like the
 * following:
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
    .then(cpinfos => {
      let result = {};
      result.metadata = exports.createMetadatObj();
      
      let pageInfos = cpinfos.map(cpinfo => {
        return {
          fullUrl: cpinfo.captureHref,
          captureDate: cpinfo.captureDate
        };
      });

      result.digest = pageInfos;
      resolve(Buffer.from(JSON.stringify(result)));
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @return {Promise.<Buffer, Error>}
 */
exports.getResponseForBloomFilter = function() {
  return datastore.getAllCachedPages()
  .then(cpinfos => {
    let bloomFilter = new BloomFilter();
    cpinfos.forEach(cpinfo => bloomFilter.add(cpinfo.captureHref));
    return bloomFilter.serialize();
  });
};

/**
 * @param {Buffer} buff
 *
 * @return {Object}
 */
exports.parseResponseForList = function(buff) {
  // This is a pure JSON response. The only thing to do is parse and invoke the
  // constructors.
  let result = JSON.parse(buff.toString());
  result.cachedPages = result.cachedPages.map(
    cpsumJson => objects.CPSummary.fromJSON(cpsumJson)
  );
  return result;
};

/*
 * @param {Buffer} buff
 *
 * @return {Object}
 */
exports.parseResponseForCachedPage = function(buff) {
  // Here we expect either null or a CPDisk.
  if (buff === null) {
    return null;
  } else {
    return objects.CPDisk.fromBuffer(buff);
  }
};

/*
 * @param {Buffer} buff
 *
 * @return {Object}
 */
exports.parseResponseForDigest = function(buff) {
  // This one is pure JSON.
  return JSON.parse(buff.toString());
};

/**
 * @param {Buffer} buff
 *
 * @return {BloomFilter}
 */
exports.parseResponseForBloomFilter = function(buff) {
  return BloomFilter.from(buff);
};

/**
 * Get the file name of the file that is being requested.
 *
 * @param {string} path the path of the request
 */
exports.getCachedFileNameFromPath = function(path) {
  let parts = path.split('/');
  // The file name is the last part of the path.
  let result = parts[parts.length - 1];
  return result;
};
