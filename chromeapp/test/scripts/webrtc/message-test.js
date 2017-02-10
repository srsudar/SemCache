'use strict';
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var message = require('../../../app/scripts/webrtc/message');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetMessage() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/message')
  ];
  message = require('../../../app/scripts/webrtc/message');
}

test('creates correctly with legal args', function(t) {
  var typeList = 'list';
  var typeFile = 'file'; 
  var channelName = 'channel_123';

  message.createChannelName = sinon.stub().returns(channelName);

  var msg = new message.createMessage(typeList);

  t.equal(msg.type, typeList);
  t.equal(msg.channelName, channelName);

  var msg = new message.createMessage(typeFile);
  t.equal(msg.type, typeFile);

  resetMessage();
  t.end();
});

test('createMessage throws with invalid type', function(t) {
  var invalid = function() {
    new message.createMessage('fake-type');
  };

  t.throws(invalid, Error);
  t.end();
});

test('createListMessage returns type list', function(t) {
  var actual = message.createListMessage();
  t.equal(actual.type, message.TYPE_LIST);
  t.end();
});

test('createFileMessage returns with request information', function(t) {
  var path = 'path/to/file.mhtml';
  var actual = message.createFileMessage(path);

  t.equal(actual.type, message.TYPE_FILE);
  t.equal(actual.request.accessPath, path);
  t.end();
});

test('isList correct', function(t) {
  var obj = {};

  t.false(message.isList(obj));
  obj.type = 'fake';
  t.false(message.isList(obj));

  obj.type = message.TYPE_LIST;
  t.true(message.isList(obj));

  t.end();
});

test('isFile correct', function(t) {
  var obj = {};

  t.false(message.isList(obj));
  obj.type = 'fake';
  t.false(message.isList(obj));

  obj.type = message.TYPE_FILE;
  t.true(message.isFile(obj));

  t.end();
});
