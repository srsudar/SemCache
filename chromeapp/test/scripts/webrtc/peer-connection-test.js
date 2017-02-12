'use strict';
var Buffer = require('buffer').Buffer;
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var peerConn = require('../../../app/scripts/webrtc/peer-connection');

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
  var rawConnection = sinon.stub();
  rawConnection.on = sinon.stub();
  var msg = 'list message';

  var expected = { response: 'from the server' };
  var buffer = Buffer.from(JSON.stringify(expected));

  proxyquirePeerConn({
    './message': {
      createListMessage: sinon.stub().returns(msg)
    }
  });
  peerConn.sendAndGetResponse = sinon.stub().withArgs(rawConnection, msg)
    .resolves(buffer);
  
  var pc = new peerConn.PeerConnection(rawConnection);

  pc.getList()
  .then(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetPeerConn();
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
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetPeerConn();
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
  peerConn.sendAndGetResponse = sinon.stub().withArgs(rawConnection, msg)
    .resolves(expected);
  
  var pc = new peerConn.PeerConnection(rawConnection);

  pc.getFile()
  .then(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetPeerConn();
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
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetPeerConn();
  });
});
