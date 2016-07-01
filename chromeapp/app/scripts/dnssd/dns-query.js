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

var OCTETS_QUERY_TYPE = 2;
var OCTETS_QUERY_CLASS = 2;

/**
 * Creates a DNSQuery object.
 *
 * domainName: A string, like www.example.com
 * queryType: the type of record being queried for. Should be one of dnsCodes
 * queryClass: the class of the query, should be one of dnsCodes, likely IN
 */
exports.DnsQuery = function DnsQuery(domainName, queryType, queryClass) {
  if (!(this instanceof DnsQuery)) {
    throw new Error('DNSQuery function must be called with new');
  }

  this.domainName = domainName;
  this.queryType = queryType;
  this.queryClass = queryClass;

  /**
   * Serialize the query to accommodate the DNS spec. Returns a ByteArray
   * object.
   */
  this.serialize = function() {
    // The serialization is just the query name in label format, followed by a
    // 2-octet query type and a 2-octet query class.
    var result = new ByteArray(); 

    var domainAsLabel = null;

    result.append(domainAsLabel);
    result.put(this.queryType, OCTETS_QUERY_TYPE);
    result.put(this.queryClass, OCTETS_QUERY_CLASS);

    return result;
  };
};
