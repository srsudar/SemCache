'use strict';

/**
 * Protocol for transmitting data via WebRTC data channel.
 *
 * This exists to solve the problem that we ideally would like to transmit both
 * metadata control information (e.g. "uh oh, there's been a server error"),
 * and the data chunks themselves. We could have a control channel and a data
 * channel, but this requires coordination of two channels, as well as an
 * additional channel resource.
 *
 * We also cannot simply pass an ArrayBuffer as a member of a JSON message.
 * Instead, we are going to going to include header information in the message
 * itself.
 *
 * This class assists in creating and reading those messages.
 */

/** The number of bytes used to indicate the length of the header. */
const NUM_BYTES_HEADER_LENGTH = 4;

/**
 * These status codes are based on HTTP status codes, and are added as
 * necessary.
 */
exports.STATUS_CODES = {
  error: 500,
  ok: 200
};

class ProtocolMessage {
  /**
   * @param {Object} header
   * @param {Buffer} buff
   */
  constructor(header, buff) {
    this.header = header;

    // Distinguishing between 0 length Buffers and null is problematic for
    // serialization. To ensure we have consistent behavior, we'll default to an
    // empty buffer.
    if (!buff) {
      buff = Buffer.alloc(0);
    }
    this.data = buff;
  }

  /**
   * @return {boolean} true if is an OK message, else false
   */
  isOk() {
    let statusCode = this.getStatusCode();
    return statusCode === exports.STATUS_CODES.ok;
  }

  /**
   * @return {boolean} true if is an Error message, else false
   */
  isError() {
    let statusCode = this.getStatusCode();
    return statusCode === exports.STATUS_CODES.error;
  }

  /**
   * @return {Object} the header object from the message
   */
  getHeader() {
    return this.header;
  }

  /**
   * @return {Buffer} the Buffer representing the payload of the message
   */
  getData() {
    return this.data;
  }

  /**
   * @return {integer|null} the integer status code of the message. If no header
   * or status code is included, returns null.
   */
  getStatusCode() {
    if (!this.header) {
      return null;
    }
    if (!this.header.status) {
      return null;
    }
    return this.header.status;
  }

  /**
   * Get this ProtocolMessage as a Buffer, serializing the method. This Buffer
   * can then be deserialized using the from() method.
   *
   * @return {Buffer}
   */
  toBuffer() {
    /*
     * The data structure is outlined as follows, but is not part of the public
     * API. The first 4 bytes correspond to an integer. This integer denotes the
     * length of the JSON header information. All remaining bytes are data bytes.
     */
    let metadataLength = NUM_BYTES_HEADER_LENGTH;
    let headerStr = '';
    let headerLength = 0;
    if (this.header) {
      headerStr = JSON.stringify(this.header);
      headerLength = headerStr.length;
      metadataLength += headerLength;
    }

    let metadataBuff = Buffer.alloc(metadataLength);

    let offset = 0;
    metadataBuff.writeUInt32BE(headerLength);
    offset += NUM_BYTES_HEADER_LENGTH;

    metadataBuff.write(headerStr, offset, headerLength);

    let buffsToJoin = [ metadataBuff ];
    if (this.data) {
      buffsToJoin.push(this.data);
    }

    let result = Buffer.concat(buffsToJoin);
    return result;
  }

  /**
   * Recover a ProtocolMessage from a Buffer.
   *
   * @param {Buffer} buff
   *
   * @return {ProtocolMessage}
   */
  static fromBuffer(buff) {
    let headerLength = buff.readUInt32BE(0);
    let offset = NUM_BYTES_HEADER_LENGTH;
    let headerStr = buff.toString('utf8', offset, offset + headerLength);
    offset += headerLength;

    let header = null;
    if (headerLength > 0) {
      header = JSON.parse(headerStr);
    }
    let data = buff.slice(offset, buff.length);

    let result = new exports.ProtocolMessage(header, data);
    return result;
  }
}

/**
 * Create a rudimentary header object.
 *
 * @param {integer} status
 *
 * @return {Object}
 */
exports.createHeader = function(status) {
  return {
    status: status
  };
};

/**
 * @param {Buffer} buff
 *
 * @return {ProtocolMessage}
 */
exports.createSuccessMessage = function(buff) {
  let header = exports.createHeader(exports.STATUS_CODES.ok);
  return new exports.ProtocolMessage(header, buff);
};

/**
 * @param {any} reason the reason for the error
 *
 * @return {ProtocolMessage}
 */
exports.createErrorMessage = function(reason) {
  let header = exports.createHeader(exports.STATUS_CODES.error);
  header.message = reason;
  return new exports.ProtocolMessage(header, null);
};

exports.ProtocolMessage = ProtocolMessage;
