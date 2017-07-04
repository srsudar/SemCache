'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const commonChannel = require('../../../app/scripts/webrtc/common-channel');
const message = require('../../../app/scripts/webrtc/message');
const sutil = require('../server/util');

let peerConn = require('../../../app/scripts/webrtc/peer-connection');


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetPeerConn() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/peer-connection')
  ];
  peerConn = require('../../../app/scripts/webrtc/peer-connection');
}

/**
 * Proxyquire the peerConn object with proxies passed as the proxied modules.
 */
function proxyquirePeerConn(proxies) {
  peerConn = proxyquire(
    '../../../app/scripts/webrtc/peer-connection',
    proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetPeerConn();
}

function getRawCxnAndMsg() {
  let rawCxn = sinon.stub();
  let msg = { msg: 'do something for me' };
  return { rawCxn, msg };
}

test('getRawConnection returns constructor arg', function(t) {
  let expected = { foo: 'bar' };
  let pc = new peerConn.PeerConnection(expected);

  let actual  = pc.getRawConnection();

  t.equal(expected, actual);
  t.end();
});

test('emits close event when rawConnection closed', function(t) {
  let rawConnection = sinon.stub();
  let pc = new peerConn.PeerConnection(rawConnection);

  pc.on('close', actual => {
    t.equal(actual, undefined);
    t.end();
  });

  // Set our state to closed
  rawConnection.iceConnectionState = 'closed';

  rawConnection.oniceconnectionstatechange();
});

test('getList issues call to peer', function(t) {
  let offset = 100;
  let limit = 120;
  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  let msg = 'listmessage';
  let createMsgStub = sinon.stub();
  createMsgStub.withArgs(offset, limit).returns(msg);

  proxyquirePeerConn({
    './message': {
      createListMessage: createMsgStub
    }
  });

  let expected = sutil.getListResponseParsed();

  let pc = new peerConn.PeerConnection(rawConnection);
  pc.sendAndGetResponse = sinon.stub();
  pc.sendAndGetResponse.withArgs(msg).resolves(sutil.getListResponseBuff());

  pc.getList(offset, limit)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getList rejects if sendAndGetResponse rejects', function(t) {
  let expected = { error: 'went wrong' };
  proxyquirePeerConn({
    './message': {
      createListMessage: sinon.stub().throws(expected)
    }
  });

  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  let pc = new peerConn.PeerConnection(rawConnection);

  pc.getList()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getCacheDigest issues call to peer', function(t) {
  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  let msg = 'digest message';

  let expected = sutil.getDigestResponseParsed();
  let buffer = sutil.getDigestResponseBuff();

  proxyquirePeerConn({
    './message': {
      createDigestMessage: sinon.stub().returns(msg)
    }
  });

  let pc = new peerConn.PeerConnection(rawConnection);
  pc.sendAndGetResponse = sinon.stub();
  pc.sendAndGetResponse.withArgs(msg).resolves(buffer);
  

  pc.getCacheDigest()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheDigest rejects if sendAndGetResponse rejects', function(t) {
  let expected = { error: 'went wrong' };
  proxyquirePeerConn({
    './message': {
      createDigestMessage: sinon.stub().throws(expected)
    }
  });

  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  let pc = new peerConn.PeerConnection(rawConnection);

  pc.getCacheDigest()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getCacheBloomFilter calls peer and resolves', function(t) {
  let msg = message.createBloomFilterMessage();
  let buff = 'the buffer';
  let expected = 'parse result';

  let sendAndGetResponseStub = sinon.stub();
  sendAndGetResponseStub.withArgs(msg).resolves(buff);

  let parseStub = sinon.stub();
  parseStub.withArgs(buff).returns(expected);

  proxyquirePeerConn({
    '../server/server-api': {
      parseResponseForBloomFilter: parseStub
    },
    './message': {
      createBloomFilterMessage: sinon.stub().returns(msg)
    }
  });

  let pc = new peerConn.PeerConnection(sinon.stub());
  pc.sendAndGetResponse = sendAndGetResponseStub;

  pc.getCacheBloomFilter()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheBloomFilter rejects', function(t) {
  let expected = { err: 'trub' };

  proxyquirePeerConn({
    './message': {
      createBloomFilterMessage: sinon.stub().throws(expected)
    }
  });

  let pc = new peerConn.PeerConnection(sinon.stub());

  pc.getCacheBloomFilter()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getCachedPage resolves with CPDisk', function(t) {
  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  let href = 'http://www.foobar.org';
  let msg = message.createCachedPageMessage(href);

  proxyquirePeerConn({
    './message': {
      createCachedPageMessage: sinon.stub().returns(msg)
    }
  });

  let expected = sutil.getCachedPageResponseParsed();
  let buffer = sutil.getCachedPageResponseBuff();

  let pc = new peerConn.PeerConnection(rawConnection);
  pc.sendAndGetResponse = sinon.stub();
  pc.sendAndGetResponse.withArgs(msg).resolves(buffer);

  pc.getCachedPage(href)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCachedPage rejects on error', function(t) {
  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  let expected = { error: 'error during getCachedPage' };

  proxyquirePeerConn({
    './message': {
      createCachedPageMessage: sinon.stub().throws(expected)
    }
  });
  
  let pc = new peerConn.PeerConnection(rawConnection);

  pc.getCachedPage()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendAndGetResponse resolves on success', function(t) {
  let { rawCxn, msg } = getRawCxnAndMsg();

  let clientStub = new commonChannel.BaseClient(rawCxn, msg);
  let expected = Buffer.from('a response');
  clientStub.chunks = [expected];
  // Override start() to immediately emit a complete event.
  clientStub.start = function() {
    clientStub.emitComplete();
  };

  let setTimeoutStub = sinon.stub();

  proxyquirePeerConn({
    '../util': {
      setTimeout: setTimeoutStub
    }
  });

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawCxn, msg).returns(clientStub);
  peerConn.createClient = createClientStub;

  let pc = new peerConn.PeerConnection(rawCxn);

  // No timeout, make sure we use the default value
  pc.sendAndGetResponse(msg)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.equal(setTimeoutStub.args[0][1], peerConn.DEFAULT_TIMEOUT);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendAndGetResponse rejects on error', function(t) {
  let { rawCxn, msg } = getRawCxnAndMsg();

  let clientStub = new commonChannel.BaseClient(rawCxn, msg);
  let emitCloseStub = sinon.stub();
  let expected = { err: 'trouble' };
  // Override start() to immediately emit an error.
  clientStub.start = function() {
    clientStub.emitError(expected);
  };

  let setTimeoutStub = sinon.stub();
  proxyquirePeerConn({
    '../util': {
      setTimeout: setTimeoutStub
    }
  });

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawCxn, msg).returns(clientStub);
  peerConn.createClient = createClientStub;

  let pc = new peerConn.PeerConnection(rawCxn);
  pc.emitClose = emitCloseStub;

  pc.sendAndGetResponse(msg)
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(emitCloseStub.args[0], [expected]);
    t.equal(emitCloseStub.callCount, 1);
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendAndGetResponse rejects on timeout', function(t) {
  let { rawCxn, msg } = getRawCxnAndMsg();

  let timeout = 123456;
  let clientStub = new commonChannel.BaseClient(rawCxn, msg);
  let emitCloseStub = sinon.stub();
  // A bit rigid here--we are mimicking the error type that rejects in
  // peer-connection
  let expected = new Error('timed out');
  let startStub = sinon.stub();
  clientStub.start = startStub;

  let actualTimeout = null;
  let setTimeoutStub = function(callback, timeoutParam) {
    actualTimeout = timeoutParam;
    // Invoke immediately, like we timed out.
    callback();
  };

  proxyquirePeerConn({
    '../util': {
      setTimeout: setTimeoutStub
    }
  });

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawCxn, msg).returns(clientStub);
  peerConn.createClient = createClientStub;

  let pc = new peerConn.PeerConnection(rawCxn);
  pc.emitClose = emitCloseStub;

  pc.sendAndGetResponse(msg, timeout)
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.equal(actualTimeout, timeout);
    t.deepEqual(emitCloseStub.args[0], [expected]);
    t.equal(emitCloseStub.callCount, 1);
    t.equal(startStub.callCount, 1);
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendAndGetResponse rejects if createClient throws', function(t) {
  // In the wild we are seeing errors if createClient() throws. In this case it
  // seems like we should emit a close event to indicate that the connection is
  // not useful, allowing things like the connection manager to stop caching
  // the connection.
  let { rawCxn, msg } = getRawCxnAndMsg();

  let expected = { err: 'createClient threw' };

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawCxn, msg).throws(expected);
  peerConn.createClient = createClientStub;

  let emitCloseStub = sinon.stub();
  let pc = new peerConn.PeerConnection(rawCxn);
  pc.emitClose = emitCloseStub;

  pc.sendAndGetResponse(msg)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(emitCloseStub.args[0], [expected]);
    end(t);
  });
});
