/* global exports, require */
'use strict';

var byteArray = require('./byte-array-sem');
var dnsUtil = require('./dns-util');

var NUM_OCTETS_TYPE = 2;
var NUM_OCTETS_CLASS = 2;
var NUM_OCTETS_TTL = 4;
var NUM_OCTETS_RESOURCE_DATA_LENGTH = 2;

/** An A Record has for bytes, all representing an IP address. */
var NUM_OCTETS_RESOURCE_DATA_A_RECORD = 4;

var NUM_OCTETS_PRIORITY = 2;
var NUM_OCTETS_WEIGHT = 2;
var NUM_OCTETS_PORT = 2;

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
 * recordClass: the class of the record type. This is optional, and if not
 *   present or is not truthy will be set as IN for internet traffic.
 */
exports.ARecord = function ARecord(
  domainName,
  ttl,
  ipAddress,
  recordClass
) {
  if (!(this instanceof ARecord)) {
    throw new Error('ARecord must be called with new');
  }

  if ((typeof ipAddress) !== 'string') {
    throw new Error('ipAddress must be a String: ' + ipAddress);
  }
  
  if (!recordClass) {
    recordClass = dnsCodes.CLASS_CODES.IN;
  }

  this.recordType = dnsCodes.RECORD_TYPES.A;
  this.recordClass = recordClass;

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
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the number 4, to indicate that 4 bytes follow.
 *
 * 4 octets representing a 4-byte IP address
 */
exports.ARecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.domainName,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  // First we add the length of the resource data.
  result.push(
    NUM_OCTETS_RESOURCE_DATA_A_RECORD, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the IP address itself.
  var ipStringAsBytes = dnsUtil.getIpStringAsByteArray(this.ipAddress);
  result.append(ipStringAsBytes);

  return result;
};

/**
 * Create an A Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the domain name of the A Record.
 */
exports.createARecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.A) {
    throw new Error(
      'De-serialized A Record does not have A Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);

  // For an A Record this should always be 4.
  if (resourceLength !== NUM_OCTETS_RESOURCE_DATA_A_RECORD) {
    throw new Error(
      'Recovered resource length does not match expected value for A ' +
        '  Record: ' +
        resourceLength
    );
  }

  var ipString = dnsUtil.getIpStringFromByteArrayReader(reader);

  var result = new exports.ARecord(
    commonFields.domainName,
    commonFields.ttl,
    ipString,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create a PTR Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the PTR Record.
 */
exports.createPtrRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.PTR) {
    throw new Error(
      'De-serialized PTR Record does not have PTR Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of PTR Record resource data: ' +
        resourceLength);
  }

  // In a PTR Record, the domain name field of the RR is actually the service
  // type (at least for mDNS).
  var serviceType = commonFields.domainName;
  var serviceName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.PtrRecord(
    serviceType,
    commonFields.ttl,
    serviceName,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create an SRV Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the SRV Record.
 */
exports.createSrvRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.SRV) {
    throw new Error(
      'De-serialized SRV Record does not have SRV Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of SRV Record resource data: ' +
        resourceLength);
  }

  // In a SRV Record, the domain name field of the RR is actually the service
  // proto name.
  var serviceInstanceName = commonFields.domainName;
  
  // After the common fields, we expect priority, weight, port, target name.
  var priority = reader.getValue(NUM_OCTETS_PRIORITY);
  if (priority < 0 || priority > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + priority);
  }

  var weight = reader.getValue(NUM_OCTETS_WEIGHT);
  if (weight < 0 || weight > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + weight);
  }

  var port = reader.getValue(NUM_OCTETS_PORT);
  if (port < 0 || port > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + port);
  }

  var targetName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.SrvRecord(
    serviceInstanceName,
    commonFields.ttl,
    priority,
    weight,
    port,
    targetName
  );

  return result;
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
 * rrClass: the class of the record. If not truthy, will be set to IN for
 *   internet traffic.
 */
