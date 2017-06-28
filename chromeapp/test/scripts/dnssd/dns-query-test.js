'use strict';

const test = require('tape');

let dnsQuery = require('../../../app/scripts/dnssd/dns-query');


test('create a query', function(t) {
  let name = 'www.example.com';
  let queryType = 3;
  let queryClass = 4;

  let result = new dnsQuery.DnsQuery(name, queryType, queryClass);

  t.equal(result.domainName, name);
  t.equal(result.queryType, queryType);
  t.equal(result.queryClass, queryClass);

  t.end();
});

test('serializes and deserializes correctly', function(t) {
  let domainName = '_semcache._http.local';
  let queryType = 1;
  let queryClass = 2;

  let expected = new dnsQuery.DnsQuery(domainName, queryType, queryClass);

  let serialized = expected.serialize();

  let actual = dnsQuery.createQueryFromByteArray(serialized);

  t.deepEqual(actual, expected);
  t.end(); 
});

test('createQueryFromByteArray succeeds when startByte != 0', function(t) {
  let expected = new dnsQuery.DnsQuery('mydomain.local', 1, 2);
  let serialized = expected.asBuffer();

  // Add 5 meaningless bytes.
  let offset = 5;
  for (let i = 0; i < offset; i++) {
    byteArr.push(i, 1);
  }

  byteArr.append(serialized);

  let actual = dnsQuery.createQueryFromByteArray(byteArr, offset);
  t.deepEqual(actual, expected);
  t.end();
});
