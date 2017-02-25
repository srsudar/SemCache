'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var chunkingChannel = require('../../../app/scripts/webrtc/chunking-channel');
var protocol = require('../../../app/scripts/webrtc/protocol');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetChunkingChannel() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/chunking-channel')
  ];
  chunkingChannel = require('../../../app/scripts/webrtc/chunking-channel');
}

/**
 * Create a message event as sent to channel.onmessage.
 */
function createMessageEvent(data) {
  return { data: data };
}

/**
 * Wraps each chunk in a call to protocol.createSuccessMessage();
 *
 * @param {Array.<Chunk>} chunks
 *
 * @return {Array.<ProtocolMessage>}
 */
function wrapChunksAsSuccessMsg(chunks) {
  var result = [];
  chunks.forEach(chunk => {
    result.push(protocol.createSuccessMessage(chunk).asBuffer());
  });
  return result;
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t'); }
  t.end();
  resetChunkingChannel();
}

/**
 * Helper for testing the Client
 *
 * @param {Tape} t
 * @param {boolean} cacheChunks
 * @param {Array.<Buffer>} expectedChunks
 */
function assertClientHelper(t, cacheChunks, expectedChunks) {
  var rawConnection = sinon.stub();
  var channel = sinon.stub();
  channel.channelName = 'fooBar';
  rawConnection.createDataChannel = sinon.stub().returns(channel);
  var msg = { channelName: channel.channelName };
  var msgBin = Buffer.from(JSON.stringify(msg));
  var streamInfo = chunkingChannel.createStreamInfo(expectedChunks.length);
  var streamInfoBin = Buffer.from(JSON.stringify(streamInfo));

  // We expect first a request to be sent, and then a continue method for each
  // chunk.
  var expectedSent = [msgBin].concat(
    Array(expectedChunks.length).fill(
      Buffer.from(JSON.stringify(chunkingChannel.createContinueMessage()))
    )
  );

  var client = new chunkingChannel.Client(rawConnection, cacheChunks, msg);

  var sentArgs = [];
  // We need to play the role of the Server and respond appropriately.
  channel.send = function(sendArg) {
    sentArgs.push(sendArg);
    
    if (sentArgs.length === 1) {
      // First call. We're expected to reply with a streaminfo.
      var streamInfoMsg = protocol.createSuccessMessage(streamInfoBin);
      channel.onmessage(createMessageEvent(streamInfoMsg.asBuffer()));
      return;
    }

    // Otherwise, create a message and send a chunk. Note that this isn't a
    // perfect unit test, as we're relying on the protocol module.
    var chunk = expectedChunks[sentArgs.length - 2];
    var msg = protocol.createSuccessMessage(chunk);
    channel.onmessage(createMessageEvent(msg.asBuffer()));
    // channel.onmessage(createMessageEvent(expectedChunks[sentArgs.length - 2]));
  };

  var chunks = [];
  client.on('chunk', chunk => {
    chunks.push(chunk);
  });

  client.on('complete', result => {
    t.deepEqual(
      rawConnection.createDataChannel.args[0][0], channel.channelName
    );
    t.deepEqual(sentArgs, expectedSent);
    t.deepEqual(chunks, expectedChunks);
    if (cacheChunks) {
      t.deepEqual(result, Buffer.concat(expectedChunks));
    } else {
      t.equal(result, undefined);
    }
    end(t);
  });

  client.start();
  channel.onopen();
}

test('client emits chunks and complete events when cached', function(t) {
  var expectedChunks = [
    Buffer.from('Hello'),
    Buffer.from('There'),
    Buffer.from('Camel')
  ];
  assertClientHelper(t, true, expectedChunks);
});

test('client does not cache if cacheChunks false', function(t) {
  var expectedChunks = [
    Buffer.from('up'),
    Buffer.from('do'),
    Buffer.from('no'),
    Buffer.from('if')
  ];
  assertClientHelper(t, false, expectedChunks);
});

