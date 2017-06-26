'use strict';

const test = require('tape');

const byteArray = require('../../../app/scripts/dnssd/byte-array');
const dnsCodes = require('../../../app/scripts/dnssd/dns-codes');

let resRec = require('../../../app/scripts/dnssd/resource-record');


test('create an ARecord', function(t) {
  let domainName = 'www.example.com';
  let ttl = 10;
  let ipAddress = '155.33.17.68';
  
  let result = new resRec.ARecord(domainName, ttl, ipAddress);

  t.equal(result.domainName, domainName);
  t.equal(result.name, domainName);
  t.equal(result.ttl, ttl);
  t.equal(result.ipAddress, ipAddress);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.A);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});

test('create a PtrRecord', function(t) {
  let serviceType = '_printer._tcp.local';
  let ttl = 10;
  let instanceName = 'PrintsALot._printer._tcp._local';
  
  let result = new resRec.PtrRecord(serviceType, ttl, instanceName);

  t.equal(result.serviceType, serviceType);
  t.equal(result.name, serviceType);
  t.equal(result.ttl, ttl);
  t.equal(result.instanceName, instanceName);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.PTR);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});

test('create an SrvRecord', function(t) {
  let serviceInstanceName = 'PrintsALot._printer._tcp.local';
  let ttl = 35;
  let priority = 0;
  let weight = 55;
  let port = 8889;
  let targetDomain = 'fisherman.local';
  
  let result = new resRec.SrvRecord(
    serviceInstanceName,
    ttl,
    priority,
    weight,
    port,
    targetDomain
  );

  t.equal(result.instanceTypeDomain, serviceInstanceName);
  t.equal(result.name, serviceInstanceName);
  t.equal(result.ttl, ttl);
  t.equal(result.priority, priority);
  t.equal(result.weight, weight);
  t.equal(result.port, port);
  t.equal(result.targetDomain, targetDomain);
  t.equal(result.recordType, dnsCodes.RECORD_TYPES.SRV);
  t.equal(result.recordClass, dnsCodes.CLASS_CODES.IN);

  t.end();
});

test('can encode and decode common RR fields', function(t) {
  let domainName = 'hello.there.com';
  let rrType = 3;
  let rrClass = 4;
  let ttl = 36000;

  let byteArr = resRec.getCommonFieldsAsByteArray(
    domainName,
    rrType,
    rrClass,
    ttl
  );

  let recovered = resRec.getCommonFieldsFromByteArrayReader(
    byteArr.getReader()
  );

  t.equal(recovered.domainName, domainName);
  t.equal(recovered.rrType, rrType);
  t.equal(recovered.rrClass, rrClass);
  t.equal(recovered.ttl, ttl);

  t.end();
});

test('can encode and decode A Record', function(t) {
  let domainName = 'happy.days.org';
  let ipAddress = '193.198.2.51';
  let rrClass = 4;
  let ttl = 123456;

  let aRecord = new resRec.ARecord(domainName, ttl, ipAddress, rrClass);

  let byteArr = aRecord.convertToByteArray();

  let recovered = resRec.createARecordFromReader(byteArr.getReader());

  t.deepEqual(recovered, aRecord);

  t.end();
});

test('can encode and decode PTR Record', function(t) {
  let serviceType = '_printer._tcp.local';
  let instanceName = 'PrintsALot._printer._tcp.local';
  let rrClass = 3;
  let ttl = 1000;

  let ptrRecord = new resRec.PtrRecord(
    serviceType,
    ttl,
    instanceName,
    rrClass
  );

  let byteArr = ptrRecord.convertToByteArray();

  let recovered = resRec.createPtrRecordFromReader(byteArr.getReader());

  t.deepEqual(recovered, ptrRecord);

  t.end();
});

test('can encode and decode SRV Record', function(t) {
  let instanceName = 'PrintsALot._printer._tcp.local';
  let targetDomain = 'blackhawk.local';
  let ttl = 2000;
  let priority = 10;
  let weight = 60;
  let port = 8888;

  let srvRecord = new resRec.SrvRecord(
    instanceName,
    ttl,
    priority,
    weight,
    port,
    targetDomain
  );

  let byteArr = srvRecord.convertToByteArray();

  let recovered = resRec.createSrvRecordFromReader(byteArr.getReader());

  t.deepEqual(recovered, srvRecord);

  t.end();
});

test('peek type in reader correct', function(t) {
  // We will create two aRecords and focus on peeking the type of the second
  // one, ensuring that the cursor position in the reader isn't mutated.
  let domainName = 'www.example.com';
  let ttl = 10;
  let ipAddress = '155.33.17.68';
  let domainName2 = 'www.fancy.com';
  
  let aRecord1 = new resRec.ARecord(domainName, ttl, ipAddress);
  let aRecord2 = new resRec.ARecord(domainName2, ttl, ipAddress);

  let byteArr1 = aRecord1.convertToByteArray();
  let byteArr2 = aRecord2.convertToByteArray();

  let byteArr = new byteArray.ByteArray();

  byteArr.append(byteArr1);
  byteArr.append(byteArr2);
  let reader = byteArr.getReader();

  let recovered1 = resRec.createARecordFromReader(reader);
  t.deepEqual(recovered1, aRecord1);

  let expected = dnsCodes.RECORD_TYPES.A;
  let actual = resRec.peekTypeInReader(reader);
  t.equal(actual, expected);

  // And make sure we didn't change the position of the reader.
  let recovered2 = resRec.createARecordFromReader(reader);
  t.deepEqual(recovered2, aRecord2);

  t.end();
});
