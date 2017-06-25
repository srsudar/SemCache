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

exports.genCacheInfos = function*(num) {
  for (let i = 0; i < num; i++) {
    let serviceType = '_semcache._tcp';
    let friendlyName = `Sam Cache ${i}`;
    let domainName = `laptop_${i}.local`;
    let ipAddress = `${i}.${i}.${i}.${i}`;
    let port = i;
    let instanceName = `${friendlyName}.${serviceType}.local`;

    yield {
      serviceType,
      friendlyName,
      domainName,
      ipAddress,
      port,
      instanceName
    };
  }
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
    let cacheName = cacheNames[i];
    let domain = 'domain' + i + '.local';
    let ipAddress = [i, i, i, i].join('.');
    let port = 'port ' + 'i';
    let listUrl = 'listUrl_' + i + '.json';
    let fullServiceName = cacheName.serviceName;
    
    let cache = exports.createCacheObj(
      domain, cacheName.friendlyName, ipAddress, port, listUrl, fullServiceName
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
  listUrl,
  fullServiceName
) {
  var instanceName = friendlyName + '._semcache._tcp.local';
  var result = {
    domainName: domainName,
    friendlyName: friendlyName,
    instanceName: instanceName,
    ipAddress: ipAddress,
    port: port,
    listUrl: listUrl,
    fullServiceName: fullServiceName
  };
  return result;
};

/**
 * Generate URLs.
 */
exports.genUrls = function*(num) {
  num = num || 3;
  for (let i = 0; i < num; i++) {
    yield `http://foo.com/page_${i}`;
  }
};
