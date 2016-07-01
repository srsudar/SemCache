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


test('serialize outputs correct bytes for example', function(t) {
  // This is the domain name example given in the Stevens TCP/IP book.
  var domainName = 'gemini.tuc.noao.edu';

  var expected = getByteArrayForExample();
  var actual = dnsUtil.getDomainAsByteArray(domainName);

  var er = expected.getReader();
  var ar = expected.getReader();

  t.deepEqual(actual, expected);

  t.end();
});

test('deserialize returns correctly from example', function(t) {
  var startBytes = getByteArrayForExample();

  var expected = EXAMPLE_URL;
  var actual = dnsUtil.getByteArrayAsDomain(startBytes);

  t.equal(actual, expected);

  t.end();
});
