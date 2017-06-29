'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;
const test = require('tape');

const dnsCodes = require('../../../app/scripts/dnssd/dns-codes');
const resRec = require('../../../app/scripts/dnssd/resource-record');
const qSection = require('../../../app/scripts/dnssd/question-section');

let dnsPacket = require('../../../app/scripts/dnssd/dns-packet');

let DnsPacket = dnsPacket.DnsPacket;


/**
 * Create an ARecord for use in testing. This is the same object on every call
 * unless domain is passed.
 *
 * @param {string} domain optional domain. If absent a default will
 * be used.
 */
function getARecord(domain) {
  domain = domain || 'www.whatsup.com';
  let result = new resRec.ARecord(domain, 10, '123.123.4.5');
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
  let result = new resRec.PtrRecord(
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
  let result = new resRec.SrvRecord(
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
 * @param {Object} params an optional object to specify parameters to the
 * DnsPacket constructor. Defaults are used if the object is missing or if any
 * properties are on params are not defined.
 */
function getBasicDnsPacket(params) {
  params = params || {};

  let id = params.id || 8871;
  let isQuery = params.isQuery || true;
  let opCode = params.opCode || 2;
  let isAuthorativeAnswer = params.isAuthorativeAnswer || true;
  let isTruncated = params.isTruncated || true;
  let recursionDesired = params.recursionDesired || true;
  let recursionAvailable = params.recursionAvailable || false;
  let returnCode = params.returnCode || 8;

  let result = new dnsPacket.DnsPacket(
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
  let params = {};
  params.id = 8871;
  params.isQuery = true;
  params.opCode = 2;
  params.isAuthorativeAnswer = true;
  params.isTruncated = true;
  params.recursionDesired = true;
  params.recursionAvailable = false;
  params.returnCode = 8;

  let packet = getBasicDnsPacket(params);

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
  let tooBig = function() {
    getBasicDnsPacket({ id: 65536});
  };
  let tooSmall = function(){ 
    getBasicDnsPacket({ id: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('creating DnsPacket with invalid opCode throws', function(t) {
  let tooBig = function() {
    getBasicDnsPacket({ opCode: 16});
  };
  let tooSmall = function(){ 
    getBasicDnsPacket({ opCode: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('creating DnsPacket with invalid returnCode throws', function(t) {
  let tooBig = function() {
    getBasicDnsPacket({ returnCode: 16});
  };
  let tooSmall = function(){ 
    getBasicDnsPacket({ returnCode: -1 });
  };

  t.throws(tooBig, Error);
  t.throws(tooSmall, Error);
  t.end();
});

test('addQuestion throws if add something other than question', function(t) {
  let packet = getBasicDnsPacket();
  let aRec = getARecord();

  let shouldThrow = function() {
    // an ARecord is not a QuestionSection
    packet.addQuestion(aRec);
  };

  t.throws(shouldThrow, Error);
  t.end();
});

test('can serialize and deserialize DnsPacket', function(t) {
  let aRecord = getARecord();
  let ptrRecord = getPtrRecord();
  let srvRecord = getSrvRecord();

  // These questions are meaningless, we're just ensuring they are serialized
  // and deserialized correctly.
  let question1 = new qSection.QuestionSection('www.google.com', 44, 2);
  let question2 = new qSection.QuestionSection('www.google.com', 33, 2);

  let id = 8872;
  let isQuery = false;
  let opCode = 2;
  let isAuthorativeAnswer = true;
  let isTruncated = false;
  let recursionDesired = true;
  let recursionAvailable = false;
  let returnCode = 2;

  let packet = new dnsPacket.DnsPacket(
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

  let buff = packet.toBuffer();

  let actual = DnsPacket.fromBuffer(buff);
  t.deepEqual(actual, packet);

  t.end();
});

/*
 * Flag test values are taken from:
 * http://www.ccs.neu.edu/home/amislove/teaching/cs4700/fall09/handouts/project1-primer.pdf
 */

test('getValueAsFlags for 0x0100', function(t) {
  // 0x0100 corresponds to all 0s except RD.
  let value = 0x0100;

  let expected = {
    qr: 0,
    aa: 0,
    opcode: 0,
    tc: 0,
    rd: 1,
    ra: 0,
    rcode: 0
  };

  let actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for 0x0100', function(t) {
  // 0x0100 corresponds to all 0s except RD.
  let expected = 0x0100;

  let actual = dnsPacket.getFlagsAsValue(0, 0, 0, 0, 1, 0, 0);

  t.equal(actual, expected);

  t.end();
});

test('getValueAsFlags for 0x9783', function(t) {
  // 9783 corresponds to every possible flag being set to a legal value.
  let value = 0x9783;

  let expected = {
    qr: 1,
    aa: 1,
    opcode: 2,
    tc: 1,
    rd: 1,
    ra: 1,
    rcode: 3
  };

  let actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for 0x9783', function(t) {
  // 9783 corresponds to every possible flag being set to a legal value.
  let expected = 0x9783;

  let actual = dnsPacket.getFlagsAsValue(1, 2, 1, 1, 1, 1, 3);

  t.equal(actual, expected);

  t.end();
});

test('getValueAsFlags for max values', function(t) {
  // 0xff8f corresponds to every possible flag bit being set to 1
  let value = 0xff8f;

  let expected = {
    qr: 1,
    aa: 1,
    opcode: 15,
    tc: 1,
    rd: 1,
    ra: 1,
    rcode: 15
  };

  let actual = dnsPacket.getValueAsFlags(value);

  t.deepEqual(actual, expected);

  t.end();
});

test('getFlagsAsValue for max values', function(t) {
  // 0xff8f corresponds to every possible flag bit being set to 1
  let expected = 0xff8f;

  let actual = dnsPacket.getFlagsAsValue(1, 15, 1, 1, 1, 1, 15);

  t.equal(actual, expected);

  t.end();
});

test('parseRecordsFromSmartBuffer succeeds for single', function(t) {
  // Test that we can parse and recover a single record.
  let expected = getARecord();
  let buff = expected.toBuffer();
  let sBuff = SmartBuffer.fromBuffer(buff);

  let actual = dnsPacket.parseRecordsFromSmartBuffer(sBuff, 1);
  t.deepEqual(actual, [expected]);
  t.end();
});

test('parseRecordsFromSmartBuffer succeeds for multiple', function(t) {
  let aRec1 = getARecord();
  let aRec2 = getARecord('www.howdy.ch');

  let buff1 = aRec1.toBuffer();
  let buff2 = aRec2.toBuffer();
  
  let writingSmartBuffer = new SmartBuffer();
  writingSmartBuffer.writeBuffer(buff1);
  writingSmartBuffer.writeBuffer(buff2);

  let readingBuff = writingSmartBuffer.toBuffer();
  let sBuff = SmartBuffer.fromBuffer(readingBuff);

  let actual = dnsPacket.parseRecordsFromSmartBuffer(sBuff, 2);
  t.deepEqual(actual, [aRec1, aRec2]);
  t.end();
});

test('parseRecordsFromSmartBuffer succeeds for all types', function(t) {
  // We are supporting deserialization of A, PTR, and SRV records.
  let aRec = getARecord();
  let srvRec = getSrvRecord();
  let ptrRec = getPtrRecord();

  let aBuff = aRec.toBuffer();
  let srvBuff = srvRec.toBuffer();
  let ptrBuff = ptrRec.toBuffer();

  let writingSmartBuffer = new SmartBuffer();
  writingSmartBuffer.writeBuffer(aBuff);
  writingSmartBuffer.writeBuffer(srvBuff);
  writingSmartBuffer.writeBuffer(ptrBuff);

  let readingBuff = writingSmartBuffer.toBuffer();
  let sBuff = SmartBuffer.fromBuffer(readingBuff);

  let actual = dnsPacket.parseRecordsFromSmartBuffer(sBuff, 3);
  t.deepEqual(actual, [aRec, srvRec, ptrRec]);
  t.end();
});

test('parseRecordsFromSmartBuffer throws for unsupported type', function(t) {
  // We will pretend to be a TXT record.
  let fakeTxtRecord = getARecord();
  fakeTxtRecord.recordType = dnsCodes.RECORD_TYPES.TXT;

  let buff = fakeTxtRecord.toBuffer();
  let sBuff = SmartBuffer.fromBuffer(buff);

  let shouldThrow = function() {
    dnsPacket.parseRecordsFromSmartBuffer(sBuff, 1);
  };

  t.throws(shouldThrow, Error);
  t.end();
});
