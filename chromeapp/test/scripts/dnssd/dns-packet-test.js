'use strict';

var test = require('tape');
var dnsPacket = require('../../../app/scripts/dnssd/dns-packet');
var resRec = require('../../../app/scripts/dnssd/resource-record');
var qSection = require('../../../app/scripts/dnssd/question-section');

test('can create a DnsPacket', function(t) {
  var id = 8871;
  var isQuery = true;
  var opCode = 2;
  var isAuthorativeAnswer = true;
  var isTruncated = true;
  var recursionDesired = true;
  var recursionAvailable = false;
  var returnCode = 8;

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

  t.equal(packet.id, id);
  t.equal(packet.isQuery, isQuery);
  t.equal(packet.opCode, opCode);
  t.equal(packet.isAuthorativeAnswer, isAuthorativeAnswer);
  t.equal(packet.isTruncated, isTruncated);
  t.equal(packet.recursionDesired, recursionDesired);
  t.equal(packet.recursionAvailable, recursionAvailable);
  t.equal(packet.returnCode, returnCode);

  t.end();
});

test('can serialize and deserialize DnsPacket', function(t) {
  var aRecord = new resRec.ARecord('www.whatsup.com', 10, '123.123.4.5');
  var ptrRecord = new resRec.PtrRecord(
    '_printer._tcp.local',
    3600,
    'Printsalot._printer._tcp.local'
  );
  var srvRecord = new resRec.SrvRecord(
    'PrintsALot._printer.tcp.local',
    2400,
    0,
    10,
    8887,
    'blackhawk.local'
  );
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
