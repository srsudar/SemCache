'use strict';
var test = require('tape');
var resRec = require('../../../app/scripts/dnssd/resource-record');
var dnsCodes = require('../../../app/scripts/dnssd/dns-codes-sem');

test('create an ARecord', function(t) {
  var domainName = 'www.example.com';
  var ttl = 10;
  var ipAddress = '155.33.17.68';
  // // Corresponds to 155.33.17.68
  // var ipAddress = 0x9b211144;
  
  var result = new resRec.ARecord(domainName, ttl, ipAddress);

  t.equal(result.domainName, domainName);
  t.equal(result.ttl, ttl);
  t.equal(result.ipAddress, ipAddress);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.A);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});

test('create a PtrRecord', function(t) {
  var serviceType = '_printer._tcp.local';
  var ttl = 10;
  var instanceName = 'PrintsALot._printer._tcp._local';
  
  var result = new resRec.PtrRecord(serviceType, ttl, instanceName);

  t.equal(result.serviceType, serviceType);
  t.equal(result.ttl, ttl);
  t.equal(result.instanceName, instanceName);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.PTR);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});

test('create an SrvRecord', function(t) {
  var serviceInstanceName = 'PrintsALot._printer._tcp.local';
  var ttl = 35;
  var priority = 0;
  var weight = 55;
  var port = 8889;
  var targetDomain = 'fisherman.local';
  
  var result = new resRec.SrvRecord(
    serviceInstanceName,
    ttl,
    priority,
    weight,
    port,
    targetDomain
  );

  t.equal(result.instanceTypeDomain, serviceInstanceName);
  t.equal(result.ttl, ttl);
  t.equal(result.priority, priority);
  t.equal(result.weight, weight);
  t.equal(result.port, port);
  t.equal(result.targetDomain, targetDomain);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.SRV);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});