test('client calls handleErrorMessage if gets server error', function(t) {
  // The client should respond to a server error by invoking the error handling
  // logic method
  var rawConnection = sinon.stub();
  var channel = sinon.stub();
  channel.channelName = 'fooBar';
  rawConnection.createDataChannel = sinon.stub().returns(channel);
  var msg = { channelName: channel.channelName };
  var expectedReason = 'something went wrong with the server';
  var errorMsg = protocol.createErrorMessage(expectedReason);

  // The broad setup here is that we want to say we should receive 4 chunks,
  // send 2 chunks, then send a server error.
  var expectedChunks = [
    Buffer.from('hello '),
    Buffer.from('there')
  ];
  var streamInfo = chunkingChannel.createStreamInfo(4);
  var streamInfoBin = Buffer.from(JSON.stringify(streamInfo));

  var client = new chunkingChannel.Client(rawConnection, false, msg);

  var sentArgs = [];
  // We need to play the role of the Server and respond appropriately.
  channel.send = function(sendArg) {
    sentArgs.push(sendArg);

    if (sentArgs.length === 1) {
      // First call. We're expected to reply with a streaminfo.
      var streamInfoMsg = protocol.createSuccessMessage(streamInfoBin);
      channel.onmessage(createMessageEvent(streamInfoMsg.asBuffer()));
      return;
    }

    if (sentArgs.length < 4) {
      // 1 is the stream info, 2 and 3 are chunks
      var chunk = expectedChunks[sentArgs.length - 2];
      var msg = protocol.createSuccessMessage(chunk);
      channel.onmessage(createMessageEvent(msg.asBuffer()));
      return;
    }

    // Otherwise, we create an error message.
    channel.onmessage(createMessageEvent(errorMsg.asBuffer()));
  };

  var chunks = [];
  client.on('chunk', chunk => {
    chunks.push(chunk);
  });

  client.on('complete', () => {
    t.fail('should not trigger complete event');
    end(t);
  });

  client.on('error', actual => {
    t.deepEqual(actual, errorMsg);
    t.deepEqual(chunks, expectedChunks);
    end(t);
  });

  client.start();
  channel.onopen();
});

test('client emits chunks and complete for single chunk', function(t) {
  var expectedChunks = [
    Buffer.from('this is the only chunk')
  ];
  assertClientHelper(t, true, expectedChunks);
});

test('server sends correct chunks to client', function(t) {
  var strToSend = 'abc def ghi jkl';
  var bufferToSend = Buffer.from(strToSend);
  chunkingChannel.CHUNK_SIZE = 4;
  // The messages we expect to be sent. We expect a streamInfo message and then
  // 4 chunks.
  var expectedChunks = [
    Buffer.from('abc '),
    Buffer.from('def '),
    Buffer.from('ghi '),
    Buffer.from('jkl')
  ];
  var expectedSent = [
    Buffer.from(JSON.stringify(chunkingChannel.createStreamInfo(4))),
    expectedChunks[0],
    expectedChunks[1],
    expectedChunks[2],
    expectedChunks[3],
  ];
  expectedSent = wrapChunksAsSuccessMsg(expectedSent);

  var channel = sinon.stub();
  var argsSent = [];
  var numContinuesSent = 0;
  var continueMsgBin = createMessageEvent(
    Buffer.from(JSON.stringify(chunkingChannel.createContinueMessage()))
  );

  channel.send = function(sent) {
    argsSent.push(sent);

    // Make sure we are waiting for acks by communicating between the sending
    // and the onmessage function. -1 because we don't send a continue to get
    // the first message, which is a streaminfo.
    if (numContinuesSent !== argsSent.length - 1) {
      t.fail('did not wait for message before sending chunk');
    }

    if (argsSent.length === expectedSent.length) {
      t.deepEqual(argsSent, expectedSent);

      // Now we want to make sure we can recover the original message.
      var dataChunks = [];
      argsSent.forEach(sentMsg => {
        dataChunks.push(protocol.from(sentMsg).getData());
      });
      // Ignore the first, which is the stream info message.
      dataChunks = dataChunks.slice(1);
      var recoveredString = Buffer.concat(dataChunks).toString();

      t.equal(recoveredString, strToSend);
      end(t);
    } else {
      // Send a continue message.
      numContinuesSent++;
      channel.onmessage(continueMsgBin);
    }
  };

  var server = new chunkingChannel.Server(channel);
  server.sendBuffer(bufferToSend);
});

test('handleErrorMessage emits event', function(t) {
  var expected = { errorReason: 'something went wrong' };
  
  var channelStub = sinon.stub();
  var client = new chunkingChannel.Client(channelStub);

  client.on('error', actual => {
    t.equal(actual, expected);
    end(t);
  });
  
  client.handleErrorMessage(expected);
});

test('sendError sends err to client', function(t) {
  var err = { message: 'could not find the file' };
  var expected = protocol.createErrorMessage(err);

  var channelStub = sinon.stub();
  var sendStub = sinon.stub();
  channelStub.send = sendStub;

  var server = new chunkingChannel.Server(channelStub);
  server.sendError(err);

  t.deepEqual(sendStub.args[0][0], expected.asBuffer());
  end(t);
});
