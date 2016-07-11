/*jshint esnext:true, bitwise:false */

/**
 * Represents a DNS packet.
 *
 * The structure of the packet is based on the information in 'TCP/IP
 * Illustrated, Volume 1: The Protocols' by Stevens.
 */
'use strict';

var resRec = require('./resource-record');
var dnsCodes = require('./dns-codes-sem');
var byteArray = require('./byte-array-sem');
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
 * id: a 2-octet identifier for the packet
 * isQuery: true if packet is a query, false if it is a response
 * opCode: a 4-bit field. 0 is a standard query
 * isAuthoritativeAnswer: true if the response is authoritative for the domain
 *   in the question section
 * isTruncated: true if the reply is truncated
 * recursionIsDesired: true if recursion is desired
 * recursionAvailable: true or recursion is available
 * returnCode: a 4-bit field. 0 is no error and 3 is a name error. Name errors
 *   are returned only from the authoritative name server and means the domain
 *   name specified does not exist
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
 * question must be a QuestionSection object.
 */
exports.DnsPacket.prototype.addQuestion = function(question) {
  if (!(question instanceof qSection.QuestionSection)) {
    throw new Error('question must be a QuestionSection but was: ' + question);
  }
  this.questions.push(question);
};

/**
 * Add a Resource Record to the answer section.
 */
exports.DnsPacket.prototype.addAnswer = function(resourceRecord) {
  this.answers.push(resourceRecord);
};

/**
 * Add a Resource Record to the authority section.
 */
exports.DnsPacket.prototype.addAuthority = function(resourceRecord) {
  this.authority.push(resourceRecord);
};

/**
 * Add a Resource Record to the additional info section.
 */
exports.DnsPacket.prototype.addAdditionalInfo = function(resourceRecord) {
  this.additionalInfo.push(resourceRecord);
};

/**
 * Convert the given value (in 16 bits) to an object containing the DNS header
 * flags. The returned object will have the following properties: qr, opcdoe,
 * aa, tc, rd, ra, rcode.
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
 * qr: 0 if it is a query, 1 if it is a response
 * opcode: 0 for a standard query
 * aa: 1 if it is authoritative, else 0
 * tc: 1 if truncated
 * rd: 1 if recursion desired
 * ra: 1 if recursion available
 * rcode: 4-bit return code field. 0 for no error, 3 for name error (if this is
 *   the authoritative name server and the name does not exist)
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
