'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;


/**
 * Various methods for common DNS-related operations.
 */

const MAX_LABEL_LENGTH = 63;

exports.DEBUG = false;

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
 * @return {Buffer} a ByteArray containing the serialized domain
 */
exports.getDomainAsBuffer = function(domain) {
  let sBuff = new SmartBuffer();
  let labels = domain.split('.');

  labels.forEach(label => {
    let length = label.length;
    if (length > MAX_LABEL_LENGTH) {
      throw new Error('label exceeds max length: ' + label);
    }

    // A label is serialized as a single byte for its length, followed by the
    // character code of each component.
    sBuff.writeUInt8(length);

    for (let i = 0; i < label.length; i++) {
      sBuff.writeUInt8(label.charCodeAt(i));
    }
  });

  // The label is terminated by a 0 byte.
  sBuff.writeUInt8(0);

  return sBuff.toBuffer();
};

/**
 * Retrieve a domain from the SmartBuffer. Consumes the SmartBuffer and
 * advances the cursor.
 *
 * @param {SmartBuffer} sBuff
 *
 * @return {string}
 */
exports.getDomainFromSmartBuffer = function(sBuff) {
  let result = '';

  // We expect a series of length charCode pairs, ending when the final length
  // field is a 0. We'll do this by examining a single label at a time.
  let lengthOfCurrentLabel = -1;
  let iteration = 0;
  // Sanity check because while loops are dangerous when faced with external
  // data.
  let maxIterations = 15;
  while (lengthOfCurrentLabel !== 0) {
    if (iteration > maxIterations) {
      throw new Error('Exceeded max iterations, likely malformed data');
    }

    // Get the first length, consuming the first byte of the reader.
    lengthOfCurrentLabel = sBuff.readUInt8();

    if (lengthOfCurrentLabel > MAX_LABEL_LENGTH) {
      // This check will try to alert callers when they have an off by one or
      // other error in the byte array.
      throw new Error(
        'Got a label length greater than the max: ' + lengthOfCurrentLabel
      );
    }

    // NB: We could maybe be using sBurr.readString(), but I am going to keep
    // this logic in hopes that if we move to support unicode this will be more
    // straightforward.
    for (let i = 0; i < lengthOfCurrentLabel; i++) {
      let currentCharCode = sBuff.readUInt8();
      let currentChar = String.fromCharCode(currentCharCode);
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
 * @return {Buffer}
 */
exports.getIpStringAsBuffer = function(ipAddress) {
  let parts = ipAddress.split('.');

  if (parts.length !== 4) {
    throw new Error('IP string does not have 4 parts: ' + ipAddress);
  }

  let sBuff = new SmartBuffer();
  
  parts.forEach(part => {
    let intValue = parseInt(part);
    if (intValue < 0 || intValue > 255) {
      throw new Error('A byte of the IP address < 0 or > 255: ' + ipAddress);
    }
    sBuff.writeUInt8(intValue);
  });

  return sBuff.toBuffer();
};

/**
 * Recover an IP address in string representation from the ByteArrayReader.
 *
 * @param {SmartBuffer} sBuff
 *
 * @return {string}
 */
exports.getIpStringFromSmartBuffer = function(sBuff) {
  // We assume a single byte representing each string.
  let parts = [];

  let numParts = 4;
  for (let i = 0; i < numParts; i++) {
    let intValue = sBuff.readUInt8();
    let stringValue = intValue.toString();
    parts.push(stringValue);
  }

  let result = parts.join('.');
  return result;
};
