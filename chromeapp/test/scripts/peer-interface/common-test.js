'use strict';
var test = require('tape');
require('sinon-as-promised');

var common = require('../../../app/scripts/peer-interface/common');

function createExpectedList(ipaddr, port, listUrl) {
  return {
    ipAddress: ipaddr,
    port: port,
    listUrl: listUrl
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
  var ipaddr = '1.2.3.4';
  var port = 1111;
  var listUrl = 'list';
  var expected = createExpectedList(ipaddr, port, listUrl);

  var actual = common.createListParams(ipaddr, port, listUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams correct when just listUrl present', function(t) {
  var listUrl = 'http://1.2.3.4:1111';
  var expected = createExpectedList('1.2.3.4', 1111, listUrl);
  var actual = common.createListParams(null, null, listUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams correct when no listUrl present', function(t) {
  var ipaddr = '8.7.6.5';
  var port = 55;
  var expected = createExpectedList(ipaddr, port, null);
  var actual = common.createListParams(ipaddr, port, null);
  t.deepEqual(actual, expected);
  t.end();
});

test('createListParams throws if try to interpolate bad url', function(t) {
  var shouldThrow = function() {
    // No port should throw
    common.createListParams(null, null, 'http://1.2.3.4');
  };
  t.throws(shouldThrow);
  t.end();
});

test('createFileParams correct when all present', function(t) {
  var ipaddr = '1.2.3.4';
  var port = 1111;
  var fileUrl = 'file';
  var expected = createExpectedFile(ipaddr, port, fileUrl);

  var actual = common.createFileParams(ipaddr, port, fileUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams correct when just fileUrl present', function(t) {
  var fileUrl = 'http://1.2.3.4:1111';
  var expected = createExpectedFile('1.2.3.4', 1111, fileUrl);
  var actual = common.createFileParams(null, null, fileUrl);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams correct when no fileUrl present', function(t) {
  var ipaddr = '8.7.6.5';
  var port = 55;
  var expected = createExpectedFile(ipaddr, port, null);
  var actual = common.createFileParams(ipaddr, port, null);
  t.deepEqual(actual, expected);
  t.end();
});

test('createFileParams throws if try to interpolate bad url', function(t) {
  var shouldThrow = function() {
    // No port should throw
    common.createFileParams(null, null, 'http://1.2.3.4');
  };
  t.throws(shouldThrow);
  t.end();
});
