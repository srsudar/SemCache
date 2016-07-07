/*jshint esnext:true*/
'use strict';

/**
 * The client API for interacting with mDNS and DNS-SD.
 */

/**
 * Returns true if a .local domain name has been secured, or else false.
 */
function hasLocalDomain() {
  return false;
}

/**
 * Query the network to see if the domain name is available. The domain name
 * should end in the .local top level domain.
 */
exports.isDomainAvailable = function(domainName) {
  return new Promise(domainName);
};

/**
 * Publish a SemCache instance on the network.
 *
 * If a name has not already been secured via a successful call to
 * requestLocalDomain(), an error will be thrown.
 *
 * instanceName: the human-readable name of the SemCache instance. This should
 *   be something like "Sam's SemCache". The full advertised service will be
 *   this instance name suffixed with the protocol, transport protocol, and
 *   '.local' top level domain.
 * port: the port where the service can be found.
 */
exports.publishSemCache = function(instanceName, port) {
  // This corresponds to publishing a SRV record.
  if (!hasLocalDomain()) {
    throw new Error('A .local domain name has not been acquired');
  }
};

/**
 * Asks the network for any local SemCache instances. Returns a Promise that
 * resolves with a list of service instance name strings. E.g. it might return
 * "Sam's SemCache._http._tcp.local".
 *
 * This is equivalent to issuing a request for PTR records.
 */
exports.queryForSemCacheServices = function() {
  return new Promise();
};

/**
 * Ask the network for the information needed to connect to a particular
 * SemCache instance. E.g. after knowing that "Sam's SemCache._http._tcp.local"
 * is a local SemCache instance, the port and IP address must be discovered in
 * order to connect. This function provides that information.
 *
 * Returns a Promise that resolves with an object like the following:
 * {ipAddress: 123.123.123.123, port:8888}.
 */
exports.getConnectionInfoForServiceInstance = function(serviceInstanceName) {
  return new Promise();
};
