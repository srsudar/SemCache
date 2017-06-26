'use strict';

var util = require('../util');

/**
 * Code shared across the peer-interface implementations.
 */

/**
 * The path to the HTTP endpoint that serves the digest. Should match the value
 * in the server/server-api module.
 */
let PATH_GET_PAGE_DIGEST = 'page_digest';
let PATH_GET_BLOOM_FILTER = 'bloom_filter';

/**
 * Returns the IP address, extracting if necessary.
 *
 * @param {string} ipaddr
 * @param {string} url
 *
 * @return {string}
 */
function getIpAddress(ipaddr, url) {
  var result = ipaddr;
  if (!result) {
    result = util.getHostFromUrl(url);
  }
  return result;
}

/**
 * Returns the port, extracting if necessary.
 *
 * @param {integer} port
 * @param {string} url
 *
 * @return {integer}
 */
function getPort(port, url) {
  var result = port;
  if (!result) {
    result = util.getPortFromUrl(url);
  }
  return result;
}

/**
 * Return the path to the endpoint providing a page digest. Does not include an 
 * IP or port, as well as no leading/trailing slashes.
 */
exports.getDigestPath = function() {
  return PATH_GET_PAGE_DIGEST;
};

exports.getBloomFilterPath = function() {
  return PATH_GET_BLOOM_FILTER;
};

/**
 * Create parameters for a PeerAccessor getList call. If ipaddr or port is
 * missing, tries to interpolate them from listUrl.
 *
 * @param {string} ipaddr IP address of the peer
 * @param {integer} port port of the peer
 * @param {string} listUrl the list URL for the peer's list access point. Only
 * needed if the transport method will be HTTP.
 *
 * @return {Object}
 */
exports.createListParams = function(ipaddr, port, listUrl) {
  ipaddr = getIpAddress(ipaddr, listUrl);
  port = getPort(port, listUrl);

  // Create the digest URL.
  var digestUrl = ['http://', ipaddr, ':', port, '/', exports.getDigestPath()]
    .join('');
  var bloomUrl = [
    'http://',
    ipaddr,
    ':',
    port,
    '/', exports.getBloomFilterPath()
  ].join('');

  return {
    ipAddress: ipaddr,
    port: port,
    listUrl: listUrl,
    digestUrl: digestUrl,
    bloomUrl: bloomUrl
  };
};

/**
 * Create parameters for a PeerAccessor getFile call. If ipaddr or port is
 * missing, tries to interpolate them from listUrl.
 *
 * @param {string} ipaddr IP address of the peer
 * @param {integer} port port of the peer
 * @param {string} fileUrl the list URL for the file's access URL. Only
 * needed if the transport method will be HTTP.
 *
 * @return {Object}
 */
exports.createFileParams = function(ipaddr, port, fileUrl) {
  ipaddr = getIpAddress(ipaddr, fileUrl);
  port = getPort(port, fileUrl);
  return {
    ipAddress: ipaddr,
    port: port,
    fileUrl: fileUrl
  };
};
