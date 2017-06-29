/* global exports, require */
'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;

const dnsCodes = require('./dns-codes');
const dnsUtil = require('./dns-util');


/** An A Record has four bytes, all representing an IP address. */
const NUM_OCTETS_RESOURCE_DATA_A_RECORD = 4;

const NUM_OCTETS_PRIORITY = 2;
const NUM_OCTETS_WEIGHT = 2;
const NUM_OCTETS_PORT = 2;

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

class ResourceRecord {
  constructor(name, recordType, recordClass, ttl) {
    if ((typeof name) !== 'string') {
      throw new Error('name must be a String:', name);
    }
    // name is a common way to refer to the first part of the message.
    this.name = name;
    this.recordType = recordType;
    this.recordClass = recordClass;
    this.ttl = ttl;
  }

  /**
   * Get the common components of a RR as a Buffer.
   *
   * @return {Buffer}
   */
  toBuffer() {
    // Take care of the common components of a resource records as a Buffer. As
    // specified by the DNS spec and 'TCP/IP Illustrated, Volume 1' by Stevens,
    // the format is as follows:
    //
    // Variable number of octets encoding the domain name to which the RR is
    // responding
    //
    // 2 octets representing the type
    //
    // 2 octets representing the class
    //
    // 4 octets representing the TTL
    let sBuff = new SmartBuffer();

    let nameAsBuff = dnsUtil.getDomainAsBuffer(this.name);
    sBuff.writeBuffer(nameAsBuff);

    // 2 octets
    sBuff.writeUInt16BE(this.recordType);
    sBuff.writeUInt16BE(this.recordClass);
    // 4 octets
    sBuff.writeUInt32BE(this.ttl);

    return sBuff.toBuffer();
  }

  /**
   * Extract the common fields from the reader as encoded by
   * getCommonFieldsAsByteArray.
   *
   * @param {SmartBuffer} sBuff
   *
   * @return {Object} Returns an object like:
   * {
   *   name: string,
   *   recordType: number,
   *   recordClass: number,
   *   ttl: number
   * }
   */
  static fromSmartBuffer(sBuff) {
    let name = dnsUtil.getDomainFromSmartBuffer(sBuff);

    // 2 octets
    let rrType = sBuff.readUInt16BE();
    let rrClass = sBuff.readUInt16BE();
    // 4 octets
    let ttl = sBuff.readUInt32BE(); 

    let result = {
      name: name,
      recordType: rrType,
      recordClass: rrClass,
      ttl: ttl
    };

    return result;
  }
}

/**
 * An A record. A records respond to queries for a domain name to an IP
 * address.
 */
class ARecord extends ResourceRecord {
  /*
   * @param {string} domainName the domain name, e.g. www.example.com
   * @param {integer} ttl the time to live
   * @param {string} ipAddress the IP address of the domainName. This must be a
   * string (e.g. '192.3.34.17').
   * @param {integer} recordClass the class of the record type. This is optional,
   * and if not present or is not truthy will be set as IN for internet traffic.
   */
  constructor(domainName, ttl, ipAddress, recordClass) {
    if (!recordClass) {
      recordClass = dnsCodes.CLASS_CODES.IN;
    }
    super(domainName, dnsCodes.RECORD_TYPES.A, recordClass, ttl);
    this.domainName = domainName;
    this.ipAddress = ipAddress;
  }

  /**
   * Get the A Record as a Buffer.
   *
   * The DNS spec indicates that an A Record is represented in byte form as
   * follows.
   *
   * The common fields as indicated in getCommonFieldsAsBuffer.
   *
   * 2 octets representing the number 4, to indicate that 4 bytes follow.
   *
   * 4 octets representing a 4-byte IP address
   *
   * @return {Buffer}
   */
  toBuffer() {
    let sBuff = new SmartBuffer();

    let rrBuff = super.toBuffer();
    sBuff.writeBuffer(rrBuff);

    // First we add the length of the resource data.
    // 2 octets
    sBuff.writeUInt16BE(NUM_OCTETS_RESOURCE_DATA_A_RECORD);

    // Then add the IP address itself.
    let ipStringAsBuff = dnsUtil.getIpStringAsBuffer(this.ipAddress);
    sBuff.writeBuffer(ipStringAsBuff);

    return sBuff.toBuffer();
  }

