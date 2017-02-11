'use strict';
var Buffer = require('buffer').Buffer;
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var chunkingChannel = require('../../../app/scripts/webrtc/chunking-channel');

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
      channel.onmessage(createMessageEvent(streamInfoBin));
      return;
    }

    // Otherwise, we just send a chunk.
    channel.onmessage(createMessageEvent(expectedChunks[sentArgs.length - 2]));
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
    t.end();
    resetChunkingChannel();
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
      t.equal(Buffer.concat(expectedChunks).toString(), strToSend);
      resetChunkingChannel();
      t.end();
    } else {
      // Send a continue message.
      numContinuesSent++;
      channel.onmessage(continueMsgBin);
    }
  };

  var server = new chunkingChannel.Server(channel);
  server.sendBuffer(bufferToSend);
});
