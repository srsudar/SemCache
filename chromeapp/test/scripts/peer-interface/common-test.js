'use strict';

const test = require('tape');
require('sinon-as-promised');

let common = require('../../../app/scripts/peer-interface/common');

function createExpectedList(ipaddr, port, listUrl, digestUrl, bloomUrl) {
  return {
    ipAddress: ipaddr,
    port: port,
    listUrl: listUrl,
    digestUrl: digestUrl,
    bloomUrl: bloomUrl
  };
}

function createExpectedFile(ipaddr, port, fileUrl) {
  return {
    ipAddress: ipaddr,
    port: port,
    fileUrl: fileUrl
  };
}

test('createListParams correct when all present', function(t) {
  let ipaddr = '1.2.3.4';
  let port = 1111;
  let listUrl = 'list';
  let digestUrl = 'http://1.2.3.4:1111/page_digest';
  let bloomUrl = 'http://1.2.3.4:1111/bloom_filter';
  let expected = createExpectedList(
    ipaddr, port, listUrl, digestUrl, bloomUrl
  );

  let actual = common.createListParams(ipaddr, port, listUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams correct when just listUrl present', function(t) {
  let listUrl = 'http://1.2.3.4:1111';
  let digestUrl = 'http://1.2.3.4:1111/page_digest';
  let bloomUrl = 'http://1.2.3.4:1111/bloom_filter';
  let expected = createExpectedList(
    '1.2.3.4', 1111, listUrl, digestUrl, bloomUrl
  );
  let actual = common.createListParams(null, null, listUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams correct when no listUrl present', function(t) {
  let ipaddr = '8.7.6.5';
  let port = 55;
  let digestUrl = 'http://8.7.6.5:55/page_digest';
  let bloomUrl = 'http://8.7.6.5:55/bloom_filter';
  let expected = createExpectedList(ipaddr, port, null, digestUrl, bloomUrl);
  let actual = common.createListParams(ipaddr, port, null);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams throws if try to interpolate bad url', function(t) {
  let shouldThrow = function() {
    // No port should throw
    common.createListParams(null, null, 'http://1.2.3.4');
  };
  t.throws(shouldThrow);
  t.end();
});

test('createFileParams correct when all present', function(t) {
  let ipaddr = '1.2.3.4';
  let port = 1111;
  let fileUrl = 'file';
  let expected = createExpectedFile(ipaddr, port, fileUrl);

  let actual = common.createFileParams(ipaddr, port, fileUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams correct when just fileUrl present', function(t) {
  let fileUrl = 'http://1.2.3.4:1111';
  let expected = createExpectedFile('1.2.3.4', 1111, fileUrl);
  let actual = common.createFileParams(null, null, fileUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams correct when no fileUrl present', function(t) {
  let ipaddr = '8.7.6.5';
  let port = 55;
  let expected = createExpectedFile(ipaddr, port, null);
  let actual = common.createFileParams(ipaddr, port, null);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams throws if try to interpolate bad url', function(t) {
  let shouldThrow = function() {
    // No port should throw
    common.createFileParams(null, null, 'http://1.2.3.4');
  };
  t.throws(shouldThrow);
  t.end();
});
