'use strict';

var test = require('tape');
var dnsPacket = require('../../../app/scripts/dnssd/dns-packet');
var resRec = require('../../../app/scripts/dnssd/resource-record');
var qSection = require('../../../app/scripts/dnssd/question-section');
var dnsCodes = require('../../../app/scripts/dnssd/dns-codes');

/**
 * Create an ARecord for use in testing. This is the same object on every call
 * unless domain is passed.
 *
 * @param {string} domain optional domain. If absent a default will
 * be used.
 */
function getARecord(domain) {
  domain = domain || 'www.whatsup.com';
  var result = new resRec.ARecord(domain, 10, '123.123.4.5');
  return result;
}

/**
 * Create a PtrRecrord for use in testing. This is the same object on every
 * call unless instanceName is passed.
 *
 * @param {string} instanceName optional instance name. If absent a default
 * will be used.
 */
function getPtrRecord(instanceName) {
  instanceName = instanceName || 'PrintsALot';
  var result = new resRec.PtrRecord(
    '_printer._tcp.local',
    3600,
    instanceName + '._printer._tcp.local'
  );
  return result;
}

/**
 * Create a SrvRecrord for use in testing. This is the same object on every
 * call unless instanceName or domain is passed.
 *
 * @param {string} instanceName optional instance name. If absent a default
 * will be used.
 * @param {string} domain optional domain. If absent a default will be used.
 */
function getSrvRecord(instanceName, domain) {
  instanceName = instanceName || 'PrintsALot';
  domain = domain || 'blackhawk.local';
  var result = new resRec.SrvRecord(
    instanceName + '._printer.tcp.local',
    2400,
    0,
    10,
    8887,
    domain
  );
  return result;
}

/**
 * Create a DnsPacket for use in testing. This is the same object on every
 * call unless params is passed.
 *
 * @param {object} params an optional object to specify parameters to the
 * DnsPacket constructor. Defaults are used if the object is missing or if any
 * properties are on params are not defined.
 */
function getBasicDnsPacket(params) {
  params = params || {};

  var id = params.id || 8871;
  var isQuery = params.isQuery || true;
  var opCode = params.opCode || 2;
  var isAuthorativeAnswer = params.isAuthorativeAnswer || true;
  var isTruncated = params.isTruncated || true;
  var recursionDesired = params.recursionDesired || true;
  var recursionAvailable = params.recursionAvailable || false;
  var returnCode = params.returnCode || 8;

  var result = new dnsPacket.DnsPacket(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  );
  return result;
}

test('can create a DnsPacket', function(t) {
  var params = {};
  params.id = 8871;
  params.isQuery = true;
  params.opCode = 2;
  params.isAuthorativeAnswer = true;
  params.isTruncated = true;
  params.recursionDesired = true;
  params.recursionAvailable = false;
  params.returnCode = 8;

  var packet = getBasicDnsPacket(params);

  t.equal(packet.id, params.id);
  t.equal(packet.isQuery, params.isQuery);
  t.equal(packet.opCode, params.opCode);
  t.equal(packet.isAuthorativeAnswer, params.isAuthorativeAnswer);
  t.equal(packet.isTruncated, params.isTruncated);
  t.equal(packet.recursionDesired, params.recursionDesired);
  t.equal(packet.recursionAvailable, params.recursionAvailable);
  t.equal(packet.returnCode, params.returnCode);

  t.end();
});

