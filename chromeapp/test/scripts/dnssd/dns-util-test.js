'use strict';

var test = require('tape');
var dnsUtil = require('../../../app/scripts/dnssd/dns-util');
var byteArray = require('../../../app/scripts/dnssd/byte-array-sem');

var EXAMPLE_URL = 'gemini.tuc.noao.edu';

/**
 * Return the character as a char code.
 */
function getCharAsCode(char) {
  return char.charCodeAt(0);
}

/**
 * Return the byte array for the EXAMPLE_URL. Created by hand.
 */
function getByteArrayForExample() {
  // Construct our expected by hand, according to the layout in Stevens.
  var expected = new byteArray.ByteArray();
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
  var domainName = 'gemini.tuc.noao.edu';

  var expected = getByteArrayForExample();
  var actual = dnsUtil.getDomainAsByteArray(domainName);

  t.deepEqual(actual, expected);

  t.end();
});

test('getDomainFromByteArray produces correct domain', function(t) {
  var startBytes = getByteArrayForExample();

  var expected = EXAMPLE_URL;
  var actual = dnsUtil.getDomainFromByteArray(startBytes);

  t.equal(actual, expected);

  t.end();
});

test('getDomainFromByteArray respects start bytes', function(t) {
  var startBytes = getByteArrayForExample();

  var expected = EXAMPLE_URL;

  // We'll push two dummy bytes.
  var numDummyBytes = 2;
  var extraBytes = new byteArray.ByteArray(startBytes.length + numDummyBytes);
  extraBytes.push(2, 1);
  extraBytes.push(3, 1);
  extraBytes.append(startBytes);

  var actual = dnsUtil.getDomainFromByteArray(extraBytes, numDummyBytes);

  t.equal(actual, expected);

  t.end();
});

test('getDomainFromByteArrayReader returns with correct offset', function(t) {
  // We want the reader to start at the current reader position, recover the
  // domain, and leave the reader at the correct offset.
  var startBytes = getByteArrayForExample();

  var extraBytes = new byteArray.ByteArray();

  var firstValue = 3;
  var lastValue = 8;
  extraBytes.push(firstValue, 1);
  extraBytes.append(startBytes);
  extraBytes.push(lastValue, 1);

  var reader = extraBytes.getReader();

  reader.getValue(1);

  var recoveredDomain = dnsUtil.getDomainFromByteArrayReader(reader);

  var recoveredLastValue = reader.getValue(1);

  t.equal(recoveredDomain, EXAMPLE_URL);
  t.equal(recoveredLastValue, lastValue);
  
  t.end();
});

test('getIpStringAsByteArray for common IP address', function(t) {
  var ipAddress = '155.33.17.68';

  var actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  var expected = new byteArray.ByteArray();
  expected.push(155, 1);
  expected.push(33, 1);
  expected.push(17, 1);
  expected.push(68, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsByteArray for 255.255.255.255', function(t) {
  var ipAddress = '255.255.255.255';

  var actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  var expected = new byteArray.ByteArray();
  expected.push(255, 1);
  expected.push(255, 1);
  expected.push(255, 1);
  expected.push(255, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsByteArray for 0.0.0.0', function(t) {
  var ipAddress = '0.0.0.0';

  var actual = dnsUtil.getIpStringAsByteArray(ipAddress);
  
  var expected = new byteArray.ByteArray();
  expected.push(0, 1);
  expected.push(0, 1);
  expected.push(0, 1);
  expected.push(0, 1);

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for 255.255.255.255', function(t) {
  var expected = '255.255.255.255';

  var byteArr = new byteArray.ByteArray();
  byteArr.push(255, 1);
  byteArr.push(255, 1);
  byteArr.push(255, 1);
  byteArr.push(255, 1);

  var actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for 0.0.0.0', function(t) {
  var expected = '0.0.0.0';

  var byteArr = new byteArray.ByteArray();
  byteArr.push(0, 1);
  byteArr.push(0, 1);
  byteArr.push(0, 1);
  byteArr.push(0, 1);

  var actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromByteArrayReader for common IP address', function(t) {
  var expected = '155.33.17.68';

  var byteArr = new byteArray.ByteArray();
  byteArr.push(155, 1);
  byteArr.push(33, 1);
  byteArr.push(17, 1);
  byteArr.push(68, 1);

  var actual = dnsUtil.getIpStringFromByteArrayReader(byteArr.getReader());

  t.equal(actual, expected);

  t.end();
});
