'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var commonChannel = require('../../../app/scripts/webrtc/common-channel');
var protocol = require('../../../app/scripts/webrtc/protocol');

var Client = commonChannel.BaseClient;
var Server = commonChannel.BaseServer;


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/common-channel')
  ];
  commonChannel = require('../../../app/scripts/webrtc/common-channel');
  Client = commonChannel.BaseClient;
  Server = commonChannel.BaseServer;
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t'); }
  t.end();
  reset();
}

function prepareToSendHelper(t, chunkSize, buff, numExpectedChunks) {
  const channel = sinon.stub();
  const server = new Server(channel, chunkSize);

  server.prepareToSend(buff);

  t.deepEqual(server.buffToSend, buff);
  t.deepEqual(server.numChunks, numExpectedChunks);
  t.deepEqual(server.streamInfo, Server.createStreamInfo(numExpectedChunks));
  t.deepEqual(server.chunksSent, 0);

  end(t);
}

// Client tests

test('constructor initializes client correctly', function(t) {
  const rawConn = 'I am raw connection';
  const cacheChunks = true;
  const msg = { msg: 'hello' };
  const actual = new Client(rawConn, cacheChunks, msg);

  t.deepEqual(actual.cacheChunks, cacheChunks);
  t.deepEqual(actual.rawConnection, rawConn);
  t.deepEqual(actual.numChunksReceived, 0);
  t.deepEqual(actual.streamInfo, null);
  t.deepEqual(actual.channel, null);
  t.deepEqual(actual.awaitingFirstResponse, true);
  t.deepEqual(actual.msg, msg);
  t.deepEqual(actual.chunks, []);

  end(t);
});

test('handleErrorMessage emits error', function(t) {
  const client = new Client();
  const expected = { msg: 'the error' };
  client.on('error', actual => {
    t.deepEqual(actual, expected);
    end(t);
  });

  client.handleErrorMessage(expected);
});

test('requestChunk sends on success', function(t) {
  const msg = Client.createContinueMessage();
  const expected = Buffer.from(JSON.stringify(msg)).buffer;
  const channelStub = sinon.stub();
  const sendStub = sinon.stub();
  channelStub.send = sendStub;

  const client = new Client();
  client.channel = channelStub;
  client.requestChunk();

  t.deepEqual(sendStub.args[0], [expected]);
  end(t);
});