exports.PtrRecord = function PtrRecord(
  serviceType,
  ttl,
  instanceName,
  rrClass
) {
  if (!(this instanceof PtrRecord)) {
    throw new Error('PtrRecord must be called with new');
  }

  if ((typeof serviceType) !== 'string') {
    throw new Error('serviceType must be a String: ' + serviceType);
  }
  
  if ((typeof instanceName) !== 'string') {
    throw new Error('instanceName must be a String: ' + instanceName);
  }

  if (!rrClass) {
    rrClass = dnsCodes.CLASS_CODES.IN;
  }
  
  this.recordType = dnsCodes.RECORD_TYPES.PTR;
  this.recordClass = rrClass;

  this.serviceType = serviceType;
  this.ttl = ttl;
  this.instanceName = instanceName;
};

/**
 * Get the PTR Record as a ByteArray object.
 *
 * The DNS spec indicates that an PTR Record is represented in byte form as
 * follows. (Using this and section 3.3.12 as a guide:
 * https://www.ietf.org/rfc/rfc1035.txt).
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * A variable number of octets representing "the domain-name, which points to
 * some location in the domain name space". In the context of mDNS, this would
 * be the name of the instance that actually provides the service that is being
 * queried for.
 */
exports.PtrRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.serviceType,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var instanceNameAsBytes = dnsUtil.getDomainAsByteArray(this.instanceName);
  var resourceDataLength = instanceNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the instance name itself.
  result.append(instanceNameAsBytes);

  return result;
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
  // Note that we're not exposing rrClass as a caller-specified variable,
  // because according to the spec SRV records occur in the IN class.
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.instanceTypeDomain = instanceTypeDomain;
  this.ttl = ttl;
  this.priority = priority;
  this.weight = weight;
  this.port = port;
  this.targetDomain = targetDomain;
};

/**
 * Get the SRV Record as a ByteArray object.
 *
 * According to this document (https://tools.ietf.org/html/rfc2782) and more
 * explicitly this document
 * (http://www.tahi.org/dns/packages/RFC2782_S4-1_0_0/SV/SV_RFC2782_SRV_rdata.html),
 * the layout of the SRV RR is as follows:
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * 2 octets indicating the priority
 *
 * 2 octets indicating the weight
 *
 * 2 octets indicating the port
 *
 * A variable number of octets encoding the target name (e.g.
 * PrintsALot.local), encoded as a domain name.
 */
exports.SrvRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.instanceTypeDomain,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var targetNameAsBytes = dnsUtil.getDomainAsByteArray(this.targetDomain);

  var resourceDataLength = NUM_OCTETS_PRIORITY +
    NUM_OCTETS_WEIGHT +
    NUM_OCTETS_PORT +
    targetNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the priority, weight, and port.
  result.push(this.priority, NUM_OCTETS_PRIORITY);
  result.push(this.weight, NUM_OCTETS_WEIGHT);
  result.push(this.port, NUM_OCTETS_PORT);

  result.append(targetNameAsBytes);

  return result;
};

/**
 * Get the common components of a RR as a ByteArray. As specified by the DNS
 * spec and 'TCP/IP Illustrated, Volume 1' by Stevens, the format is as
 * follows:
 *
 * Variable number of octets encoding the domain name to which the RR is
 *   responding.
 *
 * 2 octets representing the RR type
 *
 * 2 octets representing the RR class
 *
 * 4 octets representing the TTL
 */
exports.getCommonFieldsAsByteArray = function(
  domainName,
  rrType,
  rrClass,
  ttl
) {
  var result = new byteArray.ByteArray();

  var domainNameAsBytes = dnsUtil.getDomainAsByteArray(domainName);
  result.append(domainNameAsBytes);

  result.push(rrType, NUM_OCTETS_TYPE);
  result.push(rrClass, NUM_OCTETS_CLASS);
  result.push(ttl, NUM_OCTETS_TTL);

  return result;
};

/**
 * Extract the common fields from the reader as encoded by
 * getCommonFieldsAsByteArray.
 *
 * Returns an object with fields domainName, rrType, rrClass, and ttl.
 */
exports.getCommonFieldsFromByteArrayReader = function(reader) {
  var domainName = dnsUtil.getDomainFromByteArrayReader(reader);
  var rrType = reader.getValue(NUM_OCTETS_TYPE);
  var rrClass = reader.getValue(NUM_OCTETS_CLASS);
  var ttl = reader.getValue(NUM_OCTETS_TTL);

  var result = {
    domainName: domainName,
    rrType: rrType,
    rrClass: rrClass,
    ttl: ttl
  };

  return result;
};