  /**
   * Create an A Record from a SmartBuffer. The SmartBuffer should be at the
   * correct cursor position, at the domain name of the A Record.
   *
   * @param {SmartBuffer} sBuff
   *
   * @return {ARecord}
   */
  static fromSmartBuffer(sBuff) {
    let commonFields = ResourceRecord.fromSmartBuffer(sBuff);

    if (commonFields.recordType !== dnsCodes.RECORD_TYPES.A) {
      throw new Error(
        'De-serialized A Record does not have A Record type:',
          commonFields.rrType
      );
    }

    // And now we recover just the resource length and resource data.
    // 2 octets
    let resourceLength = sBuff.readUInt16BE();

    // For an A Record this should always be 4.
    if (resourceLength !== NUM_OCTETS_RESOURCE_DATA_A_RECORD) {
      throw new Error(
        'Recovered resource length does not match expected value for A',
          '  Record: ' +
          resourceLength
      );
    }

    let ipString = dnsUtil.getIpStringFromSmartBuffer(sBuff);

    let result = new ARecord(
      commonFields.name,
      commonFields.ttl,
      ipString,
      commonFields.recordClass
    );

    return result;
  }
}

/**
 * A PTR record. PTR records respond to a query for a service type (eg
 * '_printer._tcp.local'. They return the name of an instance offering the
 * service (eg 'Printsalot._printer._tcp.local').
 */
class PtrRecord extends ResourceRecord {
  /*
   * @param {string} serviceType the string representation of the service that
   * has been queried for.
   * @param {integer} ttl the time to live
   * @param {string} instanceName the name of the instance providing the
   * serviceType
   * @param {integer} rrClass the class of the record. If not truthy, will be
   * set to IN for internet traffic.
   */
  constructor(serviceType, ttl, instanceName, recordClass) {
    if ((typeof serviceType) !== 'string') {
      throw new Error('serviceType must be a String:', serviceType);
    }
    
    if ((typeof instanceName) !== 'string') {
      throw new Error('instanceName must be a String:', instanceName);
    }

    if (!recordClass) {
      recordClass = dnsCodes.CLASS_CODES.IN;
    }

    super(serviceType, dnsCodes.RECORD_TYPES.PTR, recordClass, ttl);
    this.serviceType = serviceType;
    this.instanceName = instanceName;
  }

  /**
   * Get the PTR Record as a Buffer.
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
   * some location in the domain name space". In the context of mDNS, this
   * would be the name of the instance that actually provides the service that
   * is being queried for.
   *
   * @return {Buffer}
   */
  toBuffer() {
    let sBuff = new SmartBuffer();

    let rrBuff = super.toBuffer();

    sBuff.writeBuffer(rrBuff);

    let instanceNameBuff = dnsUtil.getDomainAsBuffer(this.instanceName);
    let resourceDataLength = instanceNameBuff.length;

    // First we add the length of the resource data.
    // 2 octets
    sBuff.writeUInt16BE(resourceDataLength);

    // Then add the instance name itself.
    sBuff.writeBuffer(instanceNameBuff);

    return sBuff.toBuffer();
  }

  /**
   * Create a PTR Record from a SmartBuffer. The SmartBuffer should be at the
   * correct cursor position, at the service type query of the PTR Record.
   *
   * @param {SmartBuffer} sBuff
   *
   * @return {PtrRecord}
   */
  static fromSmartBuffer(sBuff) {
    let commonFields = ResourceRecord.fromSmartBuffer(sBuff);

    if (commonFields.recordType !== dnsCodes.RECORD_TYPES.PTR) {
      throw new Error(
        'De-serialized PTR Record does not have PTR Record type:',
          commonFields.recordType
      );
    }

    // And now we recover just the resource length and resource data.
    // 2 octets
    let resourceLength = sBuff.readUInt16BE();
    if (resourceLength < 0 || resourceLength > 65535) {
      throw new Error(
        'Illegal length of PTR Record resource data:',
          resourceLength);
    }

    // In a PTR Record, the domain name field of the RR is actually the service
    // type (at least for mDNS).
    let serviceType = commonFields.name;
    let serviceName = dnsUtil.getDomainFromSmartBuffer(sBuff);

    let result = new PtrRecord(
      serviceType,
      commonFields.ttl,
      serviceName,
      commonFields.recordClass
    );

    return result;
  }
}

/**
 * An SRV record. SRV records map the name of a service instance to the
 * information needed to connect to the service. 
 */
class SrvRecord extends ResourceRecord {
  /*
   * @param {string} instanceTypeDomain: the name being queried for, e.g.
   * 'PrintsALot._printer._tcp.local'
   * @param {integer} ttl: the time to live
   * @param {integer} priority: the priority of this record if multiple records
   * are found. This must be a number from 0 to 65535.
   * @param {integer} weight: the weight of the record if two records have the
   * same priority. This must be a number from 0 to 65535.
   * @param {integer} port: the port number on which to find the service. This
   * must be a number from 0 to 65535.
   * @param {string} targetDomain: the domain hosting the service (e.g.
   * 'blackhawk.local')
   */
  constructor(instanceTypeDomain, ttl, priority, weight, port, targetDomain) {
    // Note that we're not exposing rrClass as a caller-specified variable,
    // because according to the spec SRV records occur in the IN class.
    super(
      instanceTypeDomain,
      dnsCodes.RECORD_TYPES.SRV, 
      dnsCodes.CLASS_CODES.IN,
      ttl
    );

    this.instanceTypeDomain = instanceTypeDomain;
    this.priority = priority;
    this.weight = weight;
    this.port = port;
    this.targetDomain = targetDomain;
  }

