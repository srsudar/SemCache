/*jshint esnext:true, bitwise:false */

/**
 * Represents a DNS packet.
 *
 * The structure of the packet is based on the information in 'TCP/IP
 * Illustrated, Volume 1: The Protocols' by Stevens.
 */
'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;

const dnsCodes = require('./dns-codes');
const qSection = require('./question-section');
const resRec = require('./resource-record');

const ARecord = resRec.ARecord;
const PtrRecord = resRec.PtrRecord;
const QuestionSection = qSection.QuestionSection;
const SrvRecord = resRec.SrvRecord;


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

/**
 * Various octet information:
 *
 * 2 octets in the id
 * 2 octets for the flags
 * 2 octets for section lengths
 */

/**
 * Parse numRecords Resource Records from a ByteArrayReader object. Returns an
 * array of resource record objects.
 *
 * @param {SmartBuffer} sBuff the SmartBuffer from which to construct resource
 * records. Should have been moved to the correct cursor position
 * @param {integer} numRecords the number of records to parse
 *
 * @return {Array<ARecord|PtrRecord|SrvRecord>} an Array of the parsed resource
 * records
 */
exports.parseRecordsFromSmartBuffer = function(sBuff, numRecords) {
  let result = [];

  for (let i = 0; i < numRecords; i++) {
    let recordType = resRec.peekTypeInSmartBuffer(sBuff);

    let record = null;
    switch (recordType) {
      case dnsCodes.RECORD_TYPES.A:
        record = ARecord.fromSmartBuffer(sBuff);
        break;
      case dnsCodes.RECORD_TYPES.PTR:
        record = PtrRecord.fromSmartBuffer(sBuff);
        break;
      case dnsCodes.RECORD_TYPES.SRV:
        record = SrvRecord.fromSmartBuffer(sBuff);
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
 * packet is not converted to byte format until a call is made to toBuffer().
 */
class DnsPacket {
  /*
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
   * error. Name errors are returned only from the authoritative name server
   * and means the domain name specified does not exist
   */
  constructor(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  ) {
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
  }

  /**
   * Convert the DnsPacket to a Buffer. The format of a DNS Packet is
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
   * @return {Buffer}
   */
  toBuffer() {
    let sBuff = new SmartBuffer();

    // 2 octets
    sBuff.writeUInt16BE(this.id);

    // Prepare flags to be passed to getFlagsAsValue
    let qr = this.isQuery ? 0 : 1;  // 0 means query, 1 means response
    let opcode = this.opCode;
    let aa = this.isAuthorativeAnswer ? 1 : 0;
    let tc = this.isTruncated ? 1 : 0;
    let rd = this.recursionDesired ? 1 : 0;
    let ra = this.recursionAvailable ? 1 : 0;
    let rcode = this.returnCode;

    let flagValue = exports.getFlagsAsValue(qr, opcode, aa, tc, rd, ra, rcode);

    // 2 octets
    sBuff.writeUInt16BE(flagValue);
    
    // 2 octets
    sBuff.writeUInt16BE(this.questions.length);
    sBuff.writeUInt16BE(this.answers.length);
    sBuff.writeUInt16BE(this.authority.length);
    sBuff.writeUInt16BE(this.additionalInfo.length);

    // We should have now met the requirement of adding 12 bytes to a DNS header.
    if (sBuff.length !== 12) {
      throw new Error(
        'Problem serializing DNS packet. Header length != 12 bytes'
      );
    }

    this.questions.forEach(question => {
      let buff = question.toBuffer();
      sBuff.writeBuffer(buff);
    });

    this.answers.forEach(answer => {
      let buff = answer.toBuffer();
      sBuff.writeBuffer(buff);
    });

    this.authority.forEach(authority => {
      let buff = authority.toBuffer();
      sBuff.writeBuffer(buff);
    });

    this.additionalInfo.forEach(info => {
      let buff = info.toBuffer();
      sBuff.writeBuffer(buff);
    });

    return sBuff.toBuffer();
  }

  /**
   * Create a DNS Packet from a ByteArrayReader object. The contents of the
   * reader are as expected to be output from convertToByteArray().
   *
   * @param {Buffer} buff Buffer from which to create the packet
   *
   * @return {DnsPacket} the packet constructed
   */
  static fromBuffer(buff) {
    let sBuff = SmartBuffer.fromBuffer(buff);
    
    // 2 octets
    let id = sBuff.readUInt16BE();
    let flagsAsValue = sBuff.readUInt16BE();
    let numQuestions = sBuff.readUInt16BE();
    let numAnswers = sBuff.readUInt16BE();
    let numAuthority = sBuff.readUInt16BE();
    let numAdditionalInfo = sBuff.readUInt16BE();

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
      let question = QuestionSection.fromSmartBuffer(sBuff);
      result.addQuestion(question);
    }

    let answers = exports.parseRecordsFromSmartBuffer(sBuff, numAnswers);
    let authorities = exports.parseRecordsFromSmartBuffer(
      sBuff, numAuthority
    );
    let infos = exports.parseRecordsFromSmartBuffer(
      sBuff, numAdditionalInfo
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
  }

  /**
   * Add a question resource to the DNS Packet.
   *
   * @param {QuestionSection} question the question to add to this packet 
   */
  addQuestion(question) {
    if (!(question instanceof qSection.QuestionSection)) {
      throw new Error(
        'question must be a QuestionSection but was: ', question
      );
    }
    this.questions.push(question);
  }

  /**
   * Add a Resource Record to the answer section.
   *
   * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to
   * the answer section
   */
  addAnswer(resourceRecord) {
    this.answers.push(resourceRecord);
  }

  /**
   * Add a Resource Record to the authority section.
   *
   * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to the
   * authority section
   */
  addAuthority(resourceRecord) {
    this.authority.push(resourceRecord);
  }

  /**
   * Add a Resource Record to the additional info section.
   *
   * @param {ARecord|PtrRecord|SrvRecord} resourceRecord the record to add to the
   * additional info section
   */
  addAdditionalInfo(resourceRecord) {
    this.additionalInfo.push(resourceRecord);
  }
}

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

exports.DnsPacket = DnsPacket;
