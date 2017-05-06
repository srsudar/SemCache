/*jshint esnext:true*/
'use strict';

/**
 * A SemCache-specific wrapper around the mDNS and DNSSD APIs. SemCache clients
 * should use this module, as it handles things like service strings. More
 * general clients--i.e. those not implementing a SemCache instance--should
 * use the dns-sd module.
 */

var dnssd = require('./dns-sd');
var serverApi = require('../server/server-api');

var SEMCACHE_SERVICE_STRING = '_semcache._tcp';

/**
 * Return the service string representing SemCache, e.g. "_semcache._tcp".
 */
exports.getSemCacheServiceString = function() {
  return SEMCACHE_SERVICE_STRING;
};

/**
 * Get the fully qualified name for an instance from its friendly name. E.g.
 * convert from `Tyrion's Cache` to `Tyrion's Cache._semcache._tcp.local`.
 *
 * @param {string} friendlyName the user friendly name of the SemCache instance
 *
 * @return {string} the fully qualified <instance>.<type>.<domain> name
 */
exports.getFullName = function(friendlyName) {
  return dnssd.createSrvName(
    friendlyName,
    exports.getSemCacheServiceString(),
    dnssd.LOCAL_SUFFIX
  );
};

/**
 * Register a SemCache instance.
 *
 * @param {string} host 
 * @param {string} name  the user-friendly name of the instance, e.g. "Sam's
 * @param {integer} port the port on which the SemCache instance is running.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an object like
 * the following:
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local"
 * }
 */
exports.registerSemCache = function(host, name, port) {
  var result = dnssd.register(host, name, SEMCACHE_SERVICE_STRING, port);
  return result;
};

/**
 * Browse for all the SemCache instance names on the local network. This does
 * not return the operational information (e.g. IP address and port) for the
 * caches--it only returns a list of names on the network. Operational
 * information should be resolved as needed using the resolveCache() function.
 *
 * @return {Promise.<Array.<Object>, Error>} Promise that resolves with an
 * Array of objects as returned from dnssd.queryForServiceInstances
 */
exports.browseForSemCacheInstanceNames = function() {
  return dnssd.queryForServiceInstances(
    exports.getSemCacheServiceString(),
    dnssd.DEFAULT_QUERY_WAIT_TIME,
    dnssd.DEFAULT_NUM_PTR_RETRIES
  );
};

/**
 * Obtain the operational information necessary to connect to the cache with
 * the given name.
 *
 * This is the method responsible for querying the network for SRV and A
 * records to resolve the port and IP address of the service. Beyond just
 * surfacing the data from the SRV and A records, it also computes the URL
 * required to connect to the list of pages in the cache.
 *
 * @param {string} fullName the full name of the cache, e.g. `Tyrion's
 * Cache._semcache._tcp.local`
 *
 * @return {Promise.<Object, Error>} that resolves with an object like the
 * following. The promise rejects if the resolution does not succeed (e.g. from
 * a missing SRV or A record).
 * {
 *   friendlyName: 'Sam Cache',
 *   instanceName: 'Sam Cache._semcache._tcp.local',
 *   domainName: 'laptop.local',
 *   ipAddress: '123.4.5.6',
 *   port: 8888,
 *   listUrl: 'http://123.4.5.6:8888/list_pages'
 * }
 */
exports.resolveCache = function(fullName) {
  return new Promise(function(resolve, reject) {
    dnssd.resolveService(fullName)
    .then(info => {
      var listUrl = serverApi.getListPageUrlForCache(
        info.ipAddress, info.port
      );
      info.listUrl = listUrl;
      resolve(info);
    })
    .catch(err => {
      // something went wrong.
      reject(err);
    });
  });

};

/**
 * Browse for SemCache instances on the local network. This is a complete
 * resolution with all operating information.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with a list of
 * objects like the following, or an empty list if no instances are found.
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 8889,
 *   ipAddress: '1.2.3.4'
 * }
 */
exports.browseForSemCacheInstances = function() {
  var result = dnssd.browseServiceInstances(SEMCACHE_SERVICE_STRING);
  return result;
};
