'use strict';

const test = require('tape');
const sinon = require('sinon');
require('sinon-as-promised');

let message = require('../../../app/scripts/webrtc/message');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/message')
  ];
  message = require('../../../app/scripts/webrtc/message');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}

test('creates correctly with legal args', function(t) {
  let typeList = 'list';
  let typeFile = 'file'; 
  let channelName = 'channel_123';

  message.createChannelName = sinon.stub().returns(channelName);

  let msg = new message.createMessage(typeList);

  t.equal(msg.type, typeList);
  t.equal(msg.channelName, channelName);

  msg = new message.createMessage(typeFile);
  t.equal(msg.type, typeFile);

  end(t);
});

test('createMessage throws with invalid type', function(t) {
  let invalid = function() {
    new message.createMessage('fake-type');
  };

  t.throws(invalid, Error);
  end(t);
});

test('createListMessage returns type list', function(t) {
  let actual = message.createListMessage();
  t.equal(actual.type, message.TYPE_LIST);
  end(t);
});

test('createDigestMessage returns type digest', function(t) {
  let actual = message.createDigestMessage();
  t.equal(actual.type, message.TYPE_DIGEST);
  end(t);
});

test('createBloomFilterMessage returns type bloom filter', function(t) {
  let actual = message.createBloomFilterMessage();
  t.equal(actual.type, message.TYPE_BLOOM_FILTER);
  end(t);
});

test('createCachedPageMessage returns correct type', function(t) {
  let href = 'http://nyt.com';
  let actual = message.createCachedPageMessage(href);
  t.true(message.isCachedPage(actual));
  t.deepEqual(actual.request, { href });
  end(t);
});

test('createFileMessage returns with request information', function(t) {
  let path = 'path/to/file.mhtml';
  let actual = message.createFileMessage(path);

  t.equal(actual.type, message.TYPE_FILE);
  t.equal(actual.request.accessPath, path);
  end(t);
});

test('isList correct', function(t) {
  let obj = {};

  t.false(message.isList(obj));
  obj.type = 'fake';
  t.false(message.isList(obj));

  obj.type = message.TYPE_LIST;
  t.true(message.isList(obj));

  end(t);
});

test('isFile correct', function(t) {
  let obj = {};

  t.false(message.isList(obj));
  obj.type = 'fake';
  t.false(message.isList(obj));

  obj.type = message.TYPE_FILE;
  t.true(message.isFile(obj));

  end(t);
});

test('isDigest correct', function(t) {
  let obj = {};

  t.false(message.isDigest(obj));
  obj.type = 'fake';
  t.false(message.isDigest(obj));

  obj.type = message.TYPE_DIGEST;
  t.true(message.isDigest(obj));

  end(t);
});

test('isBloomFilter correct', function(t) {
  let obj = {};

  t.false(message.isBloomFilter(obj));
  obj.type = 'fake';
  t.false(message.isBloomFilter(obj));

  obj.type = message.TYPE_BLOOM_FILTER;
  t.true(message.isBloomFilter(obj));

  end(t);
});

test('isCachedPage correct', function(t) {
  let obj = {};

  t.false(message.isCachedPage(obj));
  obj.type = 'fake';
  t.false(message.isCachedPage(obj));

  obj.type = message.TYPE_CACHED_PAGE;
  t.true(message.isCachedPage(obj));

  end(t);
});
