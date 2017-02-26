'use strict';

/**
 * Helper methods for testing.
 */


/**
 * Create service names as returned by app-controller.getPeerCacheNames.
 *
 * @param {string} serviceType
 * @param {integer} numCaches the number of caches to create
 *
 * @return {Array.<Object>} Array of objects as returned by getPeerCacheNames
 */
exports.createCacheNames = function(serviceType, numCaches) {
  var baseName = 'Cache No ';
  var result = [];
  for (var i = 0; i < numCaches; i++) {
    var friendlyName = baseName + i;
    var fullName = friendlyName + '.' + serviceType + '.local';
    var cacheName = {
      serviceType: serviceType,
      serviceName: fullName,
      friendlyName: friendlyName
    };
    result.push(cacheName);
  }
  return result;
};

/**
 * Generate cache objects like those from createCacheObj() but using only the
 * output of createCacheNames() as input.
 *
 * @return {Array.<Object>}
 */
exports.createCacheObjsFromNames = function(cacheNames) {
  var result = [];
  for (var i = 0; i < cacheNames.length; i++) {
    var cacheName = cacheNames[i];
    var domain = 'domain' + i + '.local';
    var ipAddress = [i, i, i, i].join('.');
    var port = port + 'i';
    var listUrl = 'listUrl_' + i + '.json';
    
    var cache = exports.createCacheObj(
      domain, cacheName.friendlyName, ipAddress, port, listUrl
    );
    result.push(cache);
  }
  return result;
};

/**
 * Create an object as is returned by app-controller.getBrowseableCaches.
 */
exports.createCacheObj = function(
  domainName,
  friendlyName,
  ipAddress,
  port,
  listUrl
) {
  var instanceName = friendlyName + '._semcache._tcp.local';
  var result = {
    domainName: domainName,
    friendlyName: friendlyName,
    instanceName: instanceName,
    ipAddress: ipAddress,
    port: port,
    listUrl: listUrl
  };
  return result;
};
