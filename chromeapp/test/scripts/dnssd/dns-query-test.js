'use strict';
var test = require('tape');
var dnsQuery = require('../../../app/scripts/dnssd/dns-query');

test('create a query', function(t) {
  var name = 'www.example.com';
  var queryType = 3;
  var queryClass = 4;
  // Corresponds to 155.33.17.68
  var ipAddress = 0x9b211144;

  var result = new dnsQuery.DnsQuery(name, queryType, queryClass);

  t.equal(result.domainName, name);
  t.equal(result.queryType, queryType);
  t.equal(result.queryClass, queryClass);

  t.end();
});
