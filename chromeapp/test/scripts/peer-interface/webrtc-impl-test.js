'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var common = require('../../../app/scripts/peer-interface/common');
var webrtcImpl = require('../../../app/scripts/peer-interface/webrtc-impl');

/**
 * Proxyquire the messaging module with proxies set as the proxied modules.
 */
function proxyquireWebrtcImpl(proxies) {
  webrtcImpl = proxyquire(
    '../../../app/scripts/peer-interface/webrtc-impl',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetWebrtcImpl() {
  delete require.cache[
    require.resolve('../../../app/scripts/peer-interface/webrtc-impl')
  ];
  webrtcImpl = require('../../../app/scripts/peer-interface/webrtc-impl');
}

test('can create PeerAccessor', function(t) {
  var pa = new webrtcImpl.WebrtcPeerAccessor();
  t.notEqual(null, pa);
  t.end();
});

test('getFileBlob resolves with peerConnection.getFile', function(t) {
  var ipaddr = '1.2.3.4';
  var port = 1234;
  var fileUrl = 'path to file';
  
  var buffer = { tesType: 'I am the result of PeerConnection.getFile' };
  var expected = 'I am a blob';
  
  var getBufferAsBlobSpy = sinon.stub().withArgs(buffer).returns(expected);
  var peerConn = sinon.stub();
  peerConn.getFile = sinon.stub().withArgs(fileUrl).resolves(buffer);
  var getOrCreateConnectionSpy = sinon.stub().withArgs(ipaddr, port)
    .resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    },
    '../util': {
      getBufferAsBlob: getBufferAsBlobSpy
    }
  });

  var params = common.createFileParams(ipaddr, port, fileUrl);
  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getFileBlob(params)
  .then(actual => {
    t.equal(actual, expected);
    t.deepEqual(getOrCreateConnectionSpy.args[0], [ipaddr, port]);
    t.end();
    resetWebrtcImpl();
  })
  .catch(err => {
    t.fail(err);
    t.end();
  });
});

test('getFileBlob rejects with error', function(t) {
  var expected = { error: 'getOrCreateConnection fails' };

  var getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getFileBlob({})
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetWebrtcImpl();
  });
});

test('getList resolves with json', function(t) {
  var expected = { listOfPages: 'much list' };
  var ipaddr = '4.3.2.1';
  var port = 9876;
  var peerConn = sinon.stub();
  peerConn.getList = sinon.stub().resolves(expected);

  var getOrCreateConnectionSpy = sinon.stub().withArgs(ipaddr, port)
    .resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });
  var params = common.createListParams(ipaddr, port, 'listurl');

  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getList(params)
  .then(actual => {
    t.equal(actual, expected);
    t.deepEqual(getOrCreateConnectionSpy.args[0], [ipaddr, port]);
    t.end();
    resetWebrtcImpl();
  });
});

test('getList rejects with error', function(t) {
  var expected = { error: 'gone so wrong' };
  var getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getList({})
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetWebrtcImpl();
  });
});
