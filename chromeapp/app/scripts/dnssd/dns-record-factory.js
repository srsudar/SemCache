'use strict';

var DNSResourceRecord = require('./dns-resource-record');
var DNSCodes = require('./dns-codes');
// Due to the way the library was initially designed, it is nested a level
// deeper than normally expected for commonjs modules. To keep compatibility
// with the other modules, we're going to leave it as is but make it more
// readable in this module by removing a level of nesting.
DNSCodes = DNSCodes.DNSCodes;

/**
 * Creates a DNSResourceRecord representing an A record.
 *
 * domainName: the domain name being queried for, eg www.example.com
 * ipAddress: a long representing an IP address, eg 0x9b211144, or a string
 *   representation of the address, eg '155.33.17.68'.
 */
exports.createARecord = function(domainName, ipAddress) {
  // Convert to a long as necessary.
  var ipAsLong;
  if (!domainName || !ipAddress) {
    throw new Error('domainName and ipAddress must be specified');
  }

  if (ipAddress instanceof String) {
    ipAsLong = IPUtils.convertIpToLong(ipAddress);
  } else {
    ipAsLong = ipAddress;
  }
  console.log(DNSResourceRecord);

  var result = new DNSResourceRecord.DNSResourceRecord({
    name: domainName,
    recordType: DNSCodes.RECORD_TYPES.A,
    data: ipAsLong
  });

  return result;
};

