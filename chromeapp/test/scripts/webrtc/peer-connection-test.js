'use strict';

const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

let peerConn = require('../../../app/scripts/webrtc/peer-connection');

const message = require('../../../app/scripts/webrtc/message');
const sutil = require('../server/util');
const commonChannel = require('../../../app/scripts/webrtc/common-channel');

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

test('getRawConnection returns constructor arg', function(t) {
  var expected = { foo: 'bar' };
  var pc = new peerConn.PeerConnection(expected);

  var actual  = pc.getRawConnection();

  t.equal(expected, actual);
  t.end();
});

test('emits close event when rawConnection onclose invoked', function(t) {
  var rawConnection = sinon.stub();
  var pc = new peerConn.PeerConnection(rawConnection);

  pc.on('close', actual => {
    t.equal(actual, undefined);
    t.end();
  });

  rawConnection.onclose();
});

test('getList issues call to peer', function(t) {
  let rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  let msg = 'list message';

  let expected = sutil.getListResponseObj();

  proxyquirePeerConn({
    './message': {
      createListMessage: sinon.stub().returns(msg)
    }
  });

  var pc = new peerConn.PeerConnection(rawConnection);
  pc.sendAndGetResponse = sinon.stub();
  pc.sendAndGetResponse.withArgs(msg).resolves(sutil.getListResponseBuff());
  

  pc.getList()
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
  var expected = { error: 'went wrong' };
  proxyquirePeerConn({
    './message': {
      createListMessage: sinon.stub().throws(expected)
    }
  });

  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  var pc = new peerConn.PeerConnection(rawConnection);

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
  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  var msg = 'digest message';

  var expected = sutil.getDigestResponseJson();
  var buffer = sutil.getDigestResponseBuff();

  proxyquirePeerConn({
    './message': {
      createDigestMessage: sinon.stub().returns(msg)
    }
  });

  var pc = new peerConn.PeerConnection(rawConnection);
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
  var expected = { error: 'went wrong' };
  proxyquirePeerConn({
    './message': {
      createDigestMessage: sinon.stub().throws(expected)
    }
  });

  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  var pc = new peerConn.PeerConnection(rawConnection);

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

test('getFile resolves with response from server', function(t) {
  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  var msg = 'file message';

  var expected = Buffer.from('response from server');

  proxyquirePeerConn({
    './message': {
      createFileMessage: sinon.stub().returns(msg)
    }
  });

  var pc = new peerConn.PeerConnection(rawConnection);
  pc.sendAndGetResponse = sinon.stub();
  pc.sendAndGetResponse.withArgs(msg).resolves(expected);
  

  pc.getFile()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFile rejects if error', function(t) {
  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  var expected = { error: 'error during getFile' };

  proxyquirePeerConn({
    './message': {
      createFileMessage: sinon.stub().throws(expected)
    }
  });
  
  var pc = new peerConn.PeerConnection(rawConnection);

  pc.getFile()
  .then(res => {
    t.fail(res);
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

  let expected = sutil.getCachedPageResponseObj();
  let buffer = sutil.getCachedPageResponseBuff();

  var pc = new peerConn.PeerConnection(rawConnection);
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
  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();

  var expected = { error: 'error during getCachedPage' };

  proxyquirePeerConn({
    './message': {
      createCachedPageMessage: sinon.stub().throws(expected)
    }
  });
  
  var pc = new peerConn.PeerConnection(rawConnection);

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
  let rawConnection = { iam: 'RTCPeerConnection' };
  let msg = { msg: 'get me a file' };

  let clientStub = new commonChannel.BaseClient(rawConnection, msg);
  let expected = Buffer.from('a response');
  clientStub.chunks = [expected];
  // Override start() to immediately emit a complete event.
  clientStub.start = function() {
    clientStub.emitComplete();
  };

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawConnection, msg).returns(clientStub);
  peerConn.createClient = createClientStub;

  let pc = new peerConn.PeerConnection(rawConnection);

  pc.sendAndGetResponse(msg)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendAndGetResponse rejects on error', function(t) {
  let rawConnection = { iam: 'RTCPeerConnection' };
  let msg = { msg: 'get me a file' };

  let clientStub = new commonChannel.BaseClient(rawConnection, msg);
  let expected = { err: 'trouble' };
  // Override start() to immediately emit an error.
  clientStub.start = function() {
    clientStub.emitError(expected);
  };

  let createClientStub = sinon.stub();
  createClientStub.withArgs(rawConnection, msg).returns(clientStub);
  peerConn.createClient = createClientStub;

  let pc = new peerConn.PeerConnection(rawConnection);

  pc.sendAndGetResponse(msg)
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
