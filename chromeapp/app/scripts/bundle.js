require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*jshint esnext:true, bitwise: false */
'use strict';

/*
 * https://github.com/justindarc/dns-sd.js
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Justin D'Arcangelo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */


/**
 * ByteArray is an object that makes writing objects to an array of bytes more
 * straightforward. Obtaining values from the ByteArray is accomplished by the
 * ByteArrayReader. A single ByteArray can generate numerous ByteArrayReader
 * objects.
 *
 * The ByteArray class is adopted slightly from an object of the same name by
 * Justin D'Arcangelo. His original license and information is preserved above.
 */

var BinaryUtils = require('./binary-utils');

var DEFAULT_SIZE = 512;

/**
 *  Bit   1-Byte    2-Bytes     3-Bytes     4-Bytes
 *  -----------------------------------------------
 *    0        1        256       65536    16777216
 *    1        2        512      131072    33554432
 *    2        4       1024      262144    67108864
 *    3        8       2048      524288   134217728
 *    4       16       4096     1048576   268435456
 *    5       32       8192     2097152   536870912
 *    6       64      16384     4194304  1073741824
 *    7      128      32768     8388608  2147483648
 *  -----------------------------------------------
 *  Offset     0        255       65535    16777215
 *  Total    255      65535    16777215  4294967295
 */
function valueToUint8Array(value, length) {
  var arrayBuffer = new ArrayBuffer(length);
  var uint8Array = new Uint8Array(arrayBuffer);
  for (var i = length - 1; i >= 0; i--) {
    uint8Array[i] = value & 0xff;
    value = value >> 8;
  }

  return uint8Array;
}

function uint8ArrayToValue(uint8Array) {
  var length = uint8Array.length;
  if (length === 0) {
    return null;
  }

  var value = 0;
  for (var i = 0; i < length; i++) {
    value = value << 8;
    value += uint8Array[i];
  }

  return value;
}

/**
 * Create a new ByteArray. 
 *
 * maxBytesOrData can be an integer indicating the starting number of maximum
 * bytes, or it can be a ByteArray object to serve as the starting point. If
 * maxBytesOrData is not present, the ByteArray will be created with an initial
 * size of 256.
 */
exports.ByteArray = function ByteArray(maxBytesOrData) {
  if (!(this instanceof ByteArray)) {
    throw new Error('ByteArray must be called with new');
  }

  if (maxBytesOrData instanceof ByteArray) {
    maxBytesOrData = maxBytesOrData.buffer;
  }

  if (maxBytesOrData instanceof Uint8Array ||
      maxBytesOrData instanceof ArrayBuffer) {
    this._data = new Uint8Array(maxBytesOrData);
    this._buffer = this._data.buffer;
    this._cursor = this._data.length;
    return this;
  }

  this._buffer = new ArrayBuffer(maxBytesOrData || DEFAULT_SIZE);
  this._data = new Uint8Array(this._buffer);
  this._cursor = 0;


};

exports.ByteArray.prototype.constructor = exports.ByteArray;

Object.defineProperty(exports.ByteArray.prototype, 'length', {
  get: function() {
    return this._cursor;
  }
});

Object.defineProperty(exports.ByteArray.prototype, 'buffer', {
  get: function() {
    return this._buffer.slice(0, this._cursor);
  }
});

exports.ByteArray.prototype.push = function(value, length) {
  length = length || 1;

  this.append(valueToUint8Array(value, length));
};

exports.ByteArray.prototype.append = function(data) {
  // Get `data` as a `Uint8Array`
  if (data instanceof exports.ByteArray) {
    data = data.buffer;
  }

  if (data instanceof ArrayBuffer) {
    data = new Uint8Array(data);
  }

  for (var i = 0, length = data.length; i < length; i++) {
    this._data[this._cursor] = data[i];
    this._cursor++;
  }
};

exports.ByteArray.prototype.getReader = function(startByte) {
  return new exports.ByteArrayReader(this, startByte);
};

exports.ByteArrayReader = function ByteArrayReader(byteArray, startByte) {
  this.byteArray = byteArray;
  this.cursor = startByte || 0;
};

exports.ByteArrayReader.prototype.constructor = exports.ByteArrayReader;

Object.defineProperty(exports.ByteArrayReader.prototype, 'eof', {
  get: function() {
    return this.cursor >= this.byteArray.length;
  }
});

exports.ByteArrayReader.prototype.getBytes = function(length) {
  if (length === null || length === 0) {
    return new Uint8Array();
  }

  length = length || 1;

  var end = this.cursor + length;
  if (end > this.byteArray.length) {
    return new Uint8Array();
  }

  var uint8Array = new Uint8Array(this.byteArray._buffer.slice(this.cursor, end));
  this.cursor += length;

  return new exports.ByteArray(uint8Array);
};

exports.ByteArrayReader.prototype.getString = function(length) {
  var byteArray = this.getBytes(length);
  if (byteArray.length === 0) {
    return '';
  }

  return BinaryUtils.arrayBufferToString(byteArray.buffer);
};

exports.ByteArrayReader.prototype.getValue = function(length) {
  var byteArray = this.getBytes(length);
  if (byteArray.length === 0) {
    return null;
  }

  return uint8ArrayToValue(new Uint8Array(byteArray.buffer));
};

/**
 * Get the ByteArray object as a Uint8Array. This is truncated to the correct
 * size. The ByteArray might be a larger size than necessary, but the
 * Uint8Array is truncated to just the size that is actually used by the
 * ByteArray.
 */
