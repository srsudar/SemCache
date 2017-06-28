'use strict';

/**
 * Implements the query portion of a DNS message.
 *
 * As defined in "TCP/IP Illustrated, Volume 1, The Protocols" by Stevens, the
 * query portion is defined as:
 * | the query name, of indeterminate and self-specifying length |
 * | the 2-octet query type |
 * | the 2-octet query class
 */

const SmartBuffer = require('smart-buffer').SmartBuffer;

const dnsUtil = require('./dns-util');


/**
 * Creates a DNSQuery object.
 *
 * @param {string} domainName A string, like www.example.com
 * @param {integer} queryType the type of record being queried for. Should be
 * one of dnsCodes
 * @param {integer} queryClass the class of the query, should be one of the
 * dnsCodes, likely IN
 */
exports.DnsQuery = function DnsQuery(domainName, queryType, queryClass) {
  if (!(this instanceof DnsQuery)) {
    throw new Error('DNSQuery function must be called with new');
  }

  this.domainName = domainName;
  this.queryType = queryType;
  this.queryClass = queryClass;
};

/**
 * Serialize the query to accommodate the DNS spec. Returns a Buffer object.
 *
 * @return {Buffer} 
 */
exports.DnsQuery.prototype.asBuffer = function() {
  // The serialization is just the query name in label format, followed by a
  // 2-octet query type and a 2-octet query class.

  let domainAsLabel = dnsUtil.getDomainAsBuffer(this.domainName);

  let sBuff = new SmartBuffer();

  sBuff.writeBuffer(domainAsLabel);

  // 2 octets
  sBuff.writeUInt16BE(this.queryType);
  sBuff.writeUInt16BE(this.queryClass);

  return sBuff.toBuffer();
};

/**
 * Create a DnsQuery object from a byteArray as output by DnsQuery.asBuffer().
 *
 * @param {Buffer} buff the Buffer object from which to construct the DnsQuery
 * @param {integer} startByte the offset into byteArr from which to start
 * reconstruction
 *
 * @return {DnsQuery}
 */
exports.createQueryFromBuffer = function(buff, startByte) {
  if (!startByte) {
    startByte = 0;
  }

  let sBuff = SmartBuffer.from(buff.slice(startByte));

  let domainName = dnsUtil.getDomainFromSmartBuffer(sBuff);

  // 2 octets
  let queryType = sBuff.readUInt16BE();
  let queryClass = sBuff.readUInt16BE();

  let result = new exports.DnsQuery(domainName, queryType, queryClass);
  return result;
};
