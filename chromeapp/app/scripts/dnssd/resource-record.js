/* global exports, require */
'use strict';

/**
 * A resource record (RR) is a component of a DNS message. They share a similar
 * structure but contain different information.
 *
 * Each resource record begins with a domain name, which can be a variable
 * number of bytes.
 *
 * Then is a 2-octet type (e.g. A, SRV, etc).
 *
 * Then is a 2-octet class (e.g. IN for internet).
 *
 * Then is a 4-octet TTL.
 *
 * Then is a variable number of bytes representing the data in record. The
 * first 2-octets are the length of the following data. The structure of that
 * data depends on the type of the record.
 *
 * Information here is based on 'TCP/IP Illustrated, Volume 1' by Stevens and
 * on the Bonjour Overview page provided by Apple:
 *
 * https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/NetServices/Articles/NetServicesArchitecture.html#//apple_ref/doc/uid/20001074-SW1
 */

var dnsCodes = require('./dns-codes-sem');

/**
 * An A record. A records respond to queries for a domain name to an IP
 * address.
 *
 * domainName: the domain name, e.g. www.example.com
 * ttl: the time to live
 * ipAddress: the IP address of the domainName. This must be a string
 *   representation (e.g. '192.3.34.17').
 */
exports.ARecord = function ARecord(domainName, ttl, ipAddress) {
  if (!(this instanceof ARecord)) {
    throw new Error('ARecord must be called with new');
  }

  if ((typeof ipAddress) !== 'string') {
    throw new Error('ipAddress must be a String: ' + ipAddress);
  }
  this.recordType = dnsCodes.RECORD_TYPES.A;
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.domainName = domainName;
  this.ttl = ttl;
  this.ipAddress = ipAddress;
};

/**
 * Get the A Record as a ByteArray object.
 *
 * The DNS spec indicates that an A Record is represented in byte form as
 * follows.
 *
 *
 */
exports.ARecord.prototype.convertToByteArray = function() {
  throw new Error('unimplemented');
};

/**
 * A PTR record. PTR records respond to a query for a service type (eg
 * '_printer._tcp.local'. They return the name of an instance offering the
 * service (eg 'Printsalot._printer._tcp.local').
 *
 * serviceType: the string representation of the service that has been queried
 *   for.
 * ttl: the time to live
 * instanceName: the name of the instance providing the serviceType
 */
exports.PtrRecord = function PtrRecord(serviceType, ttl, instanceName) {
  if (!(this instanceof PtrRecord)) {
    throw new Error('PtrRecord must be called with new');
  }
  this.recordType = dnsCodes.RECORD_TYPES.PTR;
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.serviceType = serviceType;
  this.ttl = ttl;
  this.instanceName = instanceName;
};

/**
 * An SRV record. SRV records map the name of a service instance to the
 * information needed to connect to the service. 
 *
 * instanceTypeDomain: the name being queried for, e.g.
 *   'PrintsALot._printer._tcp.local'
 * ttl: the time to live
 * priority: the priority of this record if multiple records are found. This
 *   must be a number from 0 to 65535.
 * weight: the weight of the record if two records have the same priority. This
 *   must be a number from 0 to 65535.
 * port: the port number on which to find the service. This must be a number
 *   from 0 to 65535.
 * targetDomain: the domain hosting the service (e.g. 'blackhawk.local')
 */
exports.SrvRecord = function SrvRecord(
  instanceTypeDomain,
  ttl,
  priority,
  weight,
  port,
  targetDomain
) {
  if (!(this instanceof SrvRecord)) {
    throw new Error('SrvRecord must be called with new');
  }
  this.recordType = dnsCodes.RECORD_TYPES.SRV;
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.instanceTypeDomain = instanceTypeDomain;
  this.ttl = ttl;
  this.priority = priority;
  this.weight = weight;
  this.port = port;
  this.targetDomain = targetDomain;
};
