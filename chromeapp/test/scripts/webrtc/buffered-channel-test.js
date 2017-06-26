'use strict';

const test = require('tape');
const sinon = require('sinon');
require('sinon-as-promised');

const commonChannel = require('../../../app/scripts/webrtc/common-channel');

let bufferedChannel = require('../../../app/scripts/webrtc/buffered-channel');
let protocol = require('../../../app/scripts/webrtc/protocol');
let Client = bufferedChannel.BufferedChannelClient;
let Server = bufferedChannel.BufferedChannelServer;

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/buffered-channel')
  ];
  bufferedChannel = require('../../../app/scripts/webrtc/buffered-channel');
  Client = bufferedChannel.BufferedChannelClient;
  Server = bufferedChannel.BufferedChannelServer;
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
  let result = [];
  chunks.forEach(chunk => {
    result.push(protocol.createSuccessMessage(chunk).asBuffer());
  });
  return result;
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t'); }
  t.end();
  reset();
}

/**
 * NB: This is rather ugly duplicated code from chunking-channel test. Much of
 * the setup is the same, but still not ideal.
 *
 * Test sending a file using the Client/Server combination.
 *
 * This is rather complicated and handles hooking up the channel listeners to
 * each other.
 *
 * @param {Tape} t
 * @param {boolean} cacheChunks
 * @param {Array.<Buffer>} expectedChunks
 */
function integrationHelper(
  t,
  cacheChunks,
  expectedChunks,
  chunkSize,
  bufferLowThreshold,
  bufferFullThreshold
) {
  let buff = Buffer.concat(expectedChunks);
  let rawConnection = sinon.stub();
  const clientChannel = sinon.stub();
  clientChannel.channelName = 'fooBar';
  clientChannel.close = sinon.stub();
  
  const serverChannel = sinon.stub();
  serverChannel.bufferedAmount = 0;
  const removeEventListenerStub = sinon.stub();
  serverChannel.removeEventListener = removeEventListenerStub;

  rawConnection.createDataChannel = sinon.stub().returns(clientChannel);
  let startMsg = { channelName: clientChannel.channelName };
  let startMsgBin = Buffer.from(JSON.stringify(startMsg));

  const client = new Client(rawConnection, cacheChunks, startMsg);
  const server = new Server(serverChannel, chunkSize);

  // We expect the start message and a single request chunk method.
  const expectedClientSent = [
    startMsgBin,
    Buffer.from(
      JSON.stringify(commonChannel.BaseClient.createContinueMessage())
    )
  ];

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
    } else if (clientSentArgs.length === 2) {
      // We are requesting the first chunk.
      serverChannel.onmessage(createMessageEvent(sendArg));
    } else {
      throw new Error('Unexpectedly sending >2 messages to server');
    }
  };

  const serverSentArgs = [];
  let numExpectedRemoveListenerCalls = 0;
  serverChannel.send = function(sendArg) {
    // We want to imitate the buffer filling up and the listener being set.
    
    // First, create an event and send it to the client. Whether or not this
    // happens immediately or after some point in the future doesn't matter to
    // the server, so we'll just send it right away.
    serverSentArgs.push(sendArg);
    let event = createMessageEvent(sendArg);
    clientChannel.onmessage(event);

    // Second, increase the buffered amount. We'll rely on the addEventListener
    // function to do the clearing for us.
    
    // We will also increase the buffered amount as if we were filling up the
    // buffer.
    serverChannel.bufferedAmount += chunkSize;
  };

  serverChannel.addEventListener = function(eventName, listenerFn) {
    if (serverChannel.bufferedAmount <= bufferFullThreshold) {
      throw new Error('Should not have added event listener');
    }
    // Reset the buffered amount.
    serverChannel.bufferedAmount = 0;
    numExpectedRemoveListenerCalls++;
    // invoke the callback
    listenerFn();
  };

  let chunks = [];
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

    t.equal(removeEventListenerStub.callCount, numExpectedRemoveListenerCalls);
    removeEventListenerStub.args.forEach(args => {
      t.equal(args.length, 2); // [string, fn]
      t.deepEqual(args[0][0], 'bufferedamountlow');
    });

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
  let expectedChunks = [
    Buffer.from('Hello'),
    Buffer.from('There'),
    Buffer.from('Camel')
  ];
  integrationHelper(t, true, expectedChunks, 5, 10, 5);
});

test('integration test for no cached chunks', function(t) {
  let expectedChunks = [
    Buffer.from('up'),
    Buffer.from('do'),
    Buffer.from('no'),
    Buffer.from('if')
  ];
  integrationHelper(t, false, expectedChunks, 2, 3, 1);
});