exports.getByteArrayAsUint8Array = function(byteArr) {
  return new Uint8Array(byteArr._buffer, 0, byteArr._cursor);
};

},{"./binary-utils":"binaryUtils"}],2:[function(require,module,exports){
/*jshint esnext:true*/
/*
 * https://github.com/justindarc/dns-sd.js
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Justin D'Arcangelo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

'use strict';

exports.QUERY_RESPONSE_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  RESPONSE    : 1       // RFC 1035 - Reponse
});

exports.OPERATION_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  IQUERY      : 1,      // RFC 1035 - Inverse Query
  STATUS      : 2,      // RFC 1035 - Status
  NOTIFY      : 4,      // RFC 1996 - Notify
  UPDATE      : 5       // RFC 2136 - Update
});

exports.AUTHORITATIVE_ANSWER_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Authoritative
  YES         : 1       // RFC 1035 - Is Authoritative
});

exports.TRUNCATED_RESPONSE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Truncated
  YES         : 1       // RFC 1035 - Is Truncated
});

exports.RECURSION_DESIRED_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursion Not Desired
  YES         : 1       // RFC 1035 - Recursion Is Desired
});

exports.RECURSION_AVAILABLE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursive Query Support Not Available
  YES         : 1       // RFC 1035 - Recursive Query Support Is Available
});

exports.AUTHENTIC_DATA_CODES = defineType({
  NO          : 0,      // RFC 4035 - Response Has Not Been Authenticated/Verified
  YES         : 1       // RFC 4035 - Response Has Been Authenticated/Verified
});

exports.CHECKING_DISABLED_CODES = defineType({
  NO          : 0,      // RFC 4035 - Authentication/Verification Checking Not Disabled
  YES         : 1       // RFC 4035 - Authentication/Verification Checking Is Disabled
});

exports.RETURN_CODES = defineType({
  NOERROR     : 0,      // RFC 1035 - No Error
  FORMERR     : 1,      // RFC 1035 - Format Error
  SERVFAIL    : 2,      // RFC 1035 - Server Failure
  NXDOMAIN    : 3,      // RFC 1035 - Non-Existent Domain
  NOTIMP      : 4,      // RFC 1035 - Not Implemented
  REFUSED     : 5,      // RFC 1035 - Query Refused
  YXDOMAIN    : 6,      // RFC 2136 - Name Exists when it should not
  YXRRSET     : 7,      // RFC 2136 - RR Set Exists when it should not
  NXRRSET     : 8,      // RFC 2136 - RR Set that should exist does not
  NOTAUTH     : 9,      // RFC 2136 - Server Not Authoritative for zone
  NOTZONE     : 10      // RFC 2136 - NotZone Name not contained in zone
});

exports.CLASS_CODES = defineType({
  IN          : 1,      // RFC 1035 - Internet
  CS          : 2,      // RFC 1035 - CSNET
  CH          : 3,      // RFC 1035 - CHAOS
  HS          : 4,      // RFC 1035 - Hesiod
  NONE        : 254,    // RFC 2136 - None
  ANY         : 255     // RFC 1035 - Any
});

exports.OPTION_CODES = defineType({
  LLQ         : 1,      // RFC ???? - Long-Lived Queries
  UL          : 2,      // RFC ???? - Update Leases
  NSID        : 3,      // RFC ???? - Name Server Identifier
  OWNER       : 4,      // RFC ???? - Owner
  UNKNOWN     : 65535   // RFC ???? - Token
});

exports.RECORD_TYPES = defineType({
  SIGZERO     : 0,      // RFC 2931
  A           : 1,      // RFC 1035
  NS          : 2,      // RFC 1035
  MD          : 3,      // RFC 1035
  MF          : 4,      // RFC 1035
  CNAME       : 5,      // RFC 1035
  SOA         : 6,      // RFC 1035
  MB          : 7,      // RFC 1035
  MG          : 8,      // RFC 1035
  MR          : 9,      // RFC 1035
  NULL        : 10,     // RFC 1035
  WKS         : 11,     // RFC 1035
  PTR         : 12,     // RFC 1035
  HINFO       : 13,     // RFC 1035
  MINFO       : 14,     // RFC 1035
  MX          : 15,     // RFC 1035
  TXT         : 16,     // RFC 1035
  RP          : 17,     // RFC 1183
  AFSDB       : 18,     // RFC 1183
  X25         : 19,     // RFC 1183
  ISDN        : 20,     // RFC 1183
  RT          : 21,     // RFC 1183
  NSAP        : 22,     // RFC 1706
  NSAP_PTR    : 23,     // RFC 1348
  SIG         : 24,     // RFC 2535
  KEY         : 25,     // RFC 2535
  PX          : 26,     // RFC 2163
  GPOS        : 27,     // RFC 1712
  AAAA        : 28,     // RFC 1886
  LOC         : 29,     // RFC 1876
  NXT         : 30,     // RFC 2535
  EID         : 31,     // RFC ????
  NIMLOC      : 32,     // RFC ????
  SRV         : 33,     // RFC 2052
  ATMA        : 34,     // RFC ????
  NAPTR       : 35,     // RFC 2168
  KX          : 36,     // RFC 2230
  CERT        : 37,     // RFC 2538
  DNAME       : 39,     // RFC 2672
  OPT         : 41,     // RFC 2671
  APL         : 42,     // RFC 3123
  DS          : 43,     // RFC 4034
  SSHFP       : 44,     // RFC 4255
  IPSECKEY    : 45,     // RFC 4025
  RRSIG       : 46,     // RFC 4034
  NSEC        : 47,     // RFC 4034
  DNSKEY      : 48,     // RFC 4034
  DHCID       : 49,     // RFC 4701
  NSEC3       : 50,     // RFC ????
  NSEC3PARAM  : 51,     // RFC ????
  HIP         : 55,     // RFC 5205
  SPF         : 99,     // RFC 4408
  UINFO       : 100,    // RFC ????
  UID         : 101,    // RFC ????
  GID         : 102,    // RFC ????
  UNSPEC      : 103,    // RFC ????
  TKEY        : 249,    // RFC 2930
  TSIG        : 250,    // RFC 2931
  IXFR        : 251,    // RFC 1995
  AXFR        : 252,    // RFC 1035
  MAILB       : 253,    // RFC 1035
  MAILA       : 254,    // RFC 1035
  ANY         : 255,    // RFC 1035
  DLV         : 32769   // RFC 4431
});

function defineType(values) {
  function T(value) {
    for (var name in T) {
      if (T[name] === value) {
        return name;
      }
    }

    return null;
  }

  for (var name in values) {
    T[name] = values[name];
  }

  return T;
}

},{}],3:[function(require,module,exports){
/*jshint esnext:true, bitwise:false */

/**
 * Represents a DNS packet.
 *
 * The structure of the packet is based on the information in 'TCP/IP
 * Illustrated, Volume 1: The Protocols' by Stevens.
 */
'use strict';

var resRec = require('./resource-record');
var dnsCodes = require('./dns-codes');
var byteArray = require('./byte-array');
var qSection = require('./question-section');

var MAX_ID = 65535;
var MAX_OPCODE = 15;
var MAX_RETURN_CODE = 15;

var NUM_OCTETS_ID = 2;
var NUM_OCTETS_FLAGS = 2;
var NUM_OCTETS_SECTION_LENGTHS = 2;

/**
 * Parse numRecords Resource Records from a ByteArrayReader object. Returns an
 * array of resource record objects.
 *
 * @param {ByteArrayReader} reader the reader from which to construct resource
 * records. reader should have been moved to the correct cursor position
 * @param {integer} numRecords the number of records to parse
 *
 * @return {Array<resource record>} an Array of the parsed resource records
 */
function parseResourceRecordsFromReader(reader, numRecords) {
  var result = [];
  for (var i = 0; i < numRecords; i++) {
    var recordType = resRec.peekTypeInReader(reader);

    var record = null;
    switch (recordType) {
      case dnsCodes.RECORD_TYPES.A:
        record = resRec.createARecordFromReader(reader);
        break;
      case dnsCodes.RECORD_TYPES.PTR:
        record = resRec.createPtrRecordFromReader(reader);
        break;
      case dnsCodes.RECORD_TYPES.SRV:
        record = resRec.createSrvRecordFromReader(reader);
        break;
      default:
        throw new Error('Unsupported record type: ' + recordType);
    }

    result.push(record);
  }

  return result;
}

/**
 * Create a DNS packet. This creates the packet with various flag values. The
 * packet is not converted to byte format until a call is made to
 * getAsByteArray().
 *
 * @param {integer} id a 2-octet identifier for the packet
 * @param {boolean} isQuery true if packet is a query, false if it is a
 * response
 * @param {integer} opCode a 4-bit field. 0 is a standard query
 * @param {boolea} isAuthoritativeAnswer true if the response is authoritative
 * for the domain in the question section
 * @param {boolean} isTruncated true if the reply is truncated
 * @param {boolean} recursionIsDesired true if recursion is desired
 * @param {boolean} recursionAvailable true or recursion is available
 * @param {integer} returnCode a 4-bit field. 0 is no error and 3 is a name
 * error. Name errors are returned only from the authoritative name server and
 * means the domain name specified does not exist
 */
exports.DnsPacket = function DnsPacket(
  id,
  isQuery,
  opCode,
  isAuthorativeAnswer,
  isTruncated,
  recursionDesired,
  recursionAvailable,
  returnCode
) {
  if (!(this instanceof DnsPacket)) {
    throw new Error('DnsPacket must be called with new');
  }

  // The ID must fit in two bytes.
  if (id < 0 || id > MAX_ID) {
    throw new Error('DNS Packet ID is < 0 or > ' + MAX_ID +': ' + id);
  }
  this.id = id;

  this.isQuery = isQuery ? true : false;

  if (opCode < 0 || opCode > MAX_OPCODE) {
    throw new Error(
      'DNS Packet opCode is < 0 or > ' +
        MAX_OPCODE +
        ': ' +
        opCode
    );
  }
  this.opCode = opCode;

  this.isAuthorativeAnswer = isAuthorativeAnswer ? true : false;
  this.isTruncated = isTruncated ? true : false;
  this.recursionDesired = recursionDesired ? true : false;
  this.recursionAvailable = recursionAvailable ? true : false;

  if (returnCode < 0 || returnCode > MAX_RETURN_CODE) {
    throw new Error('DNS Packet returnCode is < 0 or > ' +
      MAX_RETURN_CODE +
      ': ' +
      returnCode
    );
  }
  this.returnCode = returnCode;

  this.questions = [];
  this.answers = [];
  this.authority = [];
  this.additionalInfo = [];
};

/**
 * Convert the DnsPacket to a ByteArray object. The format of a DNS Packet is
 * as specified in 'TCP/IP Illustrated, Volume 1' by Stevens, as follows:
 *
 * 2 octet ID
 *
 * 2 octet flags (see dns-util)
 *
 * 2 octet number of question sections
 *
 * 2 octet number of answer Resource Records (RRs)
 *
 * 2 octet number of authority RRs
 *
 * 2 octet number of additional info RRs
 *
 * Variable number of bytes representing the questions
 *
 * Variable number of bytes representing the answers
 *
 * Variable number of bytes representing authorities
 *
 * Variable number of bytes representing additional info
 */
exports.DnsPacket.prototype.convertToByteArray = function() {
  var result = new byteArray.ByteArray();

  result.push(this.id, NUM_OCTETS_ID);

  // Prepare flags to be passed to getFlagsAsValue
  var qr = this.isQuery ? 0 : 1;  // 0 means query, 1 means response
  var opcode = this.opCode;
  var aa = this.isAuthorativeAnswer ? 1 : 0;
  var tc = this.isTruncated ? 1 : 0;
  var rd = this.recursionDesired ? 1 : 0;
  var ra = this.recursionAvailable ? 1 : 0;
  var rcode = this.returnCode;

  var flagValue = exports.getFlagsAsValue(qr, opcode, aa, tc, rd, ra, rcode);
  result.push(flagValue, NUM_OCTETS_FLAGS);

  result.push(this.questions.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.answers.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.authority.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.additionalInfo.length, NUM_OCTETS_SECTION_LENGTHS);

  // We should have now met the requirement of adding 12 bytes to a DNS header.
  if (result.length !== 12) {
    throw new Error(
      'Problem serializing DNS packet. Header length != 12 bytes'
    );
  }

  this.questions.forEach(question => {
    var byteArr = question.convertToByteArray();
    result.append(byteArr);
  });

  this.answers.forEach(answer => {
    var byteArr = answer.convertToByteArray();
    result.append(byteArr);
  });

  this.authority.forEach(authority => {
    var byteArr = authority.convertToByteArray();
    result.append(byteArr);
  });

  this.additionalInfo.forEach(info => {
    var byteArr = info.convertToByteArray();
    result.append(byteArr);
  });

  return result;
};

/**
 * Create a DNS Packet from a ByteArrayReader object. The contents of the
 * reader are as expected to be output from convertToByteArray().
 *
 * @param {ByteArrayReader} reader the reader from which to construct the
 * DnsPacket. Should be moved to the correct cursor position
 *
 * @return {DnsPacket} the packet constructed
 */
exports.createPacketFromReader = function(reader) {
  var id = reader.getValue(NUM_OCTETS_ID);
  var flagsAsValue = reader.getValue(NUM_OCTETS_FLAGS);
  var numQuestions = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAnswers = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAuthority = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAdditionalInfo = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);

  var flags = exports.getValueAsFlags(flagsAsValue);

  var opCode = flags.opcode;
  var returnCode = flags.rcode;

  // 0 means it is a query, 1 means it is a response.
  var isQuery;
  if (flags.qr === 0) {
    isQuery = true;
  } else {
    isQuery = false;
  }

  // The non-QR flags map more readily to 0/1 = false/true, so we will use
  // ternary operators.
  var isAuthorativeAnswer = flags.aa ? true : false;
  var isTruncated = flags.tc ? true : false;
  var recursionDesired = flags.rd ? true : false;
  var recursionAvailable = flags.ra ? true : false;

  var result = new exports.DnsPacket(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  );

  for (var i = 0; i < numQuestions; i++) {
    var question = qSection.createQuestionFromReader(reader);
    result.addQuestion(question);
  }

  var answers = parseResourceRecordsFromReader(reader, numAnswers);
  var authorities = parseResourceRecordsFromReader(reader, numAuthority);
  var infos = parseResourceRecordsFromReader(reader, numAdditionalInfo);

  answers.forEach(answer => {
    result.addAnswer(answer);
  });
  authorities.forEach(authority => {
    result.addAuthority(authority);
  });
  infos.forEach(info => {
    result.addAdditionalInfo(info);
  });

  return result;
};

/**
 * Add a question resource to the DNS Packet.
 *
 * @param {QuestionSection} question the question to add to this packet 
 */
exports.DnsPacket.prototype.addQuestion = function(question) {
  if (!(question instanceof qSection.QuestionSection)) {
    throw new Error('question must be a QuestionSection but was: ' + question);
  }
  this.questions.push(question);
};

/**
 * Add a Resource Record to the answer section.
 *
 * @param {resource record} resourceRecord the record to add to the answer
 * section
 */
exports.DnsPacket.prototype.addAnswer = function(resourceRecord) {
  this.answers.push(resourceRecord);
};

/**
 * Add a Resource Record to the authority section.
 *
 * @param {resource record} resourceRecord the record to add to the authority
 * section
 */
exports.DnsPacket.prototype.addAuthority = function(resourceRecord) {
  this.authority.push(resourceRecord);
};

/**
 * Add a Resource Record to the additional info section.
 *
 * @param {resource record} resourceRecord the record to add to the additional
 * info section
 */
exports.DnsPacket.prototype.addAdditionalInfo = function(resourceRecord) {
  this.additionalInfo.push(resourceRecord);
};

/**
 * Convert the given value (in 16 bits) to an object containing the DNS header
 * flags. The returned object will have the following properties: qr, opcdoe,
 * aa, tc, rd, ra, rcode.
 *
 * @param {integer} value a number those lowest order 16 bits will be parsed to
 * an object representing packet flags
 *
 * @return {object} a flag object like the following:
 * {
 *   qr: integer,
 *   opcode: integer,
 *   aa: integer,
 *   tc: integer,
 *   rd: integer,
 *   ra: integer,
 *   rcode integer
 * }
 */
exports.getValueAsFlags = function(value) {
  var qr = (value & 0x8000) >> 15;
  var opcode = (value & 0x7800) >> 11;
  var aa = (value & 0x0400) >> 10;
  var tc = (value & 0x0200) >> 9;
  var rd = (value & 0x0100) >> 8;
  var ra = (value & 0x0080) >> 7;
  var rcode = (value & 0x000f) >> 0;

  return {
    qr: qr,
    opcode: opcode,
    aa: aa,
    tc: tc,
    rd: rd,
    ra: ra,
    rcode: rcode
  };
};

/**
 * Convert DNS packet flags to a value that represents the flags (using bitwise
 * operators), fitting in the last 16 bits. All parameters must be numbers.
 *
 * @param {integer} qr 0 if it is a query, 1 if it is a response
 * @param {integer} opcode 0 for a standard query
 * @param {integer} aa 1 if it is authoritative, else 0
 * @param {integer} tc 1 if truncated
 * @param {integer} rd 1 if recursion desired
 * @param {integer} ra 1 if recursion available
 * @param {integer} rcode 4-bit return code field. 0 for no error, 3 for name
 * error (if this is the authoritative name server and the name does not exist)
 *
 * @return {integer} an integer representing the flag values in the lowest
 * order 16 bits
 */
exports.getFlagsAsValue = function(qr, opcode, aa, tc, rd, ra, rcode) {
  var value = 0x0000;

  value = value << 1;
  value += qr & 0x01;

  value = value << 4;
  value += opcode & 0x0f;

  value = value << 1;
  value += aa & 0x01;

  value = value << 1;
  value += tc & 0x01;

  value = value << 1;
  value += rd & 0x01;

  value = value << 1;
  value += ra & 0x01;

  // These three bits are reserved for future use and must be set to 0.
  value = value << 3;

  value = value << 4;
  value += rcode & 0x0f;

  return value;
};

},{"./byte-array":1,"./dns-codes":2,"./question-section":5,"./resource-record":6}],4:[function(require,module,exports){
'use strict';

var byteArray = require('./byte-array');

/**
 * Various methods for common DNS-related operations.
 */

var MAX_LABEL_LENGTH = 63;
var OCTET_LABEL_LENGTH = 1;

exports.DEBUG = true;

exports.DEFAULT_TTL = 10;
exports.DEFAULT_PRIORITY = 0;
exports.DEFAULT_WEIGHT = 0;

/**
 * Return the local suffix, i.e. ".local". The leading dot is included.
 *
 * @return {string}
 */
exports.getLocalSuffix = function() {
  return '.local';
};

/**
 * Return a random integer between [min, max).
 *
 * @param {integer} min
 * @param {integer} max
 *
 * @return {integer} random value >= min and < max
 */
exports.randomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Converts a domain name to a byte array. Despite the name, this can serialize
 * any '.' separated string. _semcache._http.local is not a domain name, eg,
 * but it is serializable in the same fashion. The name 'domain' is retained to
 * be recognizable even to those that are not familiar with the term 'label'
 * that is used in the DNS spec.
 *
 * The DNS protocol specifies that a domain name is serialized as a series of
 * 'labels'. A label is a component of a name between a dot. www.example.com,
 * for example, would consist of three labels: www, example, and com.
 *
 * Labels are serialized by a single byte indicating the length of the bytes to
 * follow, terminated with a 0 byte to indicate there are no additional
 * labels.
 *
 * Labels are limited to 63 bytes.
 *
 * @param {string} domain
 *
 * @return {ByteArray} a ByteArray containing the serialized domain
 */
exports.getDomainAsByteArray = function(domain) {
  var result = new byteArray.ByteArray();

  var labels = domain.split('.');

  labels.forEach(label => {
    var length = label.length;
    if (length > MAX_LABEL_LENGTH) {
      throw new Error('label exceeds max length: ' + label);
    }

    // A label is serialized as a single byte for its length, followed by the
    // character code of each component.
    result.push(length, OCTET_LABEL_LENGTH);

    for (var i = 0; i < label.length; i++) {
      result.push(label.charCodeAt(i), 1);
    }
  });

  // The label is terminated by a 0 byte.
  result.push(0, OCTET_LABEL_LENGTH);

  return result;
};

/**
 * Convert a serialized domain name from its DNS representation to a string.
 * The byteArray should contain bytes as output by getDomainAsByteArray.
 *
 * @param {ByteArray} byteArr the ByteArray containing the serialized labels
 * @param {integer} startByte an optional index indicating the start point of
 * the serialization. If not present, assumes a starting index ov 0.
 *
 * @return {string}
 */
exports.getDomainFromByteArray = function(byteArr, startByte) {
  if (!(byteArr instanceof byteArray.ByteArray)) {
    throw new Error('byteArr is not type of ByteArray');
  }

  if (!startByte) {
    // If a start byte hasn't been specified, we start at the beginning.
    startByte = 0;
  }

  var reader = byteArr.getReader(startByte);
  
  var result = exports.getDomainFromByteArrayReader(reader, 0);
  return result;
};

/**
 * Convert a serialized domain name from its DNS representation to a string.
 * The reader should contain bytes as output from getDomainAsByteArray.
 *
 * @param {ByteArrayReader} reader a ByteArrayReader containing the bytes to be
 * deserialized. The reader will have all the domain bytes consumed.
 *
 * @return {string}
 */
exports.getDomainFromByteArrayReader = function(reader) {
  var result = '';

  // We expect a series of length charCode pairs, ending when the final length
  // field is a 0. We'll do this by examining a single label at a time.
  var lengthOfCurrentLabel = -1;
  var iteration = 0;
  // Sanity check because while loops are dangerous when faced with outside
  // data.
  var maxIterations = 10;
  while (lengthOfCurrentLabel !== 0) {
    if (iteration > maxIterations) {
      throw new Error('Exceeded max iterations, likely malformed data');
    }

    // Get the first length, consuming the first byte of the reader.
    lengthOfCurrentLabel = reader.getValue(1);

    if (lengthOfCurrentLabel > MAX_LABEL_LENGTH) {
      // This check will try to alert callers when they have an off by one or
      // other error in the byte array.
      throw new Error(
        'Got a label length greater than the max: ' + lengthOfCurrentLabel
      );
    }

    for (var i = 0; i < lengthOfCurrentLabel; i++) {
      var currentCharCode = reader.getValue(1);
      var currentChar = String.fromCharCode(currentCharCode);
      result += currentChar;
    }

    // We've consumed a label unless we're in the last iteration of the while
    // loop, add a '.'.
    if (lengthOfCurrentLabel !== 0) {
      result += '.';
    }

    iteration += 1;
  }

  // Unless we have an empty string, we've added one too many dots due to the
  // fence post problem in the while loop.
  if (result.length > 0) {
    result = result.substring(0, result.length - 1);
  }

  return result;
};

/**
 * Convert a string representation of an IP address to a ByteArray.
 * '155.33.17.68' would return a ByteArray with length 4, corresponding to the
 * bytes 155, 33, 17, 68.
 *
 * @param {string} ipAddress
 *
 * @return {ByteArray}
 */
exports.getIpStringAsByteArray = function(ipAddress) {
  var parts = ipAddress.split('.');

  if (parts.length < 4) {
    throw new Error('IP string does not have 4 parts: ' + ipAddress);
  }

  var result = new byteArray.ByteArray();
  
  parts.forEach(part => {
    var intValue = parseInt(part);
    if (intValue < 0 || intValue > 255) {
      throw new Error('A byte of the IP address < 0 or > 255: ' + ipAddress);
    }
    result.push(intValue, 1);
  });

  return result;
};

/**
 * Recover an IP address in string representation from the ByteArrayReader.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {string}
 */
exports.getIpStringFromByteArrayReader = function(reader) {
  // We assume a single byte representing each string.
  var parts = [];

  var numParts = 4;
  for (var i = 0; i < numParts; i++) {
    var intValue = reader.getValue(1);
    var stringValue = intValue.toString();
    parts.push(stringValue);
  }

  var result = parts.join('.');
  return result;
};

},{"./byte-array":1}],5:[function(require,module,exports){
/* global exports, require */
'use strict';

var byteArray = require('./byte-array');
var dnsUtil = require('./dns-util');

var NUM_OCTETS_QUERY_TYPE = 2;
var NUM_OCTETS_QUERY_CLASS = 2;

var MAX_QUERY_TYPE = 65535;
var MAX_QUERY_CLASS = 65535;

/**
 * A DNS Question section.
 *
 * @param {string} qName the name of the query
 * @param {integer} qType the type of the query
 * @param {integer} qClass the class of the query
 */
exports.QuestionSection = function QuestionSection(qName, qType, qClass) {
  if (!(this instanceof QuestionSection)) {
    throw new Error('QuestionSection must be called with new');
  }

  if (qType < 0 || qType > MAX_QUERY_TYPE) {
    throw new Error(
      'query type must be > 0 and < ' +
        MAX_QUERY_TYPE +
        ': ' +
        qType
    );
  }

  if (qClass < 0 || qClass > MAX_QUERY_CLASS) {
    throw new Error(
      'query class must be > 0 and < ' +
        MAX_QUERY_CLASS +
        ': ' +
        qClass
    );
  }

  this.queryName = qName;
  this.queryType = qType;
  this.queryClass = qClass;
};

/**
 * Convert the QuestionSection to a ByteArray object. According to 'TCP/IP
 * Illustrated, Volume 1' by Stevens, the format of the question section is as
 * follows:
 *
 * variable number of octets representing the query name
 *
 * 2 octets representing the query type
 *
 * 2 octets representing the query class
 *
 * @return {ByteArray}
 */
exports.QuestionSection.prototype.convertToByteArray = function() {
  var result = new byteArray.ByteArray();
  
  var queryAsBytes = dnsUtil.getDomainAsByteArray(this.queryName);
  result.append(queryAsBytes);

  result.push(this.queryType, NUM_OCTETS_QUERY_TYPE);
  result.push(this.queryClass, NUM_OCTETS_QUERY_CLASS);

  return result;
};

/**
 * Returns true if the question has requested a unicast response, else false.
 *
 * @return {boolean}
 */
exports.QuestionSection.prototype.unicastResponseRequested = function() {
  // For now, since we can't share a port in Chrome, we will assume that
  // unicast responses are always requested.
  return true;
};

/**
 * Create a QuestionSection from a ByteArrayReader as serialized by
 * convertToByteArray().
 */
exports.createQuestionFromReader = function(reader) {
  var queryName = dnsUtil.getDomainFromByteArrayReader(reader);

  var queryType = reader.getValue(NUM_OCTETS_QUERY_TYPE);
  if (queryType < 0 || queryType > MAX_QUERY_TYPE) {
    throw new Error('deserialized query type out of range: ' + queryType);
  }

  var queryClass = reader.getValue(NUM_OCTETS_QUERY_CLASS);
  if (queryClass < 0 || queryClass > MAX_QUERY_CLASS) {
    throw new Error('deserialized query class out of range: ' + queryClass);
  }

  var result = new exports.QuestionSection(queryName, queryType, queryClass);

  return result;
};

},{"./byte-array":1,"./dns-util":4}],6:[function(require,module,exports){
/* global exports, require */
'use strict';

var byteArray = require('./byte-array');
var dnsUtil = require('./dns-util');
var dnsCodes = require('./dns-codes');

var NUM_OCTETS_TYPE = 2;
var NUM_OCTETS_CLASS = 2;
var NUM_OCTETS_TTL = 4;
var NUM_OCTETS_RESOURCE_DATA_LENGTH = 2;

/** An A Record has for bytes, all representing an IP address. */
var NUM_OCTETS_RESOURCE_DATA_A_RECORD = 4;

var NUM_OCTETS_PRIORITY = 2;
var NUM_OCTETS_WEIGHT = 2;
var NUM_OCTETS_PORT = 2;

/**
 * A resource record (RR) is a component of a DNS message. They share a similar
 * structure but contain different information.
 *
 * Each resource record begins with a domain name, which can be a variable
 * number of bytes.
 *
 * Then is a 2-octet type (e.g. A, SRV, etc).
 *
 * Then is a 2-octet class (e.g. IN for internet).
 *
 * Then is a 4-octet TTL.
 *
 * Then is a variable number of bytes representing the data in record. The
 * first 2-octets are the length of the following data. The structure of that
 * data depends on the type of the record.
 *
 * Information here is based on 'TCP/IP Illustrated, Volume 1' by Stevens and
 * on the Bonjour Overview page provided by Apple:
 *
 * https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/NetServices/Articles/NetServicesArchitecture.html#//apple_ref/doc/uid/20001074-SW1
 */

/**
 * An A record. A records respond to queries for a domain name to an IP
 * address.
 *
 * @param {string} domainName: the domain name, e.g. www.example.com
 * @param {integer} ttl: the time to live
 * @param {string} ipAddress: the IP address of the domainName. This must be a string
 * (e.g. '192.3.34.17').
 * @param {integer} recordClass: the class of the record type. This is optional, and if not
 * present or is not truthy will be set as IN for internet traffic.
 */
exports.ARecord = function ARecord(
  domainName,
  ttl,
  ipAddress,
  recordClass
) {
  if (!(this instanceof ARecord)) {
    throw new Error('ARecord must be called with new');
  }

  if ((typeof ipAddress) !== 'string') {
    throw new Error('ipAddress must be a String: ' + ipAddress);
  }
  
  if (!recordClass) {
    recordClass = dnsCodes.CLASS_CODES.IN;
  }

  this.recordType = dnsCodes.RECORD_TYPES.A;
  this.recordClass = recordClass;

  this.domainName = domainName;
  this.name = domainName;
  this.ttl = ttl;
  this.ipAddress = ipAddress;
};

/**
 * Get the A Record as a ByteArray object.
 *
 * The DNS spec indicates that an A Record is represented in byte form as
 * follows.
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the number 4, to indicate that 4 bytes follow.
 *
 * 4 octets representing a 4-byte IP address
 *
 * @return {ByteArray}
 */
exports.ARecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.domainName,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  // First we add the length of the resource data.
  result.push(
    NUM_OCTETS_RESOURCE_DATA_A_RECORD, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the IP address itself.
  var ipStringAsBytes = dnsUtil.getIpStringAsByteArray(this.ipAddress);
  result.append(ipStringAsBytes);

  return result;
};

/**
 * Create an A Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the domain name of the A Record.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {ARecord}
 */
exports.createARecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.A) {
    throw new Error(
      'De-serialized A Record does not have A Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);

  // For an A Record this should always be 4.
  if (resourceLength !== NUM_OCTETS_RESOURCE_DATA_A_RECORD) {
    throw new Error(
      'Recovered resource length does not match expected value for A ' +
        '  Record: ' +
        resourceLength
    );
  }

  var ipString = dnsUtil.getIpStringFromByteArrayReader(reader);

  var result = new exports.ARecord(
    commonFields.domainName,
    commonFields.ttl,
    ipString,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create a PTR Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the PTR Record.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {PtrRecord}
 */
exports.createPtrRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.PTR) {
    throw new Error(
      'De-serialized PTR Record does not have PTR Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of PTR Record resource data: ' +
        resourceLength);
  }

  // In a PTR Record, the domain name field of the RR is actually the service
  // type (at least for mDNS).
  var serviceType = commonFields.domainName;
  var serviceName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.PtrRecord(
    serviceType,
    commonFields.ttl,
    serviceName,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create an SRV Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the SRV Record.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {SrvRecord}
 */
exports.createSrvRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.SRV) {
    throw new Error(
      'De-serialized SRV Record does not have SRV Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of SRV Record resource data: ' +
        resourceLength);
  }

  // In a SRV Record, the domain name field of the RR is actually the service
  // proto name.
  var serviceInstanceName = commonFields.domainName;
  
  // After the common fields, we expect priority, weight, port, target name.
  var priority = reader.getValue(NUM_OCTETS_PRIORITY);
  if (priority < 0 || priority > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + priority);
  }

  var weight = reader.getValue(NUM_OCTETS_WEIGHT);
  if (weight < 0 || weight > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + weight);
  }

  var port = reader.getValue(NUM_OCTETS_PORT);
  if (port < 0 || port > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + port);
  }

  var targetName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.SrvRecord(
    serviceInstanceName,
    commonFields.ttl,
    priority,
    weight,
    port,
    targetName
  );

  return result;
};

