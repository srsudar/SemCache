'use strict';

const test = require('tape');
const dnsUtil = require('../../../app/scripts/dnssd/dns-util');
const byteArray = require('../../../app/scripts/dnssd/byte-array');

const EXAMPLE_URL = 'gemini.tuc.noao.edu';

/**
 * Return the character as a char code.
 */
function getCharAsCode(char) {
  return char.charCodeAt(0);
}

/**
 * Serialize and deserialize domain, asserting that they are equivalent. Does
 * not invoke t.end().
 */
function assertCanRecoverDomainHelper(domain, t) {
  let byteArray = dnsUtil.getDomainAsByteArray(domain);
  let actual = dnsUtil.getDomainFromByteArray(byteArray);
  t.equal(actual, domain);
}

/**
 * Asserts that ipString causes getIpStringAsByteArray to throw an Error. Does
 * not invoke t.end().
 */
function assertIllegalIpThrows(illegalIp, t) {
  let shouldThrow = function() {
    dnsUtil.getIpStringAsByteArray(illegalIp);
  };

  t.throws(shouldThrow, Error);
}

/**
 * Return the byte array for the EXAMPLE_URL. Created by hand.
 */
function getByteArrayForExample() {
  // Construct our expected by hand, according to the layout in Stevens.
  let expected = new byteArray.ByteArray();
  // gemini is 6 bytes long
  expected.push(6, 1);
  expected.push(getCharAsCode('g'), 1);
  expected.push(getCharAsCode('e'), 1);
  expected.push(getCharAsCode('m'), 1);
  expected.push(getCharAsCode('i'), 1);
  expected.push(getCharAsCode('n'), 1);
  expected.push(getCharAsCode('i'), 1);

  // tuc is 3 bytes
  expected.push(3, 1);
  expected.push(getCharAsCode('t'), 1);
  expected.push(getCharAsCode('u'), 1);
  expected.push(getCharAsCode('c'), 1);

  // noao is 4 bytes long
  expected.push(4, 1);
  expected.push(getCharAsCode('n'), 1);
  expected.push(getCharAsCode('o'), 1);
  expected.push(getCharAsCode('a'), 1);
  expected.push(getCharAsCode('o'), 1);

  // edu is 3 bytes long
  expected.push(3, 1);
  expected.push(getCharAsCode('e'), 1);
  expected.push(getCharAsCode('d'), 1);
  expected.push(getCharAsCode('u'), 1);

  // terminate with a 0 byte to indicate no additional labels
  expected.push(0, 1);

  return expected;
}

test('getDomainAsByteArray outputs correct bytes for example', function(t) {
  // This is the domain name example given in the Stevens TCP/IP book.
  let domainName = 'gemini.tuc.noao.edu';

  let expected = getByteArrayForExample();
  let actual = dnsUtil.getDomainAsByteArray(domainName);

  t.deepEqual(actual, expected);

  t.end();
});

test('getDomainFromByteArray produces correct domain', function(t) {
  let startBytes = getByteArrayForExample();

  let expected = EXAMPLE_URL;
  let actual = dnsUtil.getDomainFromByteArray(startBytes);

  t.equal(actual, expected);

  t.end();
});

test('getDomainFromByteArray respects start bytes', function(t) {
  let startBytes = getByteArrayForExample();

  let expected = EXAMPLE_URL;

  // We'll push two dummy bytes.
  let numDummyBytes = 2;
  let extraBytes = new byteArray.ByteArray(startBytes.length + numDummyBytes);
  extraBytes.push(2, 1);
  extraBytes.push(3, 1);
  extraBytes.append(startBytes);

  let actual = dnsUtil.getDomainFromByteArray(extraBytes, numDummyBytes);

  t.equal(actual, expected);

  t.end();
});

test('serialize and deserialize tiny domain', function(t) {
  let domain = 't.co';
  assertCanRecoverDomainHelper(domain, t);
  t.end();
});

test('serialize and deserialize huge domain', function(t) {
  // This is a real URL.
  let domain =
    'www.thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com';
  assertCanRecoverDomainHelper(domain, t);
  t.end();
});

