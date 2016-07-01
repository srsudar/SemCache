var test = require('tape');
var recordFactory = require('../../../app/scripts/dnssd/dns-record-factory');
var DNSResourceRecord = require(
  '../../../app/scripts/dnssd/dns-resource-record'
);
var DNSCodes = require('../../../app/scripts/dnssd/dns-codes');

test('test this', function(t) {
  t.doesNotThrow(function() {
    console.log('hello');
  });
  t.end();
});


test('serialize and deserialize A record', function(t) {
  var name = 'www.example.com';
  // Corresponds to 155.33.17.68
  var ipAddress = 0x9b211144;
  // An A record has only a 4-byte IP address in the response.
  // var aRecord = recordFactory.createARecord(name, ipAddress);

  var srv = new DNSResourceRecord({
    name: 'hello',
    recordType: DNSCodes.DNSCodes.RECORD_TYPES.SRV,
    data: 'foobar' 
  });
});
