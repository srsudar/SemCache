'use strict';
var test = require('tape');
var dnsQuery = require('../../../app/scripts/dnssd/dns-query');
var byteArray = require('../../../app/scripts/dnssd/byte-array');

test('create a query', function(t) {
  var name = 'www.example.com';
  var queryType = 3;
  var queryClass = 4;

  var result = new dnsQuery.DnsQuery(name, queryType, queryClass);

  t.equal(result.domainName, name);
  t.equal(result.queryType, queryType);
  t.equal(result.queryClass, queryClass);

  t.end();
});

test('serializes and deserializes correctly', function(t) {
  var domainName = '_semcache._http.local';
  var queryType = 1;
  var queryClass = 2;

  var expected = new dnsQuery.DnsQuery(domainName, queryType, queryClass);

  var serialized = expected.serialize();

  var actual = dnsQuery.createQueryFromByteArray(serialized);

  t.deepEqual(actual, expected);
  t.end(); 
});

test('createQueryFromByteArray succeeds when startByte != 0', function(t) {
  var expected = new dnsQuery.DnsQuery('mydomain.local', 1, 2);
  var serialized = expected.serialize();

  var byteArr = new byteArray.ByteArray();

  // Add 5 meaningless bytes.
  var offset = 5;
  for (var i = 0; i < offset; i++) {
    byteArr.push(i, 1);
  }

  byteArr.append(serialized);

  var actual = dnsQuery.createQueryFromByteArray(byteArr, offset);
  t.deepEqual(actual, expected);
  t.end();
});
