'use strict';

const byteArray = require('./byte-array');


/**
 * Various methods for common DNS-related operations.
 */

const MAX_LABEL_LENGTH = 63;
const OCTET_LABEL_LENGTH = 1;

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
 * @return {ByteArray} a ByteArray containing the serialized domain
 */
exports.getDomainAsByteArray = function(domain) {
  let result = new byteArray.ByteArray();

  let labels = domain.split('.');

  labels.forEach(label => {
    let length = label.length;
    if (length > MAX_LABEL_LENGTH) {
      throw new Error('label exceeds max length: ' + label);
    }

    // A label is serialized as a single byte for its length, followed by the
    // character code of each component.
    result.push(length, OCTET_LABEL_LENGTH);

    for (let i = 0; i < label.length; i++) {
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

  let reader = byteArr.getReader(startByte);
  
  let result = exports.getDomainFromByteArrayReader(reader, 0);
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
  let result = '';

  // We expect a series of length charCode pairs, ending when the final length
  // field is a 0. We'll do this by examining a single label at a time.
  let lengthOfCurrentLabel = -1;
  let iteration = 0;
  // Sanity check because while loops are dangerous when faced with outside
  // data.
  let maxIterations = 10;
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

    for (let i = 0; i < lengthOfCurrentLabel; i++) {
      let currentCharCode = reader.getValue(1);
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
 * @return {ByteArray}
 */
exports.getIpStringAsByteArray = function(ipAddress) {
  let parts = ipAddress.split('.');

  if (parts.length !== 4) {
    throw new Error('IP string does not have 4 parts: ' + ipAddress);
  }

  let result = new byteArray.ByteArray();
  
  parts.forEach(part => {
    let intValue = parseInt(part);
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
  let parts = [];

  let numParts = 4;
  for (let i = 0; i < numParts; i++) {
    let intValue = reader.getValue(1);
    let stringValue = intValue.toString();
    parts.push(stringValue);
  }

  let result = parts.join('.');
  return result;
};