  /**
   * Get the SRV Record as a Buffer object.
   *
   * According to this document (https://tools.ietf.org/html/rfc2782) and more
   * explicitly this document
   * (http://www.tahi.org/dns/packages/RFC2782_S4-1_0_0/SV/SV_RFC2782_SRV_rdata.html),
   * the layout of the SRV RR is as follows:
   *
   * The common fields as indicated in getCommonFieldsAsBuffer.
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
   *
   * @return {Buffer}
   */
  toBuffer() {
    let sBuff = new SmartBuffer();

    let rrBuff = super.toBuffer();
    sBuff.writeBuffer(rrBuff);

    let targetNameBuff = dnsUtil.getDomainAsBuffer(this.targetDomain);

    let resourceDataLength = NUM_OCTETS_PRIORITY +
      NUM_OCTETS_WEIGHT +
      NUM_OCTETS_PORT +
      targetNameBuff.length;

    // First we add the length of the resource data.
    // 2 octets
    sBuff.writeUInt16BE(resourceDataLength);

    // Then add the priority, weight, and port.
    // 2 octets
    sBuff.writeUInt16BE(this.priority);
    sBuff.writeUInt16BE(this.weight);
    sBuff.writeUInt16BE(this.port);

    sBuff.writeBuffer(targetNameBuff);

    return sBuff.toBuffer();
  }

  /**
   * Create an SRV Record from a SmartBuffer. The SmartBuffer should be at the
   * correct cursor position, at the service type query of the SRV Record.
   *
   * @param {SmartBuffer} sBuff
   *
   * @return {SrvRecord}
   */
  static fromSmartBuffer(sBuff) {
    let commonFields = ResourceRecord.fromSmartBuffer(sBuff);

    if (commonFields.recordType !== dnsCodes.RECORD_TYPES.SRV) {
      throw new Error(
        'De-serialized SRV Record does not have SRV Record type:',
          commonFields.recordType
      );
    }

    // And now we recover just the resource length and resource data.
    // 2 octets
    let resourceLength = sBuff.readUInt16BE();
    if (resourceLength < 0 || resourceLength > 65535) {
      throw new Error(
        'Illegal length of SRV Record resource data:',
          resourceLength);
    }

    // In a SRV Record, the domain name field of the RR is actually the service
    // proto name.
    let serviceInstanceName = commonFields.name;
    
    // After the common fields, we expect priority, weight, port, target name.
    // 2 octets
    let priority = sBuff.readUInt16BE();
    if (priority < 0 || priority > 65535) {
      throw new Error('Illegal length of SRV Record priority:', priority);
    }

    // 2 octets
    let weight = sBuff.readUInt16BE();
    if (weight < 0 || weight > 65535) {
      throw new Error('Illegal length of SRV Record priority:', weight);
    }

    // 2 octets
    let port = sBuff.readUInt16BE();
    if (port < 0 || port > 65535) {
      throw new Error('Illegal length of SRV Record priority:', port);
    }

    let targetName = dnsUtil.getDomainFromSmartBuffer(sBuff);

    let result = new SrvRecord(
      serviceInstanceName,
      commonFields.ttl,
      priority,
      weight,
      port,
      targetName
    );

    return result;
  }
}

/**
 * Return type of the Resource Record queued up in the reader. Peaking does not
 * affect the position of the underlying reader.
 *
 * @param {SmartBuffer} sBuff
 *
 * @return {integer}
 */
exports.peekTypeInSmartBuffer = function(sBuff) {
  // Save our current read offset to we can move it back.
  let readOffset = sBuff.readOffset;

  // Consume an encoded domain name. Note this means we're computing domain
  // names twice, which isn't optimal.
  dnsUtil.getDomainFromSmartBuffer(sBuff);
  // After the domain, the type is next.
  // 2 octets
  let result = sBuff.readUInt16BE();

  // Restore state
  sBuff.moveTo(readOffset);
  return result;
};

exports.ARecord = ARecord;
exports.PtrRecord = PtrRecord;
exports.ResourceRecord = ResourceRecord;
exports.SrvRecord = SrvRecord;
