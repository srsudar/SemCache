'use strict';

const test = require('tape');

const SmartBuffer = require('smart-buffer').SmartBuffer;

const dnsUtil = require('../../../app/scripts/dnssd/dns-util');


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
  let buff = dnsUtil.getDomainAsBuffer(domain);
  let actual = dnsUtil.getDomainFromSmartBuffer(SmartBuffer.fromBuffer(buff));
  t.equal(actual, domain);
}

/**
 * Asserts that ipString causes getIpStringAsBuffer to throw an Error. Does
 * not invoke t.end().
 */
function assertIllegalIpThrows(illegalIp, t) {
  let shouldThrow = function() {
    dnsUtil.getIpStringAsBuffer(illegalIp);
  };

  t.throws(shouldThrow, Error);
}

function getSmartBufferFor255s() {
  let sBuff = new SmartBuffer();
  sBuff.writeUInt8(255);
  sBuff.writeUInt8(255);
  sBuff.writeUInt8(255);
  sBuff.writeUInt8(255);
  return sBuff;
}

function getSmartBufferForCommonIP() {
  let sBuff = new SmartBuffer();
  sBuff.writeUInt8(155);
  sBuff.writeUInt8(33);
  sBuff.writeUInt8(17);
  sBuff.writeUInt8(68);
  return sBuff;
}

function getSmartBufferFor0s() {
  let sBuff = new SmartBuffer();
  sBuff.writeUInt8(0);
  sBuff.writeUInt8(0);
  sBuff.writeUInt8(0);
  sBuff.writeUInt8(0);
  return sBuff;
}

/**
 * Return the Buffer for the EXAMPLE_URL. Created by hand.
 */
function getBufferForExample() {
  // Construct our expected by hand, according to the layout in Stevens.
  let sBuff = new SmartBuffer();

  // gemini is 6 bytes long
  sBuff.writeUInt8(6);
  sBuff.writeUInt8(getCharAsCode('g'));
  sBuff.writeUInt8(getCharAsCode('e'));
  sBuff.writeUInt8(getCharAsCode('m'));
  sBuff.writeUInt8(getCharAsCode('i'));
  sBuff.writeUInt8(getCharAsCode('n'));
  sBuff.writeUInt8(getCharAsCode('i'));

  // tuc is 3 bytes
  sBuff.writeUInt8(3);
  sBuff.writeUInt8(getCharAsCode('t'));
  sBuff.writeUInt8(getCharAsCode('u'));
  sBuff.writeUInt8(getCharAsCode('c'));

  // noao is 4 bytes long
  sBuff.writeUInt8(4);
  sBuff.writeUInt8(getCharAsCode('n'));
  sBuff.writeUInt8(getCharAsCode('o'));
  sBuff.writeUInt8(getCharAsCode('a'));
  sBuff.writeUInt8(getCharAsCode('o'));

  // edu is 3 bytes long
  sBuff.writeUInt8(3);
  sBuff.writeUInt8(getCharAsCode('e'));
  sBuff.writeUInt8(getCharAsCode('d'));
  sBuff.writeUInt8(getCharAsCode('u'));

  // terminate with a 0 byte to indicate no additional labels
  sBuff.writeUInt8(0);

  return sBuff.toBuffer();
}

