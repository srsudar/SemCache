'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
require('sinon-as-promised');

var protocol = require('../../../app/scripts/webrtc/protocol');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetProtocol() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/protocol')
  ];
  protocol = require('../../../app/scripts/webrtc/protocol');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t to end'); }
  t.end();
  resetProtocol();
}

/**
 * Assert that the msg serializes and deserializes correctly. Performs the
 * assertion and ends the test.
 *
 * @param {ProtocolMessage} msg
 */
function serializeDeserializeHelper(msg, t) {
  var serialized = msg.asBuffer();
  var recovered = protocol.from(serialized);

  t.notEqual(null, serialized);
  t.notEqual(undefined, serialized);
  t.deepEqual(recovered, msg);
  end(t);
}

test('getters return values', function(t) {
  var header = { foo: 'bar' };
  var buff = 'buffer';

  var msg = new protocol.ProtocolMessage(header, buff);

  t.equal(msg.getHeader(), header);
  t.equal(msg.getData(), buff);
  end(t);
});

test('createSuccessMessage correct', function(t) {
  var buff = 'buffer';
  var msg = protocol.createSuccessMessage(buff);
  t.equal(msg.getData(), buff);
  t.equal(msg.getHeader().status, protocol.STATUS_CODES.ok);
  end(t);
});

test('createErorMessage correct', function(t) {
  var reason = 'something went wrong';
  var msg = protocol.createErrorMessage(reason);
  t.deepEqual(msg.getData(), Buffer.alloc(0));
  t.equal(msg.getHeader().status, protocol.STATUS_CODES.error);
  t.equal(msg.getHeader().message, reason);
  end(t);
});

test('createHeader sets status', function(t) {
  var status = 123;
  var expected = { status: status };
  var actual = protocol.createHeader(status);
  t.deepEqual(actual, expected);
  end(t);
});

test('isOk true for status OK', function(t) {
  var okMsg = protocol.createSuccessMessage();
  t.true(okMsg.isOk());
  end(t);
});

test('isOk false for status error', function(t) {
  var errorMsg = protocol.createErrorMessage();
  t.false(errorMsg.isOk());
  end(t);
});

test('getStatusCode null for no header', function(t) {
  var msg = new protocol.ProtocolMessage(null, null);
  var actual = msg.getStatusCode();
  t.equal(actual, null);
  end(t);
});

test('getStatusCode null for no status in header', function(t) {
  var msg = new protocol.ProtocolMessage({}, null);
  var actual = msg.getStatusCode();
  t.equal(actual, null);
  end(t);
});

test('getStatusCode returns status from header', function(t) {
  var msg = protocol.createSuccessMessage('buffer');
  t.equal(msg.getStatusCode(), protocol.STATUS_CODES.ok);
  end(t);
});

test('isError true for status error', function(t) {
  var errorMsg = protocol.createErrorMessage();
  t.true(errorMsg.isError());
  end(t);
});

test('isError true for status ok', function(t) {
  var okMsg = protocol.createSuccessMessage();
  t.false(okMsg.isError());
  end(t);
});

test('serialization correct base case', function(t) {
  // The base case is a header with values in the header and a buffer.
  var buff = Buffer.from('hello there this is fine');
  var header = {
    status: 200,
    metadata: { something: 'else' }
  };
  var msg = new protocol.ProtocolMessage(header, buff);

  serializeDeserializeHelper(msg, t);
});

test('serialization correct no header', function(t) {
  var buff = Buffer.from('nope nope nope');
  var msg = new protocol.ProtocolMessage(null, buff);

  serializeDeserializeHelper(msg, t);
});

test('serialization correct no data', function(t) {
  var header = {
    status: 500,
    msg: 'much trouble is occurring'
  };

  var msg = new protocol.ProtocolMessage(header, null);

  serializeDeserializeHelper(msg, t);
});

test('serialization correct empty buffer', function(t) {
  var buff = Buffer.from('');
  var header = { status: 200 };

  var msg = new protocol.ProtocolMessage(header, buff);

  serializeDeserializeHelper(msg, t);
});