test('creating DnsPacket with invalid ID throws', function(t) {
  var tooBig = function() {
    getBasicDnsPacket({ id: 65536});
  };
  var tooSmall = function(){ 
    getBasicDnsPacket({ id: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('creating DnsPacket with invalid opCode throws', function(t) {
  var tooBig = function() {
    getBasicDnsPacket({ opCode: 16});
  };
  var tooSmall = function(){ 
    getBasicDnsPacket({ opCode: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('creating DnsPacket with invalid returnCode throws', function(t) {
  var tooBig = function() {
    getBasicDnsPacket({ returnCode: 16});
  };
  var tooSmall = function(){ 
    getBasicDnsPacket({ returnCode: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('addQuestion throws if add something other than question', function(t) {
  var packet = getBasicDnsPacket();
  var aRec = getARecord();

  var shouldThrow = function() {
    // an ARecord is not a QuestionSection
    packet.addQuestion(aRec);
  };

  t.throws(shouldThrow, Error);
  t.end();
});

test('can serialize and deserialize DnsPacket', function(t) {
  var aRecord = getARecord();
  var ptrRecord = getPtrRecord();
  var srvRecord = getSrvRecord();

  // These questions are meaningless, we're just ensuring they are serialized
  // and deserialized correctly.
  var question1 = new qSection.QuestionSection('www.google.com', 44, 2);
  var question2 = new qSection.QuestionSection('www.google.com', 33, 2);

  var id = 8872;
  var isQuery = false;
  var opCode = 2;
  var isAuthorativeAnswer = true;
  var isTruncated = false;
  var recursionDesired = true;
  var recursionAvailable = false;
  var returnCode = 2;

  var packet = new dnsPacket.DnsPacket(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  );
  
  packet.addQuestion(question1);
  packet.addQuestion(question2);

  packet.addAnswer(aRecord);
  packet.addAnswer(ptrRecord);
  packet.addAnswer(srvRecord);

  packet.addAuthority(aRecord);
  packet.addAuthority(srvRecord);

  packet.addAdditionalInfo(srvRecord);

  var byteArr = packet.convertToByteArray();
  var reader = byteArr.getReader();

  var recovered = dnsPacket.createPacketFromReader(reader);
  t.deepEqual(recovered, packet);

  t.end();
});

/*
 * Flag test values are taken from:
 * http://www.ccs.neu.edu/home/amislove/teaching/cs4700/fall09/handouts/project1-primer.pdf
 */

test('getValueAsFlags for 0x0100', function(t) {
  // 0x0100 corresponds to all 0s except RD.
  var value = 0x0100;

  var expected = {
    qr: 0,
    aa: 0,
    opcode: 0,
    tc: 0,
    rd: 1,
    ra: 0,
    rcode: 0
  };

  var actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for 0x0100', function(t) {
  // 0x0100 corresponds to all 0s except RD.
  var expected = 0x0100;

  var actual = dnsPacket.getFlagsAsValue(0, 0, 0, 0, 1, 0, 0);

  t.equal(actual, expected);

  t.end();
});

test('getValueAsFlags for 0x9783', function(t) {
  // 9783 corresponds to every possible flag being set to a legal value.
  var value = 0x9783;

  var expected = {
    qr: 1,
    aa: 1,
    opcode: 2,
    tc: 1,
    rd: 1,
    ra: 1,
    rcode: 3
  };

  var actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for 0x9783', function(t) {
  // 9783 corresponds to every possible flag being set to a legal value.
  var expected = 0x9783;

  var actual = dnsPacket.getFlagsAsValue(1, 2, 1, 1, 1, 1, 3);

  t.equal(actual, expected);

  t.end();
});

test('getValueAsFlags for max values', function(t) {
  // 0xff8f corresponds to every possible flag bit being set to 1
  var value = 0xff8f;

  var expected = {
    qr: 1,
    aa: 1,
    opcode: 15,
    tc: 1,
    rd: 1,
    ra: 1,
    rcode: 15
  };

  var actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for max values', function(t) {
  // 0xff8f corresponds to every possible flag bit being set to 1
  var expected = 0xff8f;

  var actual = dnsPacket.getFlagsAsValue(1, 15, 1, 1, 1, 1, 15);

  t.equal(actual, expected);

  t.end();
});

test('parseResourceRecordsFromReader succeeds for single', function(t) {
  // Test that we can parse and recover a single record.
  var expected = getARecord();
  var byteArr = expected.convertToByteArray();
  var reader = byteArr.getReader();

  var actual = dnsPacket.parseResourceRecordsFromReader(reader, 1);
  t.deepEqual(actual, [expected]);
  t.end();
});

test('parseResourceRecordsFromReader succeeds for multiple', function(t) {
  var aRec1 = getARecord();
  var aRec2 = getARecord('www.howdy.ch');

  var byteArr = aRec1.convertToByteArray();
  byteArr.append(aRec2.convertToByteArray());
  var reader = byteArr.getReader();

  var actual = dnsPacket.parseResourceRecordsFromReader(reader, 2);
  t.deepEqual(actual, [aRec1, aRec2]);
  t.end();
});

test('parseResourceRecordsFromReader succeeds for all types', function(t) {
  // We are supporting deserialization of A, PTR, and SRV records.
  var aRec = getARecord();
  var srvRec = getSrvRecord();
  var ptrRec = getPtrRecord();

  var byteArr = aRec.convertToByteArray();
  byteArr.append(srvRec.convertToByteArray());
  byteArr.append(ptrRec.convertToByteArray());
  var reader = byteArr.getReader();

  var actual = dnsPacket.parseResourceRecordsFromReader(reader, 3);
  t.deepEqual(actual, [aRec, srvRec, ptrRec]);
  t.end();
});

test('parseResourceRecordsFromReader throws for unsupported type', function(t) {
  // We will pretend to be a TXT record.
  var fakeTxtRecord = getARecord();
  fakeTxtRecord.recordType = dnsCodes.RECORD_TYPES.TXT;

  var byteArr = fakeTxtRecord.convertToByteArray();
  var reader = byteArr.getReader();

  var shouldThrow = function() {
    dnsPacket.parseResourceRecordsFromReader(reader, 1);
  };

  t.throws(shouldThrow, Error);
  t.end();
});
