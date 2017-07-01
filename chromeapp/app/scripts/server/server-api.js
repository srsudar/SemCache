'use strict';

/**
 * This module is responsible for generating responses coming from peers. It
 * does not handle sending to peers, it only generates responses. It
 * essentially provides endpoints that expose server-like functionality for the
 * instance. E.g. listing saved pages, providing saved pages, etc.
 */

const base64 = require('base-64');
const URI = require('urijs');

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
const PATH_GET_BLOOM_FILTER = 'bloom_filter';
/** The path we use for mimicking the list_pages endpoing during evaluation. */
const PATH_EVAL_LIST_PAGE_CACHE = 'eval_list';
const PATH_RECEIVE_WRTC_OFFER = 'receive_wrtc';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 50;

/**
 * Generate a URL for the given path. Helper for taking care of scheme, etc.
 *
 * @param {string} ipAddress
 * @param {number} port
 * @param {string} path should NOT being with a trailing slash
 */
function createUrlForPath(ipAddress, port, path) {
  if (!ipAddress || !port || !path) {
    throw new Error(
      'ipAddress, port, and path must be specified', ipAddress, port, path
    );
  }
  return `${HTTP_SCHEME}${ipAddress}:${port}/${path}`; 
}

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
    receiveWrtcOffer: PATH_RECEIVE_WRTC_OFFER,
    bloomFilter: PATH_GET_BLOOM_FILTER
  };
};

/**
 * Return the URL where the list of cached pages can be accessed.
 *
 * @param {string} ipAddress the IP address of the cache
 * @param {integer} port the port where the server is listening at ipAddress
 */
exports.getListPageUrlForCache = function(ipAddress, port) {
  return createUrlForPath(
    ipAddress, port, exports.getApiEndpoints().listPageCache
  );
};

/**
 * Return the URL where the cache digest can be accessed.
 *
 * @param {string} ipAddress the IP address of the cache
 * @param {integer} port the port where the server is listening at ipAddress
 */
exports.getUrlForDigest = function(ipAddress, port) {
  return createUrlForPath(
    ipAddress, port, exports.getApiEndpoints().pageDigest
  );
};

/**
 * Return the URL where the cache Bloom filter can be accessed.
 *
 * @param {string} ipAddress the IP address of the cache
 * @param {integer} port the port where the server is listening at ipAddress
 */
exports.getUrlForBloomFilter = function(ipAddress, port) {
  return createUrlForPath(
    ipAddress, port, exports.getApiEndpoints().bloomFilter
  );
};

/**
 * Create the full access path that can be used to access the cached page.
 *
 * @param {string} ipAddress the IP address of the cache
 * @param {integer} port the port where the server is listening at ipAddress
 * @param {string} href the href of the page to fetch
 *
 * @return {string} a fully qualified and valid URL
 */
exports.getAccessUrlForCachedPage = function(ipAddress, port, href) {
  if (!href) {
    throw new Error('href not specified', href);
  }
  // We'll base 64 encode this.
  let encoded = base64.encode(href);
  let path = [exports.getApiEndpoints().pageCache, encoded].join('/');
  return createUrlForPath(ipAddress, port, path);
};

/**
 * Get the file name of the file that is being requested.
 *
 * @param {string} path the path of the request
 *
 * @return {string} the href of the file being requested
 */
exports.getCachedPageHrefFromPath = function(path) {
  let uri = URI(path);
  let encoded = uri.filename();
  let href = base64.decode(encoded);
  return href;
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
      result.cachedPages = cpsums.map(cpsum => cpsum.toJSON());
      resolve(Buffer.from(JSON.stringify(result)));
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {string} href the href of the requested page
 *
 * @return {Promise.<Buffer, Error>} Promise that resolves with a Buffer
 * representing the CPDisk, or a null value if the page is not found.
 */
exports.getResponseForCachedPage = function(href) {
  return new Promise(function(resolve, reject) {
    datastore.getCPDiskForHrefs(href)
    .then(cpdiskArr => {
      if (cpdiskArr.length === 0) {
        // No matching pages.
        resolve(null);
      } else {
        resolve(cpdiskArr[0].toBuffer());
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
    return bloomFilter.toBuffer();
  });
};

/**
 * @param {Buffer} buff
 *
 * @return {Array.<CPSummary>}
 */
exports.parseResponseForList = function(buff) {
  let result = JSON.parse(buff.toString());
  result.cachedPages = result.cachedPages.map(
    cpsumJson => objects.CPSummary.fromJSON(cpsumJson)
  );
  return result.cachedPages;
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
  return JSON.parse(buff.toString()).digest;
};

/**
 * @param {Buffer} buff
 *
 * @return {BloomFilter}
 */
exports.parseResponseForBloomFilter = function(buff) {
  return BloomFilter.fromBuffer(buff);
};