/**
 * A PTR record. PTR records respond to a query for a service type (eg
 * '_printer._tcp.local'. They return the name of an instance offering the
 * service (eg 'Printsalot._printer._tcp.local').
 *
 * @param {string} serviceType the string representation of the service that
 * has been queried for.
 * @param {integer} ttl the time to live
 * @param {string} instanceName the name of the instance providing the
 * serviceType
 * @param {integer} rrClass the class of the record. If not truthy, will be set
 * to IN for internet traffic.
 */
exports.PtrRecord = function PtrRecord(
  serviceType,
  ttl,
  instanceName,
  rrClass
) {
  if (!(this instanceof PtrRecord)) {
    throw new Error('PtrRecord must be called with new');
  }

  if ((typeof serviceType) !== 'string') {
    throw new Error('serviceType must be a String: ' + serviceType);
  }
  
  if ((typeof instanceName) !== 'string') {
    throw new Error('instanceName must be a String: ' + instanceName);
  }

  if (!rrClass) {
    rrClass = dnsCodes.CLASS_CODES.IN;
  }
  
  this.recordType = dnsCodes.RECORD_TYPES.PTR;
  this.recordClass = rrClass;

  this.serviceType = serviceType;
  this.name = serviceType;
  this.ttl = ttl;
  this.instanceName = instanceName;
};

/**
 * Get the PTR Record as a ByteArray object.
 *
 * The DNS spec indicates that an PTR Record is represented in byte form as
 * follows. (Using this and section 3.3.12 as a guide:
 * https://www.ietf.org/rfc/rfc1035.txt).
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * A variable number of octets representing "the domain-name, which points to
 * some location in the domain name space". In the context of mDNS, this would
 * be the name of the instance that actually provides the service that is being
 * queried for.
 *
 * @return {ByteArray}
 */
exports.PtrRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.serviceType,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var instanceNameAsBytes = dnsUtil.getDomainAsByteArray(this.instanceName);
  var resourceDataLength = instanceNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the instance name itself.
  result.append(instanceNameAsBytes);

  return result;
};

/**
 * An SRV record. SRV records map the name of a service instance to the
 * information needed to connect to the service. 
 *
 * @param {string} instanceTypeDomain: the name being queried for, e.g.
 * 'PrintsALot._printer._tcp.local'
 * @param {integer} ttl: the time to live
 * @param {integer} priority: the priority of this record if multiple records
 * are found. This must be a number from 0 to 65535.
 * @param {integer} weight: the weight of the record if two records have the
 * same priority. This must be a number from 0 to 65535.
 * @param {integer} port: the port number on which to find the service. This
 * must be a number from 0 to 65535.
 * @param {string} targetDomain: the domain hosting the service (e.g.
 * 'blackhawk.local')
 */
