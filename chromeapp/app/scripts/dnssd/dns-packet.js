/*jshint esnext:true, bitwise:false */

/**
 * Represents a DNS packet.
 *
 * The structure of the packet is based on the information in 'TCP/IP
 * Illustrated, Volume 1: The Protocols' by Stevens.
 */
'use strict';

const resRec = require('./resource-record');
const dnsCodes = require('./dns-codes');
const byteArray = require('./byte-array');
const qSection = require('./question-section');

// These constants are defined by the number of bits allowed for each value in
// the DNS spec. Section 4.1.1 of RFC 1035 has a good summary.
// https://www.ietf.org/rfc/rfc1035.txt

/**
 * The maximum valid ID of a DNS Packet, defined by the 32 bits allowed in the
 * spec.
 */
const MAX_ID = 65535;

/** The maximum OPCODE is defined by the 4 bits allowed in the spec. */
const MAX_OPCODE = 15;

/** The maximum RCODE is defined by the 4 bits allowed in the spec. */
const MAX_RETURN_CODE = 15;

/** The number of octets in the ID of the DNS Packet as defined in the spec. */
const NUM_OCTETS_ID = 2;

/** The number of octets in the ID of the DNS Packet as defined in the spec. */
const NUM_OCTETS_FLAGS = 2;

/** The number of octets in the ID of the DNS Packet as defined in the spec. */
const NUM_OCTETS_SECTION_LENGTHS = 2;

/**
 * Parse numRecords Resource Records from a ByteArrayReader object. Returns an
 * array of resource record objects.
 *
 * @param {ByteArrayReader} reader the reader from which to construct resource
 * records. reader should have been moved to the correct cursor position
 * @param {integer} numRecords the number of records to parse
 *
 * @return {Array<ARecord|PtrRecord|SrvRecord>} an Array of the parsed resource
 * records
 */
exports.parseResourceRecordsFromReader = function(reader, numRecords) {
  let result = [];
  for (let i = 0; i < numRecords; i++) {
    let recordType = resRec.peekTypeInReader(reader);

    let record = null;
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
};

/**
 * Create a DNS packet. This creates the packet with various flag values. The
 * packet is not converted to byte format until a call is made to
 * getAsByteArray().
 *
 * @constructor
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
 *
 * @return {ByteArray}
 */
exports.DnsPacket.prototype.convertToByteArray = function() {
  let result = new byteArray.ByteArray();

  result.push(this.id, NUM_OCTETS_ID);

  // Prepare flags to be passed to getFlagsAsValue
  let qr = this.isQuery ? 0 : 1;  // 0 means query, 1 means response
  let opcode = this.opCode;
  let aa = this.isAuthorativeAnswer ? 1 : 0;
  let tc = this.isTruncated ? 1 : 0;
  let rd = this.recursionDesired ? 1 : 0;
  let ra = this.recursionAvailable ? 1 : 0;
  let rcode = this.returnCode;

  let flagValue = exports.getFlagsAsValue(qr, opcode, aa, tc, rd, ra, rcode);
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
    let byteArr = question.convertToByteArray();
    result.append(byteArr);
  });

  this.answers.forEach(answer => {
    let byteArr = answer.convertToByteArray();
    result.append(byteArr);
  });

  this.authority.forEach(authority => {
    let byteArr = authority.convertToByteArray();
    result.append(byteArr);
  });

  this.additionalInfo.forEach(info => {
    let byteArr = info.convertToByteArray();
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
  let id = reader.getValue(NUM_OCTETS_ID);
  let flagsAsValue = reader.getValue(NUM_OCTETS_FLAGS);
  let numQuestions = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  let numAnswers = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  let numAuthority = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  let numAdditionalInfo = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);

  let flags = exports.getValueAsFlags(flagsAsValue);

  let opCode = flags.opcode;
  let returnCode = flags.rcode;

  // 0 means it is a query, 1 means it is a response.
  let isQuery;
  if (flags.qr === 0) {
    isQuery = true;
  } else {
    isQuery = false;
  }

  // The non-QR flags map more readily to 0/1 = false/true, so we will use
  // ternary operators.
  let isAuthorativeAnswer = flags.aa ? true : false;
  let isTruncated = flags.tc ? true : false;
  let recursionDesired = flags.rd ? true : false;
  let recursionAvailable = flags.ra ? true : false;

  let result = new exports.DnsPacket(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  );

  for (let i = 0; i < numQuestions; i++) {
    let question = qSection.createQuestionFromReader(reader);
    result.addQuestion(question);
  }

  let answers = exports.parseResourceRecordsFromReader(reader, numAnswers);
  let authorities = exports.parseResourceRecordsFromReader(
    reader, numAuthority
  );
  let infos = exports.parseResourceRecordsFromReader(
    reader, numAdditionalInfo
  );

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
 * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to the
 * answer section
 */
exports.DnsPacket.prototype.addAnswer = function(resourceRecord) {
  this.answers.push(resourceRecord);
};

/**
 * Add a Resource Record to the authority section.
 *
 * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to the
 * authority section
 */
exports.DnsPacket.prototype.addAuthority = function(resourceRecord) {
  this.authority.push(resourceRecord);
};

/**
 * Add a Resource Record to the additional info section.
 *
 * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to the
 * additional info section
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
 * @return {Object} a flag object like the following:
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
  let qr = (value & 0x8000) >> 15;
  let opcode = (value & 0x7800) >> 11;
  let aa = (value & 0x0400) >> 10;
  let tc = (value & 0x0200) >> 9;
  let rd = (value & 0x0100) >> 8;
  let ra = (value & 0x0080) >> 7;
  let rcode = (value & 0x000f) >> 0;

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
  let value = 0x0000;

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