test('getDomainAsBuffer outputs correct bytes for example', function(t) {
  // This is the domain name example given in the Stevens TCP/IP book.
  let domainName = 'gemini.tuc.noao.edu';

  let expected = getBufferForExample();
  let actual = dnsUtil.getDomainAsBuffer(domainName);

  t.deepEqual(actual, expected);

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

test('getDomainAsBuffer throws with label >63 characters', function(t) {
  let invalidLabel = 'a'.repeat(64);
  let invalidDomain = 'www.' + invalidLabel + '.com';
  let shouldThrow = function() {
    dnsUtil.getDomainAsBuffer(invalidDomain);
  };
  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromSmartBuffer throws with label >63 characters', function(t) {
  let sBuff = new SmartBuffer();

  // We will break it with www.a*64.com
  // We're going to populate the Buffer by hand to not rely on the
  // serialization implementation.
  sBuff.writeUInt8(3);
  sBuff.writeUInt8(getCharAsCode('w'));
  sBuff.writeUInt8(getCharAsCode('w'));
  sBuff.writeUInt8(getCharAsCode('w'));

  for (let i = 0; i < 64; i++) {
    sBuff.writeUInt8(getCharAsCode('a'), 1);
  }

  sBuff.writeUInt8(3);
  sBuff.writeUInt8(getCharAsCode('c'));
  sBuff.writeUInt8(getCharAsCode('o'));
  sBuff.writeUInt8(getCharAsCode('m'));

  let shouldThrow = function() {
    dnsUtil.getDomainFromSmartBuffer(sBuff);
  };

  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromSmartBuffer throws if arg not SmartBuffer', function(t) {
  let shouldThrow = function() {
    dnsUtil.getDomainFromSmartBuffer('illegal', 0);
  };
  t.throws(shouldThrow, Error);
  t.end();
});

test('getDomainFromSmartBuffer returns correct domain', function(t) {
  // We want the reader to start at the current reader position, recover the
  // domain, and leave the reader at the correct offset.
  let buff = getBufferForExample();

  let expected = EXAMPLE_URL;

  let actual = dnsUtil.getDomainFromSmartBuffer(SmartBuffer.fromBuffer(buff));

  t.deepEqual(actual, expected);
  
  t.end();
});

test('getIpStringAsBuffer throws if >4 parts', function(t) {
  let illegalIp = '1.2.3.4.5';
  assertIllegalIpThrows(illegalIp, t);
  t.end();
});

test('getIpStringAsBuffer throws if <4 parts', function(t) {
  let illegalIp = '1.2.3';
  assertIllegalIpThrows(illegalIp, t);
  t.end();
});

test('getIpStringAsBuffer throws with part >255 and <0', function(t) {
  let tooBig = '1.2.3.256';
  let tooSmall = '1.2.3.-1';

  assertIllegalIpThrows(tooBig, t);
  assertIllegalIpThrows(tooSmall, t);

  t.end();
});

test('getIpStringAsBuffer for common IP address', function(t) {
  let ipAddress = '155.33.17.68';

  let actual = dnsUtil.getIpStringAsBuffer(ipAddress);
  let expected = getSmartBufferForCommonIP().toBuffer();

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsBuffer for 255.255.255.255', function(t) {
  let ipAddress = '255.255.255.255';

  let actual = dnsUtil.getIpStringAsBuffer(ipAddress);
  let expected = getSmartBufferFor255s().toBuffer();

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringAsBuffer for 0.0.0.0', function(t) {
  let ipAddress = '0.0.0.0';

  let actual = dnsUtil.getIpStringAsBuffer(ipAddress);
  let expected = getSmartBufferFor0s().toBuffer();

  t.deepEqual(actual, expected);

  t.end();
});

test('getIpStringFromSmartBuffer for 255.255.255.255', function(t) {
  let expected = '255.255.255.255';

  let sBuff = getSmartBufferFor255s();
  let actual = dnsUtil.getIpStringFromSmartBuffer(sBuff);

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromSmartBuffer for 0.0.0.0', function(t) {
  let expected = '0.0.0.0';

  let sBuff = getSmartBufferFor0s();
  let actual = dnsUtil.getIpStringFromSmartBuffer(sBuff);

  t.equal(actual, expected);

  t.end();
});

test('getIpStringFromSmartBuffer for common IP address', function(t) {
  let expected = '155.33.17.68';

  let sBuff = getSmartBufferForCommonIP();
  let actual = dnsUtil.getIpStringFromSmartBuffer(sBuff);

  t.equal(actual, expected);

  t.end();
});