exports.SrvRecord = function SrvRecord(
  instanceTypeDomain,
  ttl,
  priority,
  weight,
  port,
  targetDomain
) {
  if (!(this instanceof SrvRecord)) {
    throw new Error('SrvRecord must be called with new');
  }
  this.recordType = dnsCodes.RECORD_TYPES.SRV;
  // Note that we're not exposing rrClass as a caller-specified variable,
  // because according to the spec SRV records occur in the IN class.
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.instanceTypeDomain = instanceTypeDomain;
  this.name = instanceTypeDomain;
  this.ttl = ttl;
  this.priority = priority;
  this.weight = weight;
  this.port = port;
  this.targetDomain = targetDomain;
};

/**
 * Get the SRV Record as a ByteArray object.
 *
 * According to this document (https://tools.ietf.org/html/rfc2782) and more
 * explicitly this document
 * (http://www.tahi.org/dns/packages/RFC2782_S4-1_0_0/SV/SV_RFC2782_SRV_rdata.html),
 * the layout of the SRV RR is as follows:
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * 2 octets indicating the priority
 *
 * 2 octets indicating the weight
 *
 * 2 octets indicating the port
 *
 * A variable number of octets encoding the target name (e.g.
 * PrintsALot.local), encoded as a domain name.
 *
 * @return {ByteArray}
 */
exports.SrvRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.instanceTypeDomain,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var targetNameAsBytes = dnsUtil.getDomainAsByteArray(this.targetDomain);

  var resourceDataLength = NUM_OCTETS_PRIORITY +
    NUM_OCTETS_WEIGHT +
    NUM_OCTETS_PORT +
    targetNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the priority, weight, and port.
  result.push(this.priority, NUM_OCTETS_PRIORITY);
  result.push(this.weight, NUM_OCTETS_WEIGHT);
  result.push(this.port, NUM_OCTETS_PORT);

  result.append(targetNameAsBytes);

  return result;
};

/**
 * Get the common components of a RR as a ByteArray. As specified by the DNS
 * spec and 'TCP/IP Illustrated, Volume 1' by Stevens, the format is as
 * follows:
 *
 * Variable number of octets encoding the domain name to which the RR is
 *   responding.
 *
 * 2 octets representing the RR type
 *
 * 2 octets representing the RR class
 *
 * 4 octets representing the TTL
 *
 * @return {ByteArray}
 */
exports.getCommonFieldsAsByteArray = function(
  domainName,
  rrType,
  rrClass,
  ttl
) {
  var result = new byteArray.ByteArray();

  var domainNameAsBytes = dnsUtil.getDomainAsByteArray(domainName);
  result.append(domainNameAsBytes);

  result.push(rrType, NUM_OCTETS_TYPE);
  result.push(rrClass, NUM_OCTETS_CLASS);
  result.push(ttl, NUM_OCTETS_TTL);

  return result;
};

/**
 * Extract the common fields from the reader as encoded by
 * getCommonFieldsAsByteArray.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {object} Returns an object with fields: domainName, rrType, rrClass,
 * and ttl.
 */
exports.getCommonFieldsFromByteArrayReader = function(reader) {
  var domainName = dnsUtil.getDomainFromByteArrayReader(reader);
  var rrType = reader.getValue(NUM_OCTETS_TYPE);
  var rrClass = reader.getValue(NUM_OCTETS_CLASS);
  var ttl = reader.getValue(NUM_OCTETS_TTL);

  var result = {
    domainName: domainName,
    rrType: rrType,
    rrClass: rrClass,
    ttl: ttl
  };

  return result;
};

/**
 * Return type of the Resource Record queued up in the reader. Peaking does not
 * affect the position of the underlying reader.
 *
 * @param {ByteArrayReader} reader
 *
 * @return {integer}
 */
exports.peekTypeInReader = function(reader) {
  // Getting values from the reader normally consumes bytes. Create a defensive
  // copy to work with instead.
  var byteArr = reader.byteArray;
  var startByte = reader.cursor;
  var safeReader = byteArr.getReader(startByte);

  // Consume an encoded domain name. Note this means we're computing domain
  // names twice, which isn't optimal.
  dnsUtil.getDomainFromByteArrayReader(safeReader);
  // After the domain, the type is next.
  var result = safeReader.getValue(NUM_OCTETS_TYPE);
  return result;
};

},{"./byte-array":1,"./dns-codes":2,"./dns-util":4}],7:[function(require,module,exports){
/* globals chrome */
'use strict';

/**
 * Add a callback function via chrome.runtime.onMessageExternal.addListener.
 * @param {Function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};

},{}],8:[function(require,module,exports){
/* globals chrome */
'use strict';

// Listens for the app launching then creates the window
chrome.app.runtime.onLaunched.addListener(function() {
  var width = 500;
  var height = 300;

  chrome.app.window.create('index.html', {
    id: 'main',
    bounds: {
      width: width,
      height: height,
      left: Math.round((screen.availWidth - width) / 2),
      top: Math.round((screen.availHeight - height)/2)
    }
  });
});

window.dnssd = require('dnssd');
window.dnsc = require('dnsc');
window.dnsSem = require('dnsSem');

},{"dnsSem":"dnsSem","dnsc":"dnsc","dnssd":"dnssd"}],9:[function(require,module,exports){
/* globals Promise, chrome */
'use strict';

/**
 * This module provides a wrapper around the callback-heavy chrome.fileSystem
 * API and provides an alternative based on Promises.
 */

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with the display path
 */
exports.getDisplayPath = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.getDisplayPath(entry, function(displayPath) {
      resolve(displayPath);
    });
  });
};

/**
 * @param {Entry} entry the starting entry that will serve as the base for a
 * writable entry
 *
 * @return {Promise} Promise that resolves with a writable entry
 */
