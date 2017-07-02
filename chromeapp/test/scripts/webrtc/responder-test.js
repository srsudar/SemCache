'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const message = require('../../../app/scripts/webrtc/message');
const sutil = require('../server/util');

let responder = require('../../../app/scripts/webrtc/responder');


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
  let offset = 200;
  let limit = 10;
  let apiResponse = sutil.getListResponseBuff();
  let channel = 'i am the channel';
  let getResponseForListSpy = sinon.stub();
  getResponseForListSpy.withArgs(offset, limit).resolves(apiResponse);
  let sendBuffSpy = sinon.stub();
  sendBuffSpy.withArgs(channel, apiResponse).resolves();

  let msg = message.createListMessage(offset, limit);
  console.log(msg);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForList: getResponseForListSpy
    }
  });
  responder.sendBufferOverChannel = sendBuffSpy;

  responder.onList(channel, msg)
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
  let channel = 'i am the channel';
  let expected = { error: 'went south' };
  let getResponseForListSpy = sinon.stub().rejects(expected);

  proxyquireResponder({
    '../server/server-api': {
      getResponseForList: getResponseForListSpy
    }
  });

  responder.onList(channel, { request: {} })
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('onDataChannelMessageHandler routes correctly', function(t) {
  let channel = { testType: 'channel' };
  let msg = { foo: 'msg' };
  let msgBin = Buffer.from(JSON.stringify(msg));

  let event = { data: msgBin };

  let isListSpy = sinon.stub();
  let isDigestSpy = sinon.stub();
  let isCachedPageSpy = sinon.stub();
  let isBloomFilterSpy = sinon.stub();
 
  let onListSpy = sinon.stub();
  let onDigestSpy = sinon.stub();
  let onCachedPageSpy = sinon.stub();
  let onBloomFilterSpy = sinon.stub();

  function setIsSpysFalse() {
    isListSpy.withArgs(msg).returns(false); 
    isDigestSpy.withArgs(msg).returns(false); 
    isCachedPageSpy.withArgs(msg).returns(false); 
    isBloomFilterSpy.withArgs(msg).returns(false); 
  }

  function setIsSpyTrue(spy) {
    spy.withArgs(msg).returns(true);
  }

  proxyquireResponder({
    './message': {
      isList: isListSpy,
      isDigest: isDigestSpy,
      isCachedPage: isCachedPageSpy,
      isBloomFilter: isBloomFilterSpy
    }
  });
  responder.onList = onListSpy;
  responder.onDigest = onDigestSpy;
  responder.onCachedPage = onCachedPageSpy;
  responder.onBloomFilter = onBloomFilterSpy;

  // First a list message
  setIsSpysFalse();
  setIsSpyTrue(isListSpy);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 0);
  t.equal(onCachedPageSpy.callCount, 0);
  t.equal(onBloomFilterSpy.callCount, 0);
  t.deepEqual(onListSpy.args[0], [channel, msg]);

  // Now a digest message
  setIsSpysFalse();
  setIsSpyTrue(isDigestSpy);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.equal(onCachedPageSpy.callCount, 0);
  t.equal(onBloomFilterSpy.callCount, 0);
  t.deepEqual(onDigestSpy.args[0], [channel, msg]);

  // Now a cached page
  setIsSpysFalse();
  setIsSpyTrue(isCachedPageSpy);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.equal(onCachedPageSpy.callCount, 1);
  t.equal(onBloomFilterSpy.callCount, 0);
  t.deepEqual(onCachedPageSpy.args[0], [channel, msg]);

  // Now a Bloom filter
  setIsSpysFalse();
  setIsSpyTrue(isBloomFilterSpy);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onDigestSpy.callCount, 1);
  t.equal(onCachedPageSpy.callCount, 1);
  t.equal(onBloomFilterSpy.callCount, 1);
  t.deepEqual(onBloomFilterSpy.args[0], [channel, msg]);

  end(t);
});

test('onDataChannelHandler adds onmessage handler to channels', function(t) {
  let channel = sinon.stub();
  let event = { channel: channel };

  let onDataChannelMessageHandlerSpy = sinon.stub();

  responder.onDataChannelMessageHandler = onDataChannelMessageHandlerSpy;

  responder.onDataChannelHandler(event);

  let msgEvent = 'message event';
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
  let channel = 'i am the channel';
  let expected = { error: 'went south' };
  let getResponseForAllPagesDigestSpy = sinon.stub().rejects(expected);

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

test('onBloomFilter calls send with contents', function(t) {
  let channel = 'channel for bloom';
  let buff = Buffer.from('yo yo');

  let sendBufferStub = sinon.stub();
  sendBufferStub.withArgs(channel, buff).resolves();

  proxyquireResponder({
    '../server/server-api': {
      getResponseForBloomFilter: sinon.stub().resolves(buff)
    },
  });
  responder.sendBufferOverChannel = sendBufferStub;

  responder.onBloomFilter(channel)
  .then(actual => {
    t.equal(actual, undefined);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('onBloomFilter rejects with error', function(t) {
  let expected = { err: 'sizzle me timbers. Oh no the rolls!' };

  proxyquireResponder({
    '../server/server-api': {
      getResponseForBloomFilter: sinon.stub().rejects(expected)
    }
  });

  responder.onBloomFilter({})
  .then(result => {
    t.fail(result);
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
  getResponseSpy.withArgs(href).resolves(apiResponse);
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

  responder.onCachedPage(null, { request: {} })
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
