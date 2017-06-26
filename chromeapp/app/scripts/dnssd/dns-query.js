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

const byteArray = require('./byte-array');
const dnsUtil = require('./dns-util');


const OCTETS_QUERY_TYPE = 2;
const OCTETS_QUERY_CLASS = 2;

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
 * Serialize the query to accommodate the DNS spec. Returns a ByteArray
 * object.
 *
 * @return {ByteArray} 
 */
exports.DnsQuery.prototype.serialize = function() {
    // The serialization is just the query name in label format, followed by a
    // 2-octet query type and a 2-octet query class.
    let result = new byteArray.ByteArray(); 

    let domainAsLabel = dnsUtil.getDomainAsByteArray(this.domainName);

    result.append(domainAsLabel);
    result.push(this.queryType, OCTETS_QUERY_TYPE);
    result.push(this.queryClass, OCTETS_QUERY_CLASS);

    return result;
};

/**
 * Create a DnsQuery object from a byteArray as output by DnsQuery.serialize().
 *
 * @param {ByteArray} byteArr the ByteArray object from which to construct the
 * DnsQuery
 * @param {integer} startByte the offset into byteArr from which to start
 * reconstruction
 *
 * @return {DnsQuery}
 */
exports.createQueryFromByteArray = function(byteArr, startByte) {
  if (!startByte) {
    startByte = 0;
  }

  let reader = byteArr.getReader(startByte);

  let domainName = dnsUtil.getDomainFromByteArrayReader(reader);
  let queryType = reader.getValue(OCTETS_QUERY_TYPE);
  let queryClass = reader.getValue(OCTETS_QUERY_CLASS);

  let result = new exports.DnsQuery(domainName, queryType, queryClass);
  return result;
};
