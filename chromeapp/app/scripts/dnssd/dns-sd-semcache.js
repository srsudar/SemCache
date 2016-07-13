/*jshint esnext:true*/
'use strict';

/**
 * A SemCache-specific wrapper around the mDNS and DNSSD APIs. SemCache clients
 * should use this module, as it handles things like service strings. More
 * general clients--i.e. those not implementing a SemCache instance--should
 * use the dns-sd module.
 */

var dnssd = require('./dns-sd');

var SEMCACHE_SERVICE_STRING = '_semcache._tcp';

/**
 * Return the service string representing SemCache, e.g. "_semcache._tcp".
 */
exports.getSemCacheServiceString = function() {
  return SEMCACHE_SERVICE_STRING;
};

/**
 * Register a SemCache instance. Returns a Promise that resolves with an object
 * like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local"
 * }
 *
 * name: the user-friendly name of the instance, e.g. "Sam's SemCache".
 * port: the port on which the SemCache instance is running.
 */
exports.registerSemCache = function(name, port) {
  var result = dnssd.register(name, SEMCACHE_SERVICE_STRING, port);
  return result;
};

/**
 * Browse for SemCache instances on the local network. Returns a Promise that
 * resolves with a list of objects like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 8889
 * }
 *
 * Resolves with an empty list if no instances are found.
 */
exports.browseForSemCacheInstances = function() {
  var result = dnssd.browse(SEMCACHE_SERVICE_STRING);
  return result;
};
