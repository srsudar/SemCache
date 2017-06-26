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

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetWebrtcImpl();
}

/**
 * @return {WebrtcPeerAccessor}
 */
function createAccessor() {
  return new webrtcImpl.WebrtcPeerAccessor('1.2.3.4', 8888);
}

test('can create PeerAccessor', function(t) {
  let ipaddr = '1.2.3.4';
  let port = 1111;
  var pa = new webrtcImpl.WebrtcPeerAccessor({ ipaddr, port });
  t.deepEqual(pa.ipaddr, ipaddr);
  t.deepEqual(pa.port, port);
  end(t);
});

test('getFileBlob resolves with peerConnection.getFile', function(t) {
  var ipaddr = '1.2.3.4';
  var port = 1234;
  var fileUrl = 'path to file';
  
  var buffer = { tesType: 'I am the result of PeerConnection.getFile' };
  var expected = 'I am a blob';
  
  var getBufferAsBlobSpy = sinon.stub();
  getBufferAsBlobSpy.withArgs(buffer).returns(expected);
  var peerConn = sinon.stub();
  peerConn.getFile = sinon.stub();
  peerConn.getFile.withArgs(fileUrl).resolves(buffer);
  var getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
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
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
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
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getList resolves with json', function(t) {
  var expected = { listOfPages: 'much list' };
  var ipaddr = '4.3.2.1';
  var port = 9876;
  var peerConn = sinon.stub();
  peerConn.getList = sinon.stub().resolves(expected);

  var getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
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
  })
  .catch(err => {
    t.fail(err);
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
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getCacheDigest resolves with json', function(t) {
  var expected = { digest: 'lots of pages in this digest' };
  var ipaddr = '4.3.2.1';
  var port = 9876;
  var peerConn = sinon.stub();
  peerConn.getCacheDigest = sinon.stub().resolves(expected);

  var getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });
  var params = common.createListParams(ipaddr, port, 'listurl');

  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getCacheDigest(params)
  .then(actual => {
    t.equal(actual, expected);
    t.deepEqual(getOrCreateConnectionSpy.args[0], [ipaddr, port]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheDigest rejects with error', function(t) {
  var expected = { error: 'gone so wrong' };
  var getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  var peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
  peerAccessor.getCacheDigest({})
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getCachedPage succeeds', function(t) {
  let href = 'http://www.cats.org';
  let accessor = createAccessor();
  let expected = { iam: 'cpdisk' };

  let connectionStub = sinon.stub();
  let getCachedPageStub = sinon.stub();
  getCachedPageStub.withArgs(href).resolves(expected);
  connectionStub.getCachedPage = getCachedPageStub;
  accessor.getConnection = sinon.stub().resolves(connectionStub);

  accessor.getCachedPage(href)
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
  let href = 'http://www.cats.org';
  let accessor = createAccessor();
  let expected = { err: 'trubbly wubbly' };

  accessor.getConnection = sinon.stub().rejects(expected);

  accessor.getCachedPage(href)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