test('getDomainAsByteArray throws with label >63 characters', function(t) {
  let invalidLabel = 'a'.repeat(64);
  let invalidDomain = 'www.' + invalidLabel + '.com';
  let shouldThrow = function() {
    dnsUtil.getDomainAsByteArray(invalidDomain);
  };
  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromByteArray throws with label >63 characters', function(t) {
  let byteArr = new byteArray.ByteArray();

  // We will break it with www.a*64.com
  // We're going to populate the byte array by hand to not rely on the
  // serialization implementation.
  byteArr.push(3, 1);
  byteArr.push(getCharAsCode('w'), 1);
  byteArr.push(getCharAsCode('w'), 1);
  byteArr.push(getCharAsCode('w'), 1);

  for (let i = 0; i < 64; i++) {
    byteArr.push(getCharAsCode('a'), 1);
  }

  byteArr.push(3, 1);
  byteArr.push(getCharAsCode('c'), 1);
  byteArr.push(getCharAsCode('o'), 1);
  byteArr.push(getCharAsCode('m'), 1);

  let shouldThrow = function() {
    dnsUtil.getDomainFromByteArray(byteArray);
  };

  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromByteArray throws if first arg not ByteArray', function(t) {
  let shouldThrow = function() {
    dnsUtil.getDomainFromByteArray('illegal', 0);
  };
  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromByteArrayReader returns with correct offset', function(t) {
  // We want the reader to start at the current reader position, recover the
  // domain, and leave the reader at the correct offset.
  let startBytes = getByteArrayForExample();

  let extraBytes = new byteArray.ByteArray();

  let firstValue = 3;
  let lastValue = 8;
  extraBytes.push(firstValue, 1);
  extraBytes.append(startBytes);
  extraBytes.push(lastValue, 1);

  let reader = extraBytes.getReader();

  reader.getValue(1);

  let recoveredDomain = dnsUtil.getDomainFromByteArrayReader(reader);

  let recoveredLastValue = reader.getValue(1);

  t.equal(recoveredDomain, EXAMPLE_URL);
  t.equal(recoveredLastValue, lastValue);
  
  t.end();
});

test('getIpStringAsByteArray throws if >4 parts', function(t) {
  let illegalIp = '1.2.3.4.5';
  assertIllegalIpThrows(illegalIp, t);
  t.end();
});

test('getIpStringAsByteArray throws if <4 parts', function(t) {
  let illegalIp = '1.2.3';
  assertIllegalIpThrows(illegalIp, t);
  t.end();
});

test('getIpStringAsByteArray throws with part >255 and <0', function(t) {
  let tooBig = '1.2.3.256';
  let tooSmall = '1.2.3.-1';

  assertIllegalIpThrows(tooBig, t);
  assertIllegalIpThrows(tooSmall, t);

  t.end();
});

test('getIpStringAsByteArray for common IP address', function(t) {
  let ipAddress = '155.33.17.68';

  let actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  let expected = new byteArray.ByteArray();
  expected.push(155, 1);
  expected.push(33, 1);
  expected.push(17, 1);
  expected.push(68, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsByteArray for 255.255.255.255', function(t) {
  let ipAddress = '255.255.255.255';

  let actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  let expected = new byteArray.ByteArray();
  expected.push(255, 1);
  expected.push(255, 1);
  expected.push(255, 1);
  expected.push(255, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsByteArray for 0.0.0.0', function(t) {
  let ipAddress = '0.0.0.0';

  let actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  let expected = new byteArray.ByteArray();
  expected.push(0, 1);
  expected.push(0, 1);
  expected.push(0, 1);
  expected.push(0, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for 255.255.255.255', function(t) {
  let expected = '255.255.255.255';

  let byteArr = new byteArray.ByteArray();
  byteArr.push(255, 1);
  byteArr.push(255, 1);
  byteArr.push(255, 1);
  byteArr.push(255, 1);

  let actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for 0.0.0.0', function(t) {
  let expected = '0.0.0.0';

  let byteArr = new byteArray.ByteArray();
  byteArr.push(0, 1);
  byteArr.push(0, 1);
  byteArr.push(0, 1);
  byteArr.push(0, 1);

  let actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for common IP address', function(t) {
  let expected = '155.33.17.68';

  let byteArr = new byteArray.ByteArray();
  byteArr.push(155, 1);
  byteArr.push(33, 1);
  byteArr.push(17, 1);
  byteArr.push(68, 1);

  let actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});
