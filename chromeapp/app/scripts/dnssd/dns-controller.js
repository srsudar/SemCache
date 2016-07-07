/*jshint esnext:true*/
'use strict';

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

/**
 * Issue a query for an A Record with the given domain name. Returns a promise
 * that resolves with a list of ARecords received in response. Resolves with an
 * empty list if none are found.
 */
exports.queryForARecord = function(domainName) {
  return new Promise();
};

/**
 * Issue a query for PTR Records advertising the given service name. Returns a
 * promise that resolves with a list of PtrRecords received in response.
 * Resolves with an empty list if none are found.
 */
exports.queryForPtrRecord = function(serviceName) {
  return new Promise();
};

/**
 * Issue a query for SRV Records corresponding to the given instance name.
 * Returns a promise that resolves with a list of SrvRecords received in
 * response. Resolves with an empty list if none are found.
 */
exports.queryForSrvRecord = function(instanceName) {
  return new Promise();
};

/**
 * Add an SRV Record to the DNS system.
 */
exports.addSrvRecord = function(instanceName, port, domainName) {

};

/**
 * Add an A Record to the DNS System.
 */
exports.addARecord = function(domainName, ipString) {

};

/**
 * Add a PTR Record to the DNS System.
 */
exports.addPtrRecord = function(serviceInstance, serviceDomain) {
  // unsure if this is the right signature
};
