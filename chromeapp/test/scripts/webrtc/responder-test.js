'use strict';

const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

let responder = require('../../../app/scripts/webrtc/responder');
const sutil = require('../server/util');

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
  let apiResponse = sutil.getListResponseBuff();
  let channel = 'i am the channel';
  let getResponseForAllCachedPagesSpy = sinon.stub().resolves(apiResponse);
  let sendBuffSpy = sinon.stub();
  sendBuffSpy.withArgs(channel, apiResponse).resolves();

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllCachedPages: getResponseForAllCachedPagesSpy
    }
  });
  responder.sendBufferOverChannel = sendBuffSpy;

  responder.onList(channel)
  .then(() => {
    t.deepEqual(sendBuffSpy.args[0], [channel, apiResponse]);
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
  var createChannelServerSpy = sinon.stub();
  createChannelServerSpy.withArgs(channel).returns(ccServerSpy);

  var sendBufferSpy = sinon.stub();
  ccServerSpy.sendBuffer = sendBufferSpy;

  var getCachedFileNameFromPathSpy = sinon.stub();
  getCachedFileNameFromPathSpy.withArgs(accessPath).returns(fileName);
  var getFileContentsFromNameSpy = sinon.stub();
  getFileContentsFromNameSpy.withArgs(fileName).resolves(buff);

  proxyquireResponder({
    '../persistence/file-system': {
      getFileContentsFromName: getFileContentsFromNameSpy
    },
    '../server/server-api': {
      getCachedFileNameFromPath: getCachedFileNameFromPathSpy
    }
  });
  responder.createChannelServer = createChannelServerSpy;

  responder.onFile(channel, msg)
  .then(() => {
    t.deepEqual(createChannelServerSpy.args[0], [channel]);
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
  var getFileContentsFromNameSpy = sinon.stub();
  getFileContentsFromNameSpy.withArgs(fileName).rejects(expected);

  proxyquireResponder({
    '../persistence/file-system': {
      getFileContentsFromName: getFileContentsFromNameSpy
    },
    '../server/server-api': {
      getCachedFileNameFromPath: getCachedFileNameFromPathSpy
    }
  });
  responder.createChannelServer = sinon.stub();
responder.createChannelServer.withArgs(channel).returns(serverMock);

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
  let channel = { testType: 'channel' };
  let msg = { foo: 'msg' };
  let msgBin = Buffer.from(JSON.stringify(msg));

  let event = { data: msgBin };

  let isListSpy = sinon.stub();
  let isFileSpy = sinon.stub();
  let isDigestSpy = sinon.stub();
  let isCachedPageSpy = sinon.stub();
 
  let onListSpy = sinon.stub();
  let onFileSpy = sinon.stub();
  let onDigestSpy = sinon.stub();
  let onCachedPageSpy = sinon.stub();

  proxyquireResponder({
    './message': {
      isList: isListSpy,
      isFile: isFileSpy,
      isDigest: isDigestSpy,
      isCachedPage: isCachedPageSpy
    }
  });
  responder.onList = onListSpy;
  responder.onFile = onFileSpy;
  responder.onDigest = onDigestSpy;
  responder.onCachedPage = onCachedPageSpy;

  // First a list message
  isListSpy.returns(true);
  isFileSpy.returns(false);
  isDigestSpy.returns(false);
  isCachedPageSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 0);
  t.equal(onDigestSpy.callCount, 0);
  t.equal(onCachedPageSpy.callCount, 0);
  t.deepEqual(onListSpy.args[0], [channel, msg]);

  // Now a file message
  isListSpy.returns(false);
  isFileSpy.returns(true);
  isDigestSpy.returns(false);
  isCachedPageSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 0);
  t.equal(onCachedPageSpy.callCount, 0);
  t.deepEqual(onFileSpy.args[0], [channel, msg]);

  // Now a digest message
  isListSpy.returns(false);
  isFileSpy.returns(false);
  isDigestSpy.returns(true);
  isCachedPageSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.equal(onCachedPageSpy.callCount, 0);
  t.deepEqual(onDigestSpy.args[0], [channel, msg]);

  // Now a cached page
  isListSpy.returns(false);
  isFileSpy.returns(false);
  isDigestSpy.returns(false);
  isCachedPageSpy.returns(true);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.equal(onCachedPageSpy.callCount, 1);
  t.deepEqual(onCachedPageSpy.args[0], [channel, msg]);

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
  let apiResponse = sutil.getDigestResponseBuff();
  let channel = 'i am the channel';
  let getResponseForAllPagesDigestSpy = sinon.stub().resolves(apiResponse);
  let sendBufferSpy = sinon.stub();
  sendBufferSpy.withArgs(channel, apiResponse).resolves();

  proxyquireResponder({
    '../server/server-api': {
      getResponseForAllPagesDigest: getResponseForAllPagesDigestSpy
    }
  });
  responder.sendBufferOverChannel = sendBufferSpy;

  responder.onDigest(channel)
  .then(() => {
    t.deepEqual(sendBufferSpy.args[0], [channel, apiResponse]);
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

test('onCachedPage resolves on success', function(t) {
  let href = 'heyo';
  let channelStub = { iam: 'a channel' };
  let msg = {
    request: { href: href }
  };
  let apiResponse = sutil.getCachedPageResponseBuff();

  let getResponseSpy = sinon.stub();
  getResponseSpy.withArgs(msg.request).resolves(apiResponse);
  let sendBufferSpy = sinon.stub().resolves();

  proxyquireResponder({
    '../server/server-api': {
      getResponseForCachedPage: getResponseSpy
    }
  });
  responder.sendBufferOverChannel = sendBufferSpy;

  responder.onCachedPage(channelStub, msg)
  .then(actual => {
    t.deepEqual(actual, undefined);
    t.deepEqual(sendBufferSpy.args[0], [channelStub, apiResponse]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('onCachedPage rejects on error', function(t) {
  let expected = { err: 'uh oh' };
  let getResponseStub = sinon.stub();
  getResponseStub.rejects(expected);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForCachedPage: getResponseStub
    }
  });

  responder.onCachedPage(null, {})
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendBufferOverChannel correct on success', function(t) {
  let channel = { iam: 'channel' };
  let buff = Buffer.from('yo');

  let sendBufferStub = sinon.stub();
  let serverStub = {
    sendBuffer: sendBufferStub
  };
  let createChannelServerSpy = sinon.stub();
  createChannelServerSpy.withArgs(channel).returns(serverStub);

  responder.createChannelServer = createChannelServerSpy;

  responder.sendBufferOverChannel(channel, buff)
  .then(() => {
    t.deepEqual(sendBufferStub.args[0], [buff]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendBufferOverChannel rejects on error', function(t) {
  let expected = { err: 'wrong' };
  responder.createChannelServer = sinon.stub().throws(expected);

  responder.sendBufferOverChannel()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
