'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var commonChannel = require('../../../app/scripts/webrtc/common-channel');
var chunkingChannel = require('../../../app/scripts/webrtc/chunking-channel');
var protocol = require('../../../app/scripts/webrtc/protocol');

var Client = chunkingChannel.ChunkingChannelClient;
var Server = chunkingChannel.ChunkingChannelServer;

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
  Client = chunkingChannel.ChunkingChannelClient;
  Server = chunkingChannel.ChunkingChannelServer;
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
 * Test sending a file using the Client/Server combination.
 *
 * This is rather complicated and handles hooking up the channel listeners to
 * each other.
 *
 * @param {Tape} t
 * @param {boolean} cacheChunks
 * @param {Array.<Buffer>} expectedChunks
 */
function integrationHelper(t, cacheChunks, expectedChunks, chunkSize) {
  var buff = Buffer.concat(expectedChunks);
  var rawConnection = sinon.stub();
  const clientChannel = sinon.stub();
  clientChannel.channelName = 'fooBar';
  clientChannel.close = sinon.stub();
  const serverChannel = sinon.stub();
  rawConnection.createDataChannel = sinon.stub().returns(clientChannel);
  var msg = { channelName: clientChannel.channelName };
  var msgBin = Buffer.from(JSON.stringify(msg));

  const client = new Client(rawConnection, cacheChunks, msg);
  const server = new Server(serverChannel, chunkSize);

  // We expect first a request to be sent, and then a continue method for each
  // chunk.
  let continueMsg = commonChannel.BaseClient.createContinueMessage();
  var continueMsgStr = JSON.stringify(continueMsg);
  var continueMsgBin = Buffer.from(continueMsgStr);
  const expectedClientSent = [msgBin];
  expectedClientSent.push(
    ...Array(expectedChunks.length).fill(continueMsgBin)
  );

  // We expect the server to send a stream info and then all the chunks.
  const expectedServerSent = [
    protocol.createSuccessMessage(
      Buffer.from(
        JSON.stringify(
          commonChannel.BaseServer.createStreamInfo(expectedChunks.length)
        )
      )
    )
    .asBuffer()
  ];
  expectedServerSent.push(...wrapChunksAsSuccessMsg(expectedChunks));

  const clientSentArgs = [];
  // We need to play the role of the Server and respond appropriately.
  clientChannel.send = function(sendArg) {
    // Save the sent argument.
    clientSentArgs.push(sendArg);

    if (clientSentArgs.length === 1) {
      // See the explanation below. This is step 3.
      // On the first message we send the buffer.
      server.sendBuffer(buff);
    } else {
      // Pass the message to the server. Wrap the sendArg as an event.
      let event = createMessageEvent(sendArg);
      serverChannel.onmessage(event);
    }
  };

  const serverSentArgs = [];
  serverChannel.send = function(sendArg) {
    serverSentArgs.push(sendArg);

    let event = createMessageEvent(sendArg);
    clientChannel.onmessage(event);
  };

  var chunks = [];
  client.on('chunk', chunk => {
    chunks.push(chunk);
  });

  client.on('complete', result => {
    t.deepEqual(
      rawConnection.createDataChannel.args[0][0], clientChannel.channelName
    );
    t.true(clientChannel.close.calledOnce);

    t.deepEqual(clientSentArgs, expectedClientSent);
    t.deepEqual(serverSentArgs, expectedServerSent); 

    t.deepEqual(chunks, expectedChunks);
    if (cacheChunks) {
      t.deepEqual(result, buff);
    } else {
      t.equal(result, undefined);
    }
    end(t);
  });

  // Initiating the transfer involves several steps. It is complicated a bit by
  // the fact that we are bundling the communicating with the peer with the
  // management of the channel itself. We don't pass the data channel to the
  // Client directly, because we don't want to run the risk of missing the
  // onopen event. So instead we create the channel in the Client rather than
  // just wrapping the channel as we do in the Server. Thus when we are testing
  // it here we are also testing the establishment phase. The steps are as
  // follows:
  //
  // 1. start() is called on the client to create the data channel.
  // 2. onopen() is called on the client's connection. This informs the client
  // that it can send its message to the server requestin a file.
  // 3. The responder gets the request, wraps the channel in a Server, and
  // calls the send() function.

  // 1. start the client.
  client.start();
  // 2. invoke onopen().
  clientChannel.onopen(); 
  // 3. The server calls the send() function in the wrapping function above.
}

test('integration test for cached chunks', function(t) {
  var expectedChunks = [
    Buffer.from('Hello'),
    Buffer.from('There'),
    Buffer.from('Camel')
  ];
  integrationHelper(t, true, expectedChunks, 5);
});

test('integration test for no cached chunks', function(t) {
  var expectedChunks = [
    Buffer.from('up'),
    Buffer.from('do'),
    Buffer.from('no'),
    Buffer.from('if')
  ];
  integrationHelper(t, false, expectedChunks, 2);
});