test('requestChunk handles error', function(t) {
  const channelStub = sinon.stub();
  const expected = { err: 'trubs' };
  const sendStub = sinon.stub().throws(expected);
  channelStub.send = sendStub;

  const client = new Client();
  client.channel = channelStub;
  client.on('error', actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
  client.requestChunk();
});

test('emitChunk emits chunk', function(t) {
  const client = new Client();
  const expected = Buffer.from('hello there');
  
  client.on('chunk', actual => {
    t.deepEqual(actual, expected);
    end(t);
  });

  client.emitChunk(expected);
});

test('emitError emits message', function(t) {
  const client = new Client();
  const expected = { msg: 'something went wrong' };
  
  client.on('error', actual => {
    t.deepEqual(actual, expected);
    end(t);
  });

  client.emitError(expected);
});

test('emitComplete emits all chunks if caching', function(t) {
  const client = new Client(null, true, null);
  const chunks = [
    Buffer.from('hello '),
    Buffer.from('my name is '),
    Buffer.from('elmo.')
  ];
  const expected = Buffer.concat(chunks);
  client.chunks = chunks;

  client.on('complete', actual => {
    t.deepEqual(actual, expected);
    end(t);
  });

  client.emitComplete();
});

test('emitComplete does not emit chunks if not caching', function(t) {
  const client = new Client(null, false, null);

  client.on('complete', actual => {
    t.deepEqual(actual, undefined);
    end(t);
  });

  client.emitComplete();
});

test('createContinueMessage correct', function(t) {
  const expected = { message: 'next' };
  const actual = Client.createContinueMessage();

  t.deepEqual(actual, expected);
  end(t);
});

// ServerChannel tests

test('constructor initializes correctly', function(t) {
  const channel = 'I am the channel';
  const chunkSize = 1;
  const actual = new Server(channel, chunkSize);

  t.deepEqual(actual.channel, channel);
  t.deepEqual(actual.chunkSize, chunkSize);
  t.deepEqual(actual.numChunks, null);
  t.deepEqual(actual.streamInfo, null);
  t.deepEqual(actual.chunksSent, null);
  t.deepEqual(actual._activeGenerator, null);

  end(t);
});

test('sendError sends buffer', function(t) {
  const err = 'error msg';
  const expected = protocol.createErrorMessage(err).asBuffer().buffer;

  const sendStub = sinon.stub();
  const channel = {
    send: sendStub
  };
  const server = new Server(channel);

  server.sendError(err);
  t.deepEqual(sendStub.args[0], [expected]);
  end(t);
});

test('sendFirstMessage sends stream info', function(t) {
  const streamInfo = { numChunks: 45 };
  const expected = protocol.createSuccessMessage(
    Buffer.from(JSON.stringify(streamInfo))
  ).asBuffer();

  const sendStub = sinon.stub();
  const channel = {
    send: sendStub
  };

  const server = new Server(channel);
  server.streamInfo = streamInfo;
  server.sendFirstMessage();

  t.deepEqual(sendStub.args[0], [expected]);
  end(t);
});

test('prepareToSend sets up correct state for 0 chunks', function(t) {
  const chunkSize = 1;
  const buff = Buffer.from('');
  const numExpectedChunks = 0;

  prepareToSendHelper(t, chunkSize, buff, numExpectedChunks);
});

test('prepareToSend sets up correct state for exact 1 chunk', function(t) {
  const buff = Buffer.from('hello');
  const chunkSize = buff.length;
  const numExpectedChunks = 1;

  prepareToSendHelper(t, chunkSize, buff, numExpectedChunks);
});

test('prepareToSend sets up correct state for multiple chunks', function(t) {
  const buff = Buffer.from('abc def g');
  const chunkSize = 4;
  const numExpectedChunks = 3;

  prepareToSendHelper(t, chunkSize, buff, numExpectedChunks);
});

test('handleMessageFromClient throws error for bad message', function(t) {
  const server = new Server();
  const msg = {};
  const willThrow = function() {
    server.handleMessageFromClient(msg);
  };

  t.throws(willThrow);
  end(t);
});

test('createChunkGenerator throws if no buffer', function(t) {
  const server = new Server();
  const willThrow = function() {
    var gen = server.createChunkGenerator();
    gen.next();
  };

  t.throws(willThrow);
  end(t);
});

test('createChunkGenerator correct for single chunk', function(t) {
  const buff = Buffer.from('hello there');
  const chunkSize = buff.length;
  const server = new Server(sinon.stub(), chunkSize);
  server.buffToSend = buff;

  server.prepareToSend(buff);
  const gen = server.createChunkGenerator();
  const actual = [...gen];

  const expected = [buff];

  t.deepEqual(actual, expected);
  end(t);
});

test('createChunkGenerator correct for multiple chunks', function(t) {
  const buff = Buffer.from('hello there');
  const chunkSize = 1;
  const server = new Server(sinon.stub(), chunkSize);

  server.prepareToSend(buff);
  const gen = server.createChunkGenerator();
  const actual = [...gen];

  const expected = [];
  for (let i = 0; i < buff.length; i++) {
    expected.push(buff.slice(i, i + 1));
  }

  t.deepEqual(actual, expected);
  end(t);
});

test('createChunkGenerator correct for no chunks', function(t) {
  const buff = Buffer.from('');
  const chunkSize = 1;
  const server = new Server(sinon.stub(), chunkSize);
  server.buffToSend = buff;

  server.prepareToSend(buff);
  const gen = server.createChunkGenerator();
  const actual = [...gen];

  const expected = [];

  t.deepEqual(actual, expected);
  end(t);
});

test('createStreamInfo correct', function(t) {
  const numChunks = 5;
  const actual = Server.createStreamInfo(numChunks);
  const expected = { numChunks: numChunks };

  t.deepEqual(actual, expected);
  end(t);
});

test('chunkGenerator getter lazily initializes', function(t) {
  const buff = Buffer.from('abc def ghi jkl mno p');
  const chunkSize = 4;
  const server = new Server(sinon.stub(), chunkSize);
  server.buffToSend = buff;

  const expected = [
    Buffer.from('abc '),
    Buffer.from('def '),
    Buffer.from('ghi '),
    Buffer.from('jkl '),
    Buffer.from('mno '),
    Buffer.from('p')
  ];

  server.prepareToSend(buff);
  const gen1 = server.chunkGenerator;

  const actual = [];
  actual.push(gen1.next().value);
  actual.push(gen1.next().value);

  const gen2 = server.chunkGenerator;
  actual.push(gen2.next().value);
  actual.push(gen2.next().value);

  const gen3 = server.chunkGenerator;
  const remaining = [...gen3];

  actual.push(...remaining);

  t.deepEqual(actual, expected);
  end(t);
});
