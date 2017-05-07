'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var responder = require('../../../app/scripts/webrtc/responder');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetResponder() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/responder')
  ];
  responder = require('../../../app/scripts/webrtc/responder');
}

function proxyquireResponder(proxies) {
  responder = proxyquire('../../../app/scripts/webrtc/responder', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetResponder();
  t.end();
}


test('onList calls sendBuffer with binary contents', function(t) {
  var json = { page1: 'nyt', page2: 'wapo' };
  var channel = 'i am the channel';
  var buffer = Buffer.from(JSON.stringify(json));
  var getResponseForAllCachedPagesSpy = sinon.stub().resolves(json);

  var ccServerSpy = sinon.stub();
  ccServerSpy.sendBuffer = sinon.stub();

  var createCcServerSpy = sinon.stub().withArgs(channel)
    .returns(ccServerSpy);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllCachedPages: getResponseForAllCachedPagesSpy
    }
  });
  responder.createCcServer = createCcServerSpy;

  responder.onList(channel)
  .then(() => {
    t.deepEqual(ccServerSpy.sendBuffer.args[0], [buffer]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('onList rejects with error', function(t) {
  var channel = 'i am the channel';
  var expected = { error: 'went south' };
  var getResponseForAllCachedPagesSpy = sinon.stub().rejects(expected);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllCachedPages: getResponseForAllCachedPagesSpy
    }
  });

  responder.onList(channel)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('onFile calls sendBuffer with file contents', function(t) {
  var fileName = 'file-name';
  var accessPath = 'path/to/file';
  var msg = { request: { accessPath: accessPath } };
  var buff = Buffer.from('file contents');
  var channel = { testType: 'channel' };

  var ccServerSpy = sinon.stub();
  var createCcServerSpy = sinon.stub().withArgs(channel)
    .returns(ccServerSpy);

  var sendBufferSpy = sinon.stub();
  ccServerSpy.sendBuffer = sendBufferSpy;

  var getCachedFileNameFromPathSpy = sinon.stub().withArgs(accessPath)
    .returns(fileName);
  var getFileContentsFromNameSpy = sinon.stub().withArgs(fileName)
    .resolves(buff);

  proxyquireResponder({
    '../persistence/file-system': {
      getFileContentsFromName: getFileContentsFromNameSpy
    },
    '../server/server-api': {
      getCachedFileNameFromPath: getCachedFileNameFromPathSpy
    }
  });
  responder.createCcServer = createCcServerSpy;

  responder.onFile(channel, msg)
  .then(() => {
    t.deepEqual(createCcServerSpy.args[0], [channel]);
    t.deepEqual(sendBufferSpy.args[0], [buff]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('onFile rejects with error', function(t) {
  var fileName = 'file-name';
  var accessPath = 'path/to/file';
  var msg = { request: { accessPath: accessPath } };
  var channel = { testType: 'channel' };
  var serverMock = sinon.stub();
  var sendErrorMock = sinon.stub();
  serverMock.sendError = sendErrorMock;

  var expected = { error: 'trouble' };

  var getCachedFileNameFromPathSpy = sinon.stub().returns(fileName);
  var getFileContentsFromNameSpy = sinon.stub().withArgs(fileName)
    .rejects(expected);

  proxyquireResponder({
    '../persistence/file-system': {
      getFileContentsFromName: getFileContentsFromNameSpy
    },
    '../server/server-api': {
      getCachedFileNameFromPath: getCachedFileNameFromPathSpy
    }
  });
  responder.createCcServer = sinon.stub().withArgs(channel)
    .returns(serverMock);

  responder.onFile(channel, msg)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(sendErrorMock.args[0][0], expected);
    t.equal(actual, expected);
    end(t);
  });
});

test('onDataChannelMessageHandler routes correctly', function(t) {
  var channel = { testType: 'channel' };
  var msg = { foo: 'msg' };
  var msgBin = Buffer.from(JSON.stringify(msg));

  var event = { data: msgBin };

  var isListSpy = sinon.stub();
  var isFileSpy = sinon.stub();
  var isDigestSpy = sinon.stub();
 
  var onListSpy = sinon.stub();
  var onFileSpy = sinon.stub();
  var onDigestSpy = sinon.stub();

  proxyquireResponder({
    './message': {
      isList: isListSpy,
      isFile: isFileSpy,
      isDigest: isDigestSpy
    }
  });
  responder.onList = onListSpy;
  responder.onFile = onFileSpy;
  responder.onDigest = onDigestSpy;

  // First a list message
  isListSpy.returns(true);
  isFileSpy.returns(false);
  isDigestSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 0);
  t.equal(onDigestSpy.callCount, 0);
  t.deepEqual(onListSpy.args[0], [channel, msg]);

  // Now a file message
  isListSpy.returns(false);
  isFileSpy.returns(true);
  isDigestSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 0);
  t.deepEqual(onFileSpy.args[0], [channel, msg]);

  // Now a digest message
  isListSpy.returns(false);
  isFileSpy.returns(false);
  isDigestSpy.returns(true);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.deepEqual(onDigestSpy.args[0], [channel, msg]);

  end(t);
});

test('onDataChannelHandler adds onmessage handler to channels', function(t) {
  var channel = sinon.stub();
  var event = { channel: channel };

  var onDataChannelMessageHandlerSpy = sinon.stub();

  responder.onDataChannelMessageHandler = onDataChannelMessageHandlerSpy;

  responder.onDataChannelHandler(event);

  var msgEvent = 'message event';
  channel.onmessage(msgEvent);

  t.deepEqual(onDataChannelMessageHandlerSpy.args[0], [channel, msgEvent]);
  end(t);
});

test('onDigest calls sendBuffer with binary contents', function(t) {
  var json = { page1: 'woot', page2: 'boo' };
  var channel = 'i am the channel';
  var buffer = Buffer.from(JSON.stringify(json));
  var getResponseForAllPagesDigestSpy = sinon.stub().resolves(json);

  var ccServerSpy = sinon.stub();
  ccServerSpy.sendBuffer = sinon.stub();

  var createCcServerSpy = sinon.stub().withArgs(channel)
    .returns(ccServerSpy);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllPagesDigest: getResponseForAllPagesDigestSpy
    }
  });
  responder.createCcServer = createCcServerSpy;

  responder.onDigest(channel)
  .then(() => {
    t.deepEqual(ccServerSpy.sendBuffer.args[0], [buffer]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('onDigest rejects with error', function(t) {
  var channel = 'i am the channel';
  var expected = { error: 'went south' };
  var getResponseForAllPagesDigestSpy = sinon.stub().rejects(expected);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllPagesDigest: getResponseForAllPagesDigestSpy
    }
  });

  responder.onDigest(channel)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