exports.getWritableEntry = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.getWritableEntry(entry, function(writableEntry) {
      resolve(writableEntry);
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with a boolean
 */
exports.isWritableEntry = function(entry) {
  return new Promise(function(resolve) {
    chrome.fileSystem.isWritableEntry(entry, function(isWritable) {
      resolve(isWritable);
    });
  });
};

/**
 * The original Chrome callback takes two parameters: an entry and an array of
 * FileEntries. No examples appear to make use of this second parameter,
 * however, nor is it documented what the second parameter is for. For this
 * reason we return only the first parameter, but callers should be aware of
 * this difference compared to the original API.
 *
 * @param {object} options
 *
 * @return {Promise} Promise that resolves with an Entry
 */
exports.chooseEntry = function(options) {
  return new Promise(function(resolve) {
    chrome.fileSystem.chooseEntry(options, function(entry, arr) {
      if (arr) {
        console.warn(
          'chrome.fileSystem.chooseEntry callback invoked with a 2nd ' +
            'parameter that is being ignored: ',
            arr);
      }
      resolve(entry);
    });
  });
};

/**
 * @param {string} id id of a previous entry
 *
 * @return {Promise} Promise that resolves with an Entry
 */
exports.restoreEntry = function(id) {
  return new Promise(function(resolve) {
    chrome.fileSystem.restoreEntry(id, function(entry) {
      resolve(entry);
    });
  });
};

/**
 * @param {string} id
 *
 * @return {Promise} Promise that resolves with a boolean
 */
exports.isRestorable = function(id) {
  return new Promise(function(resolve) {
    chrome.fileSystem.isRestorable(id, function(isRestorable) {
      resolve(isRestorable);
    });
  });
};

/**
 * @param {Entry} entry
 *
 * @return {Promise} Promise that resolves with a string id that can be used to
 * restore the Entry in the future. The underlying Chrome API is a synchronous
 * call, but this is provided as a Promise to keep API parity with the rest of
 * the module. A synchronous version is provided via retainEntrySync.
 */
exports.retainEntry = function(entry) {
  var id = chrome.fileSystem.retainEntry(entry);
  return Promise.resolve(id);
};

/**
 * @param {Entry} entry
 *
 * @return {string} id that can be used to restore the Entry
 */
exports.retainEntrySync = function(entry) {
  return chrome.fileSystem.retainEntry(entry);
};

/**
 * @param {object} options
 *
 * @return {Promise} Promise that resolves with a FileSystem
 */
exports.requestFileSystem = function(options) {
  return new Promise(function(resolve) {
    chrome.fileSystem.requestFileSystem(options, function(fileSystem) {
      resolve(fileSystem);
    });
  });
};

/**
 * @return {Promise} Promise that resolves with a FileSystem
 */
exports.getVolumeList = function() {
  return new Promise(function(resolve) {
    chrome.fileSystem.getVolumeList(function(fileSystem) {
      resolve(fileSystem);
    });
  });
};

},{}],10:[function(require,module,exports){
/* globals Promise, chrome */
'use strict';

/**
 * This module provides a wrapper around the chrome.storage.local API and
 * provides an alternative based on Promises.
 */

/**
 * @param {boolean} useSync
 *
 * @return {StorageArea} chrome.storage.sync or chrome.storage.local depending
 * on the value of useSync
 */
function getStorageArea(useSync) {
  if (useSync) {
    return chrome.storage.sync;
  } else {
    return chrome.storage.local;
  }
}

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves with an object of key value mappings
 */
exports.get = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.get(keyOrKeys, function(items) {
      resolve(items);
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves with an integer of the number of
 * bytes in use for the given key or keys
 */
exports.getBytesInUse = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.getBytesInUse(keyOrKeys, function(numBytes) {
      resolve(numBytes);
    });
  });
};

/**
 * @param {object} items an object of key value mappings
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.set = function(items, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.set(items, function() {
      resolve();
    });
  });
};

/**
 * @param {string|Array<string>} keyOrKeys
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.remove = function(keyOrKeys, useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.remove(keyOrKeys, function() {
      resolve();
    });
  });
};

/**
 * @param {boolean} useSync true to use chrome.storage.sync, otherwise will use
 * chrome.storage.local
 *
 * @return {Promise} Promise that resolves when the operation completes
 */
exports.clear = function(useSync) {
  var storageArea = getStorageArea(useSync);
  return new Promise(function(resolve) {
    storageArea.clear(function() {
      resolve();
    });
  });
};

},{}],11:[function(require,module,exports){
/* globals Promise */
'use strict';

/**
 * Abstractions for reading and writing cached pages. Clients of this class
 * should not be concerned with the underlying file system.
 */

// Overview of the Datastore
//
// For the time being, there is no separate database or datastore. All
// information is saved in the file name on disk, eg
// "www.example.com_date". This will serve for a prototype but might become
// limiting in the future.

var fileSystem = require('./file-system');
var fsUtil = require('./file-system-util');
var serverApi = require('../server/server-api');

/** The number of characters output by Date.toISOString() */
var LENGTH_ISO_DATE_STR = 24;

var URL_DATE_DELIMITER = '_';

exports.MHTML_EXTENSION = '.mhtml';

/**
 * This object represents a page that is stored in the cache and can be browsed
 * to.
 *
 * @param {string} captureUrl the URL of the original captured page
 * @param {string} captureDate the ISO String representation of the datetime
 * @param {string} accessPath the path in the cache that can be used to access
 * the file the page was captured
 */
exports.CachedPage = function CachedPage(
  captureUrl,
  captureDate,
  path
) {
  if (!(this instanceof CachedPage)) {
    throw new Error('CachedPage must be called with new');
  }
  this.captureUrl = captureUrl;
  this.captureDate = captureDate;
  this.accessPath = path;
};

/**
 * Write a page into the cache.
 *
 * @param {string} captureUrl the URL that generated the MHTML
 * @param {string} captureDate the toISOString() of the date the page was
 * captured
 * @param {Blob} mhtmlBlob the contents of hte page
 *
 * @return {Promise} a Promise that resolves when the write is complete
 */
exports.addPageToCache = function(captureUrl, captureDate, mhtmlBlob) {
  return new Promise(function(resolve, reject) {
    // Get the directory to write into
    // Create the file entry
    // Perform the write
    fileSystem.getDirectoryForCacheEntries()
    .then(cacheDir => {
      var fileName = exports.createFileNameForPage(captureUrl, captureDate);
      var createOptions = {
        create: true,     // create if it doesn't exist
        exclusive: false  // OK if it already exists--will overwrite
      };
      return fsUtil.getFile(cacheDir, createOptions, fileName);
    })
    .then(fileEntry => {
      return fsUtil.writeToFile(fileEntry, mhtmlBlob);
    })
    .then(() => {
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all the cached pages that are stored in the cache.
 *
 * @return {Promise} Promise that resolves with an Array of CachedPage objects
 */
exports.getAllCachedPages = function() {
  return new Promise(function(resolve, reject) {
    exports.getAllFileEntriesForPages()
    .then(entries => {
      var result = [];
      entries.forEach(entry => {
        var cachedPage = exports.getEntryAsCachedPage(entry);
        result.push(cachedPage);
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get all the FileEntries representing saved pages.
 *
 * @return {Promise} Promise that resolves with an array of FileEntry objects
 */
exports.getAllFileEntriesForPages = function() {
  var flagDirNotSet = 1;
  return new Promise(function(resolve, reject) {
    fileSystem.getPersistedBaseDir()
    .then(dirEntry => {
      if (!dirEntry) {
        // We haven't set an entry.
        throw flagDirNotSet;
      }
      return fsUtil.listEntries(dirEntry);
    })
    .then(entries => {
      resolve(entries);
    })
    .catch(errFlag => {
      if (errFlag === flagDirNotSet) {
        reject('dir not set');
      } else {
        console.warn('unrecognized error flag: ', errFlag);
      }
    });
  });
};

/**
 * Convert an entry as represented on the file system to a CachedPage that can
 * be consumed by clients.
 *
 * This is the workhorse function for mapping between the two types.
 *
 * @param {FileEntry} entry
 *
 * @return {CachedPage}
 */
exports.getEntryAsCachedPage = function(entry) {
  var captureUrl = exports.getCaptureUrlFromName(entry.name);
  var captureDate = exports.getCaptureDateFromName(entry.name);
  var accessUrl = serverApi.getAccessUrlForCachedPage(entry.fullPath);

  var result = new exports.CachedPage(captureUrl, captureDate, accessUrl);
  return result;
};

/**
 * Create the file name for the cached page in a way that can later be parsed.
 *
 * @param {string} captureUrl
 * @param {string} captureDate the toISOString() representation of the date the
 * page was captured
 *
 * @return {string}
 */
exports.createFileNameForPage = function(captureUrl, captureDate) {
  return captureUrl +
    URL_DATE_DELIMITER +
    captureDate +
    exports.MHTML_EXTENSION;
};

/**
 * @param {string} name the name of the file
 *
 * @return {string} the capture url
 */
exports.getCaptureUrlFromName = function(name) {
  var nonNameLength = LENGTH_ISO_DATE_STR +
    URL_DATE_DELIMITER.length +
    exports.MHTML_EXTENSION.length;
  if (name.length < nonNameLength) {
    // The file name is too short, fail fast.
    throw new Error('name too short to store a url: ', name);
  }

  var result = name.substring(
    0,
    name.length - nonNameLength
  );
  return result;
};

/**
 * @param {string} name the name of the file
 * 
 * @return {string} the capture date's ISO string representation
 */
exports.getCaptureDateFromName = function(name) {
  // The date is stored at the end of the string.
  if (name.length < LENGTH_ISO_DATE_STR) {
    // We've violated an invariant, fail fast.
    throw new Error('name too short to store a date: ', name);
  }

  var dateStartIndex = name.length -
    LENGTH_ISO_DATE_STR -
    exports.MHTML_EXTENSION.length;
  var dateEndIndex = name.length - exports.MHTML_EXTENSION.length;

  var result = name.substring(dateStartIndex, dateEndIndex);
  return result;
};

},{"../server/server-api":13,"./file-system":12,"./file-system-util":"fsUtil"}],12:[function(require,module,exports){
/*jshint esnext:true*/
/* globals Promise */
'use strict';

var chromefs = require('./chromeFileSystem');
var chromeStorage = require('./chromeStorage');
var fsUtil = require('./file-system-util');

/** The local storage key for the entry ID of the base directory. */
exports.KEY_BASE_DIR = 'baseDir';

/** 
 * The path of the directory storing the cache entries relative to the root of
 * the storage directory. Begins with './'.
 */
exports.PATH_CACHE_DIR = 'cacheEntries';

/**
 * Get the directory where cache entries are stored.
 *
 * @return {Promise} Promise that resolves with a DirectoryEntry that is the
 * base cache directory. Rejects if the base directory has not been set.
 */
exports.getDirectoryForCacheEntries = function() {
  return new Promise(function(resolve, reject) {
    exports.getPersistedBaseDir()
    .then(baseDir => {
      var dirName = exports.PATH_CACHE_DIR;
      var options = {
        create: true,
        exclusive: false
      };
      return fsUtil.getDirectory(baseDir, options, dirName);
    })
    .then(cacheDir => {
      resolve(cacheDir);
    })
    .catch(err => {
      reject(err);
    });
  });

};

/**
 * Return the base directory behaving as the root of the SemCache file system.
 * This returns the "persisted" base directory in the sense that the directory
 * must have already been chosen via a file chooser. If a base directory has
 * not been chosen, it will return null.
 *
 * @return {DirectoryEntry} the directory that has been set as the root of the
 * SemCache file system. Returns null if the directory has not been set.
 */
exports.getPersistedBaseDir = function() {
  return new Promise(function(resolve) {
    exports.baseDirIsSet()
    .then(isSet => {
      if (isSet) {
        chromeStorage.get(exports.KEY_BASE_DIR)
        .then(keyValue => {
          var id = keyValue[exports.KEY_BASE_DIR];
          return chromefs.restoreEntry(id);
        })
        .then(dirEntry => {
          resolve(dirEntry);
        });
      } else {
        // Null if not set.
        resolve(null);
      }
    });
  });
};

/**
 * @return {Promise} Promise that resolves with a boolean
 */
exports.baseDirIsSet = function() {
  return new Promise(function(resolve) {
    chromeStorage.get(exports.KEY_BASE_DIR)
    .then(keyValue => {
      var isSet = false;
      if (keyValue && keyValue[exports.KEY_BASE_DIR]) {
        isSet = true;
      }
      resolve(isSet);
    });
  });
};

/**
 * Set an entry as the base directory to be used for the SemCache file system.
 *
 * @param {DirectoryEntry} dirEntry the entry that will be set as the base
 */
exports.setBaseCacheDir = function(dirEntry) {
  var keyObj = {};
  var id = chromefs.retainEntrySync(dirEntry);
  keyObj[exports.KEY_BASE_DIR] = id;
  chromeStorage.set(keyObj);
};

/**
 * Prompt the user to choose a directory.
 *
 * @return {Promise} a promise that resolves with a DirectoryEntry that has
 * been chosen by the user.
 */
exports.promptForDir = function() {
  return new Promise(function(resolve) {
    chromefs.chooseEntry({type: 'openDirectory'})
    .then(entry => {
      resolve(entry);
    });
  });
};

},{"./chromeFileSystem":9,"./chromeStorage":10,"./file-system-util":"fsUtil"}],13:[function(require,module,exports){
'use strict';

/**
 * Controls the API for the server backing SemCache.
 */

var HTTP_SCHEME = 'http://';

/** 
 * The path from the root of the server that serves cached pages.
 */
var PATH_PAGE_CACHE = 'pages';

/**
 * Returns an object mapping API end points to their paths. The paths do not
 * include leading or trailing slashes, but they can contain internal slashes
 * (e.g. 'foo' or 'foo/bar' but never '/foo/bar'). The paths do not contain
 * scheme, host, or port.
 *
 * @return {object} an object mapping API end points to string paths, like the
 * following:
 * {
 *   pageCache: ''
 * }
 */
exports.getApiEndpoints = function() {
  return {
    pageCache: PATH_PAGE_CACHE
  };
};

/**
 * Create the full access path that can be used to access the cached page.
 *
 * @param {string} fullPath the full path of the file that is to be accessed
 *
 * @return {string} a fully qualified and valid URL
 */
exports.getAccessUrlForCachedPage = function(fullPath) {
  var scheme = HTTP_SCHEME;
  // TODO: expose a method that gets the current address and port.
  // TODO: this might have to strip the path of directory where things are
  // stored--it basically maps between the two urls.
  var addressAndPort = '127.0.0.1:8081';
  var apiPath = exports.getApiEndpoints().pageCache;
  var result = scheme + [addressAndPort, apiPath, fullPath].join('/');
  return result;
};

},{}],14:[function(require,module,exports){
(function (global){
/*! http://mths.be/base64 v0.1.0 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code, and use
	// it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var InvalidCharacterError = function(message) {
		this.message = message;
	};
	InvalidCharacterError.prototype = new Error;
	InvalidCharacterError.prototype.name = 'InvalidCharacterError';

	var error = function(message) {
		// Note: the error messages used throughout this file match those used by
		// the native `atob`/`btoa` implementation in Chromium.
		throw new InvalidCharacterError(message);
	};

	var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	// http://whatwg.org/html/common-microsyntaxes.html#space-character
	var REGEX_SPACE_CHARACTERS = /[\t\n\f\r ]/g;

	// `decode` is designed to be fully compatible with `atob` as described in the
	// HTML Standard. http://whatwg.org/html/webappapis.html#dom-windowbase64-atob
	// The optimized base64-decoding algorithm used is based on @atk’s excellent
	// implementation. https://gist.github.com/atk/1020396
	var decode = function(input) {
		input = String(input)
			.replace(REGEX_SPACE_CHARACTERS, '');
		var length = input.length;
		if (length % 4 == 0) {
			input = input.replace(/==?$/, '');
			length = input.length;
		}
		if (
			length % 4 == 1 ||
			// http://whatwg.org/C#alphanumeric-ascii-characters
			/[^+a-zA-Z0-9/]/.test(input)
		) {
			error(
				'Invalid character: the string to be decoded is not correctly encoded.'
			);
		}
		var bitCounter = 0;
		var bitStorage;
		var buffer;
		var output = '';
		var position = -1;
		while (++position < length) {
			buffer = TABLE.indexOf(input.charAt(position));
			bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
			// Unless this is the first of a group of 4 characters…
			if (bitCounter++ % 4) {
				// …convert the first 8 bits to a single ASCII character.
				output += String.fromCharCode(
					0xFF & bitStorage >> (-2 * bitCounter & 6)
				);
			}
		}
		return output;
	};

	// `encode` is designed to be fully compatible with `btoa` as described in the
	// HTML Standard: http://whatwg.org/html/webappapis.html#dom-windowbase64-btoa
	var encode = function(input) {
		input = String(input);
		if (/[^\0-\xFF]/.test(input)) {
			// Note: no need to special-case astral symbols here, as surrogates are
			// matched, and the input is supposed to only contain ASCII anyway.
			error(
				'The string to be encoded contains characters outside of the ' +
				'Latin1 range.'
			);
		}
		var padding = input.length % 3;
		var output = '';
		var position = -1;
		var a;
		var b;
		var c;
		var d;
		var buffer;
		// Make sure any padding is handled outside of the loop.
		var length = input.length - padding;

		while (++position < length) {
			// Read three bytes, i.e. 24 bits.
			a = input.charCodeAt(position) << 16;
			b = input.charCodeAt(++position) << 8;
			c = input.charCodeAt(++position);
			buffer = a + b + c;
			// Turn the 24 bits into four chunks of 6 bits each, and append the
			// matching character for each of them to the output.
			output += (
				TABLE.charAt(buffer >> 18 & 0x3F) +
				TABLE.charAt(buffer >> 12 & 0x3F) +
				TABLE.charAt(buffer >> 6 & 0x3F) +
				TABLE.charAt(buffer & 0x3F)
			);
		}

		if (padding == 2) {
			a = input.charCodeAt(position) << 8;
			b = input.charCodeAt(++position);
			buffer = a + b;
			output += (
				TABLE.charAt(buffer >> 10) +
				TABLE.charAt((buffer >> 4) & 0x3F) +
				TABLE.charAt((buffer << 2) & 0x3F) +
				'='
			);
		} else if (padding == 1) {
			buffer = input.charCodeAt(position);
			output += (
				TABLE.charAt(buffer >> 2) +
				TABLE.charAt((buffer << 4) & 0x3F) +
				'=='
			);
		}

		return output;
	};

	var base64 = {
		'encode': encode,
		'decode': decode,
		'version': '0.1.0'
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return base64;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = base64;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (var key in base64) {
				base64.hasOwnProperty(key) && (freeExports[key] = base64[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.base64 = base64;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"binaryUtils":[function(require,module,exports){
/*jshint esnext:true*/
/*
 * https://github.com/justindarc/dns-sd.js
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Justin D'Arcangelo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

'use strict';

exports.BinaryUtils = (function() {

var BinaryUtils = {
  stringToArrayBuffer: function(string) {
    var length = (string || '').length;
    var arrayBuffer = new ArrayBuffer(length);
    var uint8Array = new Uint8Array(arrayBuffer);
    for (var i = 0; i < length; i++) {
      uint8Array[i] = string.charCodeAt(i);
    }

    return arrayBuffer;
  },

  arrayBufferToString: function(arrayBuffer) {
    var results = [];
    var uint8Array = new Uint8Array(arrayBuffer);

    for (var i = 0, length = uint8Array.length; i < length; i += 200000) {
      results.push(String.fromCharCode.apply(null, uint8Array.subarray(i, i + 200000)));
    }

    return results.join('');
  },

  blobToArrayBuffer: function(blob, callback) {
    var fileReader = new FileReader();
    fileReader.onload = function() {
      if (typeof callback === 'function') {
        callback(fileReader.result);
      }
    };
    fileReader.readAsArrayBuffer(blob);

    return fileReader.result;
  },

  mergeArrayBuffers: function(arrayBuffers, callback) {
    return this.blobToArrayBuffer(new Blob(arrayBuffers), callback);
  }
};

return BinaryUtils;

})();

},{}],"chromeUdp":[function(require,module,exports){
/* globals Promise, chrome */
'use strict';

var DEBUG = true;

exports.ChromeUdpSocket = function ChromeUdpSocket(socketInfo) {
  if (!(this instanceof ChromeUdpSocket)) {
    throw new Error('ChromeUdpSocket must be called with new');
  }
  this.socketInfo = socketInfo;
  this.socketId = socketInfo.socketId;
};

/**
 * Send data over the port and return a promise with the sendInfo result.
 * Behaves as a thin wrapper around chromeUdp.send.
 */
exports.ChromeUdpSocket.prototype.send = function(arrayBuffer, address, port) {
  return exports.send(this.socketId, arrayBuffer, address, port);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceive.addListener.
 */
exports.addOnReceiveListener = function(listener) {
  chrome.sockets.udp.onReceive.addListener(listener);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceiveError.addListener.
 */
exports.addOnReceiveErrorListener = function(listener) {
  chrome.sockets.udp.onReceiveError.addListener(listener);
};

exports.create = function(obj) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.create(obj, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.bind = function(socketId, address, port) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.bind(socketId, address, port, function(result) {
      if (result < 0) {
        console.log('chromeUdp.bind: result < 0, rejecting');
        console.log('    socketId: ', socketId);
        console.log('    address: ', address);
        console.log('    port: ', port);
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.send = function(socketId, arrayBuffer, address, port) {
  if (!socketId || !arrayBuffer || !address || !port) {
    console.warn(
      'send received bad arg: ', socketId, arrayBuffer, address, port
    );
  }
  return new Promise(function(resolve, reject) {
    if (DEBUG) {
      console.log('chromeUdp.send');
      console.log('    socketId: ', socketId);
      console.log('    address: ', address);
      console.log('    port: ', port);
      console.log('    arrayBuffer: ', arrayBuffer);
    }
    chrome.sockets.udp.send(
      socketId,
      arrayBuffer,
      address,
      port,
      function(sendInfo) {
        if (sendInfo.resultCode < 0) {
          console.log('chromeUdp.send: result < 0, rejecting');
          reject(sendInfo);
        } else {
          resolve(sendInfo);
        }
      }
    );
  });
};

exports.joinGroup = function(socketId, address) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.joinGroup(socketId, address, function(result) {
      console.log('socketId: ', socketId);
      console.log('address: ', address);
      if (result < 0) {
        console.log('chromeUdp.joinGroup: result < 0, reject');
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.getSockets = function() {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getSockets(function(allSockets) {
      resolve(allSockets);
    });
  });
};

exports.getInfo = function(socketId) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getInfo(socketId, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.closeAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log('Closing socket with id: ', socketInfo.socketId);
      chrome.sockets.udp.close(socketInfo.socketId);
    });
  });
};

exports.listAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log(socketInfo);
    });
  });
};

exports.logSocketInfo = function(info) {
  console.log('Received data via UDP on ', new Date());
  console.log('    socketId: ', info.socketId);
  console.log('    remoteAddress: ', info.remoteAddress);
  console.log('    remotePort: ', info.remotePort);
  console.log('    data: ', info.data);
  console.log('    info: ', info);
};

/**
 * Returns a Promise that resolves with a list of network interfaces.
 */
exports.getNetworkInterfaces = function() {
  return new Promise(function(resolve) {
    chrome.system.network.getNetworkInterfaces(function(interfaces) {
      resolve(interfaces);
    });
  });
};

},{}],"dnsSem":[function(require,module,exports){
/*jshint esnext:true*/
'use strict';

/**
 * A SemCache-specific wrapper around the mDNS and DNSSD APIs. SemCache clients
 * should use this module, as it handles things like service strings. More
 * general clients--i.e. those not implementing a SemCache instance--should
 * use the dns-sd module.
 */

var dnssd = require('./dns-sd');

var SEMCACHE_SERVICE_STRING = '_semcache._tcp';

/**
 * Return the service string representing SemCache, e.g. "_semcache._tcp".
 */
exports.getSemCacheServiceString = function() {
  return SEMCACHE_SERVICE_STRING;
};

/**
 * Register a SemCache instance. Returns a Promise that resolves with an object
 * like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local"
 * }
 *
 * name: the user-friendly name of the instance, e.g. "Sam's SemCache".
 * port: the port on which the SemCache instance is running.
 */
exports.registerSemCache = function(host, name, port) {
  var result = dnssd.register(host, name, SEMCACHE_SERVICE_STRING, port);
  return result;
};

/**
 * Browse for SemCache instances on the local network. Returns a Promise that
 * resolves with a list of objects like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 8889
 * }
 *
 * Resolves with an empty list if no instances are found.
 */
exports.browseForSemCacheInstances = function() {
  var result = dnssd.browseServiceInstances(SEMCACHE_SERVICE_STRING);
  return result;
};

},{"./dns-sd":"dnssd"}],"dnsc":[function(require,module,exports){
/*jshint esnext:true*/
/* globals Promise */
'use strict';

var chromeUdp = require('./chromeUdp');
var dnsUtil = require('./dns-util');
var dnsPacket = require('./dns-packet');
var byteArray = require('./byte-array');
var dnsCodes = require('./dns-codes');
var qSection = require('./question-section');

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

var DNSSD_MULTICAST_GROUP = '224.0.0.251';
var DNSSD_PORT = 53531;
var DNSSD_SERVICE_NAME = '_services._dns-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.DNSSD_PORT = DNSSD_PORT;
exports.DNSSD_SERVICE_NAME = DNSSD_SERVICE_NAME;

/**
 * These are the records owned by this module. They are maintained in an object
 * of domain name to array of records, e.g. { 'www.example.com': [Object,
 * Object, Object], 'www.foo.com': [Object] }.
 */
var records = {};

var onReceiveCallbacks = [];

/**
 * The IPv4 interfaces for this machine, cached to provide synchronous calls.
 */
var ipv4Interfaces = [];

/**
 * Returns all records known to this module.
 *
 * @return {Array<resource record>} all the resource records known to this
 * module
 */
exports.getRecords = function() {
  return records;
};

/**
 * Returns all the callbacks currently registered to be invoked with incoming
 * packets.
 *
 * @return {Array<function>} all the onReceive callbacks that have been
 * registered
 */
exports.getOnReceiveCallbacks = function() {
  return onReceiveCallbacks;
};

/**
 * The socket used for accessing the network. Object of type
 * chromeUdp.ChromeUdpSocket.
 */
exports.socket = null;
/** The information about the socket we are using. */
exports.socketInfo = null;

/**
 * True if the service is started.
 *
 * @return {boolean} representing whether or not the service has started
 */
exports.isStarted = function() {
  return started;
};

/**
 * Return a cached array of IPv4 interfaces for this machine.
 *
 * @return {object} an array of all the IPv4 interfaces known to this machine.
 * The objects have the form: 
 * {
 *   name: string,
 *   address: string,
 *   prefixLength: integer
 * }
 */
exports.getIPv4Interfaces = function() {
  if (!exports.isStarted()) {
    console.log('Called getIPv4Interfaces when controller was not started');
  }
  if (!ipv4Interfaces) {
    return [];
  } else {
    return ipv4Interfaces;
  }
};

/**
 * Add a callback to be invoked with received packets.
 *
 * @param {function} callback a callback to be invoked with received packets.
 */
exports.addOnReceiveCallback = function(callback) {
  onReceiveCallbacks.push(callback);
};

/**
 * Remove the callback.
 *
 * @param {function} callback the callback function to be removed. The callback
 * should already have been added via a call to addOnReceiveCallback().
 */
exports.removeOnReceiveCallback = function(callback) {
  var index = onReceiveCallbacks.indexOf(callback);
  if (index >= 0) {
    onReceiveCallbacks.splice(index, 1);
  }
};

/**
 * The listener that is attached to chrome.sockets.udp.onReceive.addListener
 * when the service is started.
 *
 * @param {object} info the object that is called by the chrome.sockets.udp
 * API. It is expected to look like:
 * {
 *   data: ArrayBuffer,
 *   remoteAddress: string,
 *   remotePort: integer
 * }
 */
exports.onReceiveListener = function(info) {
  if (dnsUtil.DEBUG) {
    chromeUdp.logSocketInfo(info);
  }

  if (!exports.socket) {
    // We don't have a socket with which to listen.
    return;
  }

  if (exports.socket.socketId !== info.socketId) {
    if (dnsUtil.DEBUG) {
      console.log('Message is for this address but not this socket, ignoring');
    }
    return;
  }

  if (dnsUtil.DEBUG) {
    console.log('Message is for us, parsing');
  }
  
  // Create a DNS packet.
  var byteArr = new byteArray.ByteArray(info.data);
  var packet = dnsPacket.createPacketFromReader(byteArr.getReader());

  exports.handleIncomingPacket(packet, info.remoteAddress, info.remotePort);
};

/**
 * Respond to an incoming packet.
 *
 * @param {DnsPacket} packet the incoming packet
 * @param {string} remoteAddress the remote address sending the packet
 * @param {integer} remotePort the remote port sending the packet
 */
exports.handleIncomingPacket = function(packet, remoteAddress, remotePort) {
  // For now, we are expecting callers to register and de-register their own
  // onReceiveCallback to track responses. This means if it's a response we
  // will just ignore invoke the callbacks and return. If it is a query, we
  // need to respond to it.

  // First, invoke all the callbacks.
  for (var i = 0; i < onReceiveCallbacks.length; i++) {
    var fn = onReceiveCallbacks[i];
    fn(packet);
  }

  // Second, see if it's a query. If it is, get the requested records,
  // construct a packet, and send the packet.
  if (!packet.isQuery) {
    return;
  }

  if (packet.questions.length === 0) {
    console.log('Query packet has no questions: ', packet.questions);
    return;
  }

  // According to the RFC, multiple questions in the same packet are an
  // optimization and nothing more. We will respond to each question with its
  // own packet while still being compliant.
  packet.questions.forEach(question => {
    var responsePacket = exports.createResponsePacket(packet);
    var records = exports.getResourcesForQuery(
      question.queryName,
      question.queryType,
      question.queryClass
    );

    // If we didn't get any records, don't send anything.
    if (records.length === 0) {
      return;
    }

    records.forEach(record => {
      responsePacket.addAnswer(record);
    });

    // We may be multicasting, or we may be unicast responding.
    var sendAddr = DNSSD_MULTICAST_GROUP;
    var sendPort = DNSSD_PORT;
    if (question.unicastResponseRequested()) {
      sendAddr = remoteAddress;
      sendPort = remotePort;
    }
    exports.sendPacket(responsePacket, sendAddr, sendPort);
  });
};

/**
 * Create a response packet with the appropriate parameters for the given
 * query. It does not include any resource records (including questions).
 *
 * @param {DnsPacket} queryPacket the query packet to create a response to.
 *
 * @return {DnsPacket} the packet in response. No records are included.
 */
exports.createResponsePacket = function(queryPacket) {
  // According to section 6 of the RFC we do not include the question we are
  // answering in response packets:
  // "Multicast DNS responses MUST NOT contain any questions in the Question
  // Section.  Any questions in the Question Section of a received Multicast
  // DNS response MUST be silently ignored.  Multicast DNS queriers receiving
  // Multicast DNS responses do not care what question elicited the response;
  // they care only that the information in the response is true and accurate."
  if (queryPacket) {
    // We aren't actually using the query packet yet, but we might be in the
    // future, so the API includes it.
    // no op.
  }
  var result = new dnsPacket.DnsPacket(
    0,      // 18.1: IDs in responses MUST be set to 0
    false,  // not a query.
    0,      // 18.3: MUST be set to 0
    true,   // 18.4: in response MUST be set to one
    0,      // 18.5: might be non-0, but caller can adjust if truncated
    0,      // 18.6: SHOULD be 0
    0,      // 18.7 MUST be 0
    0       // 18.11 MUST be 0
  );
  return result;
};

/**
 * Return the resource records belonging to this server that are appropriate
 * for this query. According to section 6 of the RFC, we only respond with
 * records for which we are authoritative. Thus we also must omit records from
 * any cache we are maintaining, unless those records originated from us and
 * are thus considered authoritative.
 *
 * @param {String} qName the query name
 * @param {number} qType the query type
 * @param {number} qClass the query class
 *
 * @return {Array<resource record>} the array of resource records appropriate
 * for this query
 */
exports.getResourcesForQuery = function(qName, qType, qClass) {
  // According to RFC section 6: 
  // "The determination of whether a given record answers a given question is
  // made using the standard DNS rules: the record name must match the question
  // name, the record rrtype must match the question qtype unless the qtype is
  // "ANY" (255) or the rrtype is "CNAME" (5), and the record rrclass must
  // match the question qclass unless the qclass is "ANY" (255).  As with
  // Unicast DNS, generally only DNS class 1 ("Internet") is used, but should
  // client software use classes other than 1, the matching rules described
  // above MUST be used."

  // records stored as {qName: [record, record, record] }
  var namedRecords = records[qName];

  // We need to special case the DNSSD service enumeration string, as specified
  // in RFC 6763, Section 9.
  if (qName === DNSSD_SERVICE_NAME) {
    // This essentially is just a request for all PTR records, regardless of
    // name. We will just get all the records and let the later machinery
    // filter as necessary for class and type.
    namedRecords = [];
    Object.keys(records).forEach(key => {
      var keyRecords = records[key];
      keyRecords.forEach(record => {
        if (record.recordType === dnsCodes.RECORD_TYPES.PTR) {
          namedRecords.push(record);
        }
      });
    });
  }

  if (!namedRecords) {
    // Nothing at all--return an empty array
    return [];
  }

  var result = exports.filterResourcesForQuery(
    namedRecords, qName, qType, qClass
  );

  return result;
};

/**
 * Return an Array with only the elements of resources that match the query
 * terms.
 * 
 * @param {Array<resource record>} resources an Array of resource records that
 * will be filtered
 * @param {string} qName the name of the query
 * @param {integer} qType the type of the query
 * @param {integer} qClass the class of the query
 *
 * @return {Array<resource record>} the subset of resources that match the
 * query terms
 */
exports.filterResourcesForQuery = function(resources, qName, qType, qClass) {
  var result = [];

  resources.forEach(record => {
    var meetsName = false;
    var meetsType = false;
    var meetsClass = false;
    if (qName === record.name || qName === DNSSD_SERVICE_NAME) {
      meetsName = true;
    }
    if (qType === dnsCodes.RECORD_TYPES.ANY || record.recordType === qType) {
      meetsType = true;
    }
    if (qClass === dnsCodes.CLASS_CODES.ANY || record.recordClass === qClass) {
      meetsClass = true;
    }

    if (meetsName && meetsType && meetsClass) {
      result.push(record);
    }
  });

  return result;
};

/**
 * Start the system. This must be called before any other calls to this module.
 *
 * Returns a promise that resolves with the socket.
 *
 * @return {Promise} that resolves with a ChromeUdpSocket
 */
exports.getSocket = function() {
  if (exports.socket) {
    // Already started, resolve immediately.
    return new Promise(resolve => { resolve(exports.socket); });
  }

  // Attach our listeners.
  chromeUdp.addOnReceiveListener(exports.onReceiveListener);

  return new Promise((resolve, reject) => {
    // We have two steps to do here: create a socket and bind that socket to
    // the mDNS port.
    var createPromise = chromeUdp.create({});
    createPromise.then(info => {
      exports.socketInfo = info;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success() {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(
        exports.socketInfo.socketId,
        DNSSD_MULTICAST_GROUP
      );
    }, function err(error) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when binding DNSSD port:', error));
    })
    .then(function joinedGroup() {
      exports.socket = new chromeUdp.ChromeUdpSocket(exports.socketInfo);
      started = true;
      resolve(exports.socket);
    }, function failedToJoinGroup(result) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when joining DNSSD group: ', result));
    });
  });
};

/**
 * Start the service.
 *
 * Returns a Promise that resolves when everything is up and running.
 *
 * @return {Promise}
 */
exports.start = function() {
  if (exports.isStarted()) {
    if (dnsUtil.DEBUG) {
      console.log('start called when already started');
    }
    // Already started, resolve immediately.
    return new Promise();
  } else {
    // All the initialization we need to do is create the socket (so that we
    // can receive even if we aren't advertising ourselves) and retrieve our
    // network interfaces.
    return new Promise(function(resolve, reject) {
      exports.getSocket()
      .then(function startedSocket() {
        exports.initializeNetworkInterfaceCache();
      })
      .then(function initializedInterfaces() {
        resolve();
      })
      .catch(function startWhenWrong() {
        reject();
      });
    });
  }
};

/**
 * Initialize the cache of network interfaces known to this machine.
 *
 * @return {Promise} resolves when the cache is initialized
 */
exports.initializeNetworkInterfaceCache = function() {
  return new Promise(function(resolve) {
    chromeUdp.getNetworkInterfaces().then(function success(interfaces) {
      interfaces.forEach(iface => {
        if (iface.address.indexOf(':') !== -1) {
          console.log('Not yet supporting IPv6: ', iface);
        } else {
          ipv4Interfaces.push(iface);
        }
      });
      resolve();
    });
  });
};

/**
 * Shuts down the system.
 */
exports.stop = function() {
  if (exports.socket) {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: found socket, closing');
    }
    chromeUdp.closeAllSockets();
    exports.socket = null;
    started = false;
  } else {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: no socket found');
    }
  }
};

/**
 * Send the packet to the given address and port.
 *
 * @param {DnsPacket} packet the packet to send
 * @param {string} address the address to which to send the packet
 * @param {number} port the port to sent the packet to
 */
exports.sendPacket = function(packet, address, port) {
  var byteArr = packet.convertToByteArray();
  // And now we need the underlying buffer of the byteArray, truncated to the
  // correct size.
  var uint8Arr = byteArray.getByteArrayAsUint8Array(byteArr);

  exports.getSocket().then(socket => {
    socket.send(uint8Arr.buffer, address, port);
  });
};

/**
 * Perform an mDNS query on the network.
 *
 * @param {string} queryName
 * @param {integer} queryType
 * @param {integer} queryClass
 */
exports.query = function(queryName, queryType, queryClass) {
  // ID is zero, as mDNS ignores the id field.
  var packet = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );

  var question = new qSection.QuestionSection(
    queryName,
    queryType,
    queryClass
  );
  packet.addQuestion(question);

  exports.sendPacket(packet, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
};

/**
 * Issue a query for an A Record with the given domain name. Returns a promise
 * that resolves with a list of ARecords received in response. Resolves with an
 * empty list if none are found.
 *
 * @param {string} domainName the domain name for which to return A Records
 *
 * @return {Array<resource record>} the A Records corresponding to this domain
 * name
 */
exports.queryForARecord = function(domainName) {
  return exports.getResourcesForQuery(
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for PTR Records advertising the given service name. Returns a
 * promise that resolves with a list of PtrRecords received in response.
 * Resolves with an empty list if none are found.
 *
 * @param {string} serviceName the serviceName for which to query for PTR
 * Records
 *
 * @return {Array<resource record> the PTR Records for the service
 */
exports.queryForPtrRecord = function(serviceName) {
  return exports.getResourcesForQuery(
    serviceName,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for SRV Records corresponding to the given instance name.
 * Returns a promise that resolves with a list of SrvRecords received in
 * response. Resolves with an empty list if none are found.
 *
 * @param {string} instanceName the instance name for which you are querying
 * for SRV Records
 *
 * @return {Array<resource record>} the SRV Records matching this query
 */
exports.queryForSrvRecord = function(instanceName) {
  return exports.getResourcesForQuery(
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Add a record corresponding to name to the internal data structures.
 *
 * @param {string} name the name of the resource record to add
 * @param {resource record} record the record to add
 */
exports.addRecord = function(name, record) {
  var existingRecords = records[name];
  if (!existingRecords) {
    existingRecords = [];
    records[name] = existingRecords;
  }
  existingRecords.push(record);
};

},{"./byte-array":1,"./chromeUdp":"chromeUdp","./dns-codes":2,"./dns-packet":3,"./dns-util":4,"./question-section":5}],"dnssd":[function(require,module,exports){
/*jshint esnext:true*/
/* globals Promise */
'use strict';

/**
 * The client API for interacting with mDNS and DNS-SD.
 *
 * This is based in part on the Bonjour APIs outlined in 'Zero Configuration
 * Networking: The Definitive Guide' by Cheshire and Steinberg in order to
 * provide a familiar interface.
 *
 * 'RFC 6762: Multicast DNS' is the model for many of the decisions and actions
 * take in this module. 'The RFC' in comments below refers to this RFC. It can
 * be accessed here:
 *
 * https://tools.ietf.org/html/rfc6762#
 *
 * Since this is programming to a specification (or at least to an RFC), it is
 * conforming to a standard. Actions are explained in comments, with direct
 * references to RFC sections as much as is possible.
 */


var dnsUtil = require('./dns-util');
var dnsController = require('./dns-controller');
var dnsCodes = require('./dns-codes');
var resRec = require('./resource-record');
var dnsPacket = require('./dns-packet');

var MAX_PROBE_WAIT = 250;
var DEFAULT_QUERY_WAIT_TIME = 2000;

exports.DEFAULT_QUERY_WAIT_TIME = DEFAULT_QUERY_WAIT_TIME;

exports.LOCAL_SUFFIX = 'local';

/**
 * Returns a promise that resolves after the given time (in ms).
 *
 * @param {integer} ms the number of milliseconds to wait before resolving
 */
exports.wait = function(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
};

/**
 * Returns a Promise that resolves after 0-250 ms (inclusive).
 *
 * @return {Promise}
 */
exports.waitForProbeTime = function() {
  // +1 because randomInt is by default [min, max)
  return exports.wait(dnsUtil.randomInt(0, MAX_PROBE_WAIT + 1));
};

/**
 * Returns true if the DnsPacket is for this queryName.
 *
 * @param {DnsPacket} packet
 * @param {string} qName
 * @param {integer} qType
 * @param {integer} qClass
 *
 * @return {boolean}
 */
exports.packetIsForQuery = function(packet, qName, qType, qClass) {
  var filteredRecords = dnsController.filterResourcesForQuery(
    packet.answers, qName, qType, qClass
  );
  return filteredRecords.length !== 0;
};

/**
 * Generates a semi-random hostname ending with ".local". An example might be
 * 'host123.local'.
 *
 * @param {string}
 */
exports.createHostName = function() {
  var start = 'host';
  // We'll return within the range 0, 1000.
  var randomInt = dnsUtil.randomInt(0, 1001);
  var result = start + randomInt + dnsUtil.getLocalSuffix();
  return result;
};

/**
 * Advertise the resource records.
 *
 * @param {Array<resource records>} resourceRecords the records to advertise
 */
exports.advertiseService = function(resourceRecords) {
  var advertisePacket = new dnsPacket.DnsPacket(
    0,      // id 0 for mDNS
    false,  // not a query
    0,      // opCode must be 0 on transmit (18.3)
    false,  // authoritative must be false on transmit (18.4)
    false,  // isTruncated must be false on transmit (18.5)
    false,  // recursion desired should be 0 (18.6)
    false,  // recursion available must be 0 (18.7)
    false   // return code must be 0 (18.11)
  );

  // advertisements should be sent in the answer section
  resourceRecords.forEach(record => {
    advertisePacket.addAnswer(record);
  });
  dnsController.sendPacket(
    advertisePacket,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.DNSSD_PORT
  );
};

/**
 * Register a service via mDNS. Returns a Promise that resolves with an object
 * like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 1234
 * }
 *
 * @param {string} host the host of the service, e.g. 'laptop.local'
 * @param {string} name a user-friendly string to be the name of the instance,
 * e.g. "Sam's SemCache".
 * @param {string} type the service type string. This should be the protocol
 * spoken and the transport protocol, eg "_http._tcp".
 * @param {integer} port the port the service is available on
 */
exports.register = function(host, name, type, port) {
  // Registration is a multi-step process. According to the RFC, section 8.
  //
  // 8.1 indicates that the first step is to send an mDNS query of type ANY
  // (255) for a given domain name.
  //
  // 8.1 also indicates that the host should wait a random time between 0-250ms
  // before issuing the query. This must be performed a total of three times
  // before a lack of responses indicates that the name is free.
  //
  // The probes should be sent with QU questions with the unicast response bit
  // set.
  //
  // 8.2 goes into tiebreaking. That is omitted here.
  //
  // 8.3 covers announcing. After probing, announcing is performed with all of
  // the newly created resource records in the Answer Section. This must be
  // performed twice, one second apart.

  var result = new Promise(function(resolve, reject) {
    var foundHostFree = null;
    // We start by probing for messages of type ANY with the hostname.
    exports.issueProbe(
      host,
      dnsCodes.RECORD_TYPES.ANY,
      dnsCodes.CLASS_CODES.IN
    ).then(function hostFree() {
      foundHostFree = true;
      // We need to probe for the name under which a SRV record would be, which
      // is name.type.local
      var srvName = exports.createSrvName(name, type, 'local');
      return exports.issueProbe(
        srvName,
        dnsCodes.RECORD_TYPES.ANY,
        dnsCodes.CLASS_CODES.IN
      );
    }, function hostTaken() {
      foundHostFree = false;
      reject(new Error('host taken: ' + host));
    }).then(function instanceFree() {
      if (foundHostFree) {
        var hostRecords = exports.createHostRecords(host);
        var serviceRecords = exports.createServiceRecords(
          name,
          type,
          port,
          host
        );
        var allRecords = hostRecords.concat(serviceRecords);
        exports.advertiseService(allRecords);

        resolve(
          {
            serviceName: name,
            type: type,
            domain: host,
            port: port
          }
        );
      }
    }, function instanceTaken() {
      console.log('INSTANCE TAKEN');
      reject(new Error('instance taken: ' + name));
    });
  });

  return result;
};

/**
 * Register the host on the network. Assumes that a probe has occurred and the
 * hostname is free.
 *
 * @param {string} host
 *
 * @return {Array<resource records>} an Array of the records that were added.
 */
exports.createHostRecords = function(host) {
  // This just consists of an A Record. Make an entry for every IPv4 address.
  var result = [];
  dnsController.getIPv4Interfaces().forEach(iface => {
    var aRecord = new resRec.ARecord(
      host,
      dnsUtil.DEFAULT_TTL,
      iface.address,
      dnsCodes.CLASS_CODES.IN
    );
    result.push(aRecord);
    dnsController.addRecord(host, aRecord);
  });
  return result;
};

/**
 * Create the complete name of the service as is appropriate for a SRV record,
 * e.g. "Sam Cache._semcache._tcp.local".
 *
 * @param {string} userFriendlyName the friendly name of the instance, e.g.
 * "Sam Cache"
 * @param {string} type the type string of the service, e.g. "_semcache._tcp"
 * @param {string} domain the domain in which to find the service, e.g. "local"
 *
 * @return {string}
 */
exports.createSrvName = function(userFriendlyName, type, domain) {
  return [userFriendlyName, type, domain].join('.');
};

/**
 * Register the service on the network. Assumes that a probe has occured and
 * the service name is free.
 *
 * @param {string} name name of the instance, e.g. 'Sam Cache'
 * @param {string} type type of the service, e.g. _semcache._tcp
 * @param {integer} port port the service is running on, eg 7777
 * @param {string} domain target domain/host the service is running on, e.g.
 * 'blackhack.local'
 *
 * @return {Array<resource records>} an Array of the records that were added.
 */
exports.createServiceRecords = function(name, type, port, domain) {
  // We need to add a PTR record and an SRV record.

  // SRV Records are named according to name.type.domain, which we always
  // assume to be local.
  var srvName = exports.createSrvName(name, type, 'local');
  var srvRecord = new resRec.SrvRecord(
    srvName,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  var ptrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    srvName,
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(srvName, srvRecord);
  dnsController.addRecord(type, ptrRecord);

  var result = [srvRecord, ptrRecord];
  return result;
};

exports.receivedResponsePacket = function(packets, qName, qType, qClass) {
  for (var i = 0; i < packets.length; i++) {
    var packet = packets[i];
    if (
      !packet.isQuery &&
        exports.packetIsForQuery(packet, qName, qType, qClass)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Issue a probe compliant with the mDNS spec, which specifies that a probe
 * happen three times at random intervals.
 *
 * @param {string} queryName
 * @param {integer} queryType
 * @param {integer} queryClass
 *
 * @return {Promise} Returns a promise that resolves if the probe returns
 * nothing, meaning that the queryName is available, and rejects if it is
 * taken.
 */
exports.issueProbe = function(queryName, queryType, queryClass) {
  // Track the packets we receive whilst querying.
  var packets = [];
  var callback = function(packet) {
    packets.push(packet);
  };
  dnsController.addOnReceiveCallback(callback);

  // Now we kick off a series of queries. We wait a random time to issue a
  // query. 250ms after that we issue another, then another.
  var result = new Promise(function(resolve, reject) {
    exports.waitForProbeTime()
      .then(function success() {
        dnsController.query(
          queryName,
          queryType,
          queryClass
        );
        return exports.wait(MAX_PROBE_WAIT);
      }).then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          resolve();
          dnsController.removeOnReceiveCallback(callback);
        }
      })
      .catch(function failured() {
        dnsController.removeOnReceiveCallback(callback);
        reject();
      });
  });

  return result;
};

/**
 * Get operational information on all services of a given type on the network.
 *
 * This is a convenience method for issuing a series of requests--for PTR
 * records to find the specific instances providing a service, SRV records for
 * finding the port and host name of those instances, and finally A records for
 * determining the IP addresses of the hosts.
 *
 * @param {string} serviceType the type of the service to browse for
 *
 * @return {Promise} a Promise that resolves with operational information for
 * all instances. This is an Array of objects like the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   instanceName: 'Sam Cache',
 *   domainName: 'laptop.local',
 *   ipAddress: '123.4.5.6',
 *   port: 8888
 * }
 */
exports.browseServiceInstances = function(serviceType) {
  return new Promise(function(resolve, reject) {
    var ptrResponses = [];
    var srvResponses = [];
    var aResponses = [];
    exports.queryForServiceInstances(serviceType)
      .then(function success(ptrInfos) {
        var srvRequests = [];
        ptrInfos.forEach(ptr => {
          ptrResponses.push(ptr);
          var instanceName = ptr.serviceName;
          var req = exports.queryForInstanceInfo(
            instanceName, exports.DEFAULT_QUERY_WAIT_TIME
          );
          srvRequests.push(req);
        });
        return Promise.all(srvRequests);
      })
      .then(function success(srvInfos) {
        var aRequests = [];
        srvInfos.forEach(srv => {
          // the query methods return an Array of responses, even if only a
          // single response is requested. This allows for for API similarity
          // across calls and for an eventual implementation that permits both
          // A and AAAA records when querying for IP addresses, e.g., but means
          // that we are effectively iterating over an array of arrays. For
          // simplicity, however, we will assume at this stage that we only
          // ever expect a single response, which is correct in the vast
          // majority of cases.
          srv = srv[0];
          srvResponses.push(srv);
          var hostname = srv.domain;
          var req = exports.queryForIpAddress(
            hostname, exports.DEFAULT_QUERY_WAIT_TIME
          );
          aRequests.push(req);
        });
        return Promise.all(aRequests);
      })
      .then(function success(aInfos) {
        aInfos.forEach(aInfo => {
          aInfo = aInfo[0];
          aResponses.push(aInfo);
        });
        
        var result = [];
        for (var i = 0; i < ptrResponses.length; i++) {
          var ptr = ptrResponses[i];
          var srv = srvResponses[i];
          var aRec = aResponses[i];
          result.push({
            serviceType: serviceType,
            instanceName: ptr.serviceName,
            domainName: srv.domain,
            ipAddress: aRec.ipAddress,
            port: srv.port
          });
        }

        resolve(result);
      })
      .catch(function failed(err) {
        console.log(err);
        reject('Caught error in browsing for service: ' + err);
      });
  });
};

/**
 * Issue a query for instances of a particular service type. Tantamout to
 * issueing PTR requests.
 *
 * @param {string} serviceType the service string to query for
 * @param {number} waitTime the time to wait for responses. As multiple
 * responses can be expected in response to a query for instances of a service
 * (as multiple instances can exist on the same network), the Promise will
 * always resolve after this many milliseconds.
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   serviceName: 'Magic Cache'
 * }
 */
exports.queryForServiceInstances = function(serviceType, timeout) {
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.PTR;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      serviceType,
      rType,
      rClass,
      true,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                serviceType: answer.serviceType,
                serviceName: answer.instanceName
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query for an IP address mapping to a domain.
 *
 * @param {string} domainName the domain name to query for
 * @param {number} timeout the number of ms after which to time out
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   domainName: 'example.local',
 *   ipAddress: '123.4.5.6'
 * }
 */
exports.queryForIpAddress = function(domainName, timeout) {
  // Note that this method ignores the fact that you could have multiple IP
  // addresses per domain name. At a minimum, you could have IPv6 and IPv4
  // addresses. For prototyping purposes, a single IP address is sufficient.
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.A;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      domainName,
      rType,
      rClass,
      false,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                domainName: answer.domainName,
                ipAddress: answer.ipAddress
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query for information about a service instance name, including the
 * port and domain name on which it is active.
 *
 * @param {string} instanceName the instance name to query for
 * @param {number} timeout the number of ms after which to time out
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   instanceName: 'Sam Cache',
 *   domain: 'example.local',
 *   port: 1234
 * }
 */
exports.queryForInstanceInfo = function(instanceName, timeout) {
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.SRV;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      instanceName,
      rType,
      rClass,
      false,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                instanceName: answer.instanceTypeDomain,
                domain: answer.targetDomain,
                port: answer.port
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query and listen for responses. (As opposed to simply issuing a DNS
 * query without being interested in the responses.)
 * 
 * @param {String} qName the name of the query to issue
 * @param {number} qType the type of the query to issue
 * @param {number} qClass the class of the query to issue
 * @param {boolean} multipleResponses true if we can expect multiple or an open
 * ended number of responses to this query
 * @param {number} timeoutOrWait if multipleExpected is true, this is the
 * amount of time we wait before returning results. If multipleExpected is
 * false (e.g. querying for an A Record, which should have a single answer),
 * this is the amount of time we wait before timing out and resolving with an
 * empty list.
 *
 * @return {Promise} Returns a Promise that resolves with an Array of Packets
 * received in response to the query. If multipleResponses is true, will not
 * resolve until timeoutOrWait milliseconds. If multipleResponses is false,
 * will resolve after the first packet is received or after timeoutOrWait is
 * satifised. 
 */
exports.queryForResponses = function(
  qName,
  qType,
  qClass,
  multipleResponses,
  timeoutOrWait
) {
  // Considerations for querying exist in RFC 6762 Section 5.2: Continuous
  // Multicast DNS Querying. This scenario essentially allows for a standing
  // request for notifications of instances of a particular type. This is
  // useful for to automatically update a list of available printers, for
  // example. For the current implementation, we are instead going to just
  // issue a query for PTR records of the given type.
  //
  // Several considerations are made in the RFC for how to responsibly browse
  // the network. First, queries should be delayed by a random value between
  // 20 and 120ms, in order to not collide or flood in the event that a browse
  // is triggered at the same time, e.g. by a common event. Second, the first
  // two queries must take place 1 second apart. Third, the period between
  // queries must increase by at least a factor of 2. Finally, known-answer
  // suppression must be employed.
  //
  // For now, we are not implementing those more sophisticated features.
  // Instead, this method provides a way to issue a query immediately. This can
  // include a general standing query (if multipleResponses is true), or a
  // query for the first response (if multipleResponses is false).

  return new Promise(function(resolve) {
    // Code executes even after a promise resolves, so we will use this flag to
    // make sure we never try to resolve more than once.
    var resolved = false;

    // Track the packets we received while querying.
    var packets = [];
    var callback = function(packet) {
      if (exports.packetIsForQuery(packet, qName, qType, qClass)) {
        packets.push(packet);
        if (!multipleResponses) {
          // We can go ahead an resolve.
          resolved = true;
          dnsController.removeOnReceiveCallback(callback);
          resolve(packets);
        }
      }
    };
    dnsController.addOnReceiveCallback(callback);

    dnsController.query(
      qName,
      qType,
      qClass
    );
    
    exports.wait(timeoutOrWait)
      .then(function waited() {
        if (!resolved) {
          dnsController.removeOnReceiveCallback(callback);
          resolved = true;
          resolve(packets);
        }
      })
      .catch(function somethingWentWrong(err) {
        console.log('Something went wrong in query: ', err);
      });
  });
};

},{"./dns-codes":2,"./dns-controller":"dnsc","./dns-packet":3,"./dns-util":4,"./resource-record":6}],"extBridge":[function(require,module,exports){
'use strict';

var chromeWrapper = require('./chromeRuntimeWrapper');
var datastore = require('../persistence/datastore');
var base64 = require('base-64');

/**
 * ID of the Semcache extension.
 */
exports.EXTENSION_ID = 'malgfdapbefeeidjfndgioclhfpfglhe';

/**
 * Function to handle messages coming from the SemCache extension.
 *
 * @param {object} message message sent by the extension. Expected to have the
 * following format:
 * {
 *   type: 'write'
 *   params: {captureUrl: 'url', captureDate: 'iso', dataUrl: 'string'}
 * }
 * @param {MessageSender}
 * @param {function}
 */
exports.handleExternalMessage = function(message, sender, response) {
  if (sender.id !== exports.EXTENSION_ID) {
    console.log('ID not from SemCache extension: ', sender);
    return;
  }
  if (message.type === 'write') {
    var blob = exports.getBlobFromDataUrl(message.params.dataUrl);
    var captureUrl = message.params.captureUrl;
    var captureDate = message.params.captureDate;
    datastore.addPageToCache(captureUrl, captureDate, blob);
    if (response) {
      response();
    }
  } else {
    console.log('Unrecognized message type from extension: ', message.type);
  }
};

/**
 * @param {string} dataUrl a data url as encoded by FileReader.readAsDataURL
 *
 * @return {Blob}
 */
exports.getBlobFromDataUrl = function(dataUrl) {
  // Decoding from data URL based on:
  // https://gist.github.com/fupslot/5015897
  var byteString = base64.decode(dataUrl.split(',')[1]);
  var mime = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  // write the ArrayBuffer to a blob, and you're done
  var result = new Blob([ab], {type: mime});
  return result;
};

exports.attachListeners = function() {
  chromeWrapper.addOnMessageExternalListener(exports.handleExternalMessage);
};

},{"../persistence/datastore":11,"./chromeRuntimeWrapper":7,"base-64":14}],"fsUtil":[function(require,module,exports){
/* globals Promise */
'use strict';

/**
 * General file system operations on top of the web APIs.
 */

/*
 * This code is based on the Mozilla and HTML5Rocks examples shown here:
 * https://developer.mozilla.org/en/docs/Web/API/DirectoryReader
 */
function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

/**
 * @param {DirectoryEntry} dirEntry the directory to list
 *
 * @return {Promise} Promise that resolves with an Array of Entry objects
 * that are the contents of the directory
 */
exports.listEntries = function(dirEntry) {
  // This code is based on the Mozilla and HTML5Rocks examples shown here:
  // https://developer.mozilla.org/en/docs/Web/API/DirectoryReader
  var dirReader = dirEntry.createReader();
  var entries = [];

  return new Promise(function(resolve, reject) {

    // Keep calling readEntries() until no more results are returned.
    var readEntries = function() {
      dirReader.readEntries (function(results) {
        if (!results.length) {
          resolve(entries.sort());
        } else {
          entries = entries.concat(toArray(results));
          readEntries();
        }
      }, function(err) {
        reject(err);
      });
    };

    readEntries();
  });
};

/**
 * @param {FileEntry} fileEntry the file that will be written to
 * @param {Blob} fileBlob the content to write
 *
 * @return {Promise} Promise that resolves when the write is complete or
 * rejects with an error
 */
exports.writeToFile = function(fileEntry, fileBlob) {
  return new Promise(function(resolve, reject) {
    fileEntry.createWriter(function(fileWriter) {

      fileWriter.onwriteend = function() {
        resolve();
      };

      fileWriter.onerror = function(err) {
        reject(err);
      };

      fileWriter.write(fileBlob);
    });
  });
};

/**
 * A Promise-ified version of DirectoryEntry.getFile().
 *
 * @param {DirectoryEntry} dirEntry the parent directory
 * @param {object} options object to pass to getFile function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise} Promise that resolves with the FileEntry or rejects with
 * an error
 */
exports.getFile = function(dirEntry, options, name) {
  return new Promise(function(resolve, reject) {
    dirEntry.getFile(name, options, function(fileEntry) {
      resolve(fileEntry);
    },
    function(err) {
      reject(err);
    });
  });
};

/**
 * A Promise-ified version of DirectoryEntry.getDirectory().
 *
 * @param {DirectoryEntry} dirEntry the parent directory
 * @param {object} options object to pass to getDirectory function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise} Promise that resolves with the DirectoryEntry or rejects
 * with an error
 */
exports.getDirectory = function(dirEntry, options, name) {
  return new Promise(function(resolve, reject) {
    dirEntry.getDirectory(name, options, function(dirEntry) {
      resolve(dirEntry);
    },
    function(err) {
      reject(err);
    });
  });
};

},{}]},{},[8]);
