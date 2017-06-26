'use strict';

const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

const common = require('../../../app/scripts/peer-interface/common');

let webrtcImpl = require('../../../app/scripts/peer-interface/webrtc-impl');

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

function getListParams() {
  let ip = '1.2.3.4';
  let port = 4321;
  return common.createListParams(ip, port, null);
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
  let pa = new webrtcImpl.WebrtcPeerAccessor({ ipaddr, port });
  t.deepEqual(pa.ipaddr, ipaddr);
  t.deepEqual(pa.port, port);
  end(t);
});

test('getFileBlob resolves with peerConnection.getFile', function(t) {
  let ipaddr = '1.2.3.4';
  let port = 1234;
  let fileUrl = 'path to file';
  
  let buffer = { tesType: 'I am the result of PeerConnection.getFile' };
  let expected = 'I am a blob';
  
  let getBufferAsBlobSpy = sinon.stub();
  getBufferAsBlobSpy.withArgs(buffer).returns(expected);
  let peerConn = sinon.stub();
  peerConn.getFile = sinon.stub();
  peerConn.getFile.withArgs(fileUrl).resolves(buffer);
  let getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    },
    '../util': {
      getBufferAsBlob: getBufferAsBlobSpy
    }
  });

  let params = common.createFileParams(ipaddr, port, fileUrl);
  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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
  let expected = { error: 'getOrCreateConnection fails' };

  let getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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
  let expected = { listOfPages: 'much list' };
  let ipaddr = '4.3.2.1';
  let port = 9876;
  let peerConn = sinon.stub();
  peerConn.getList = sinon.stub().resolves(expected);

  let getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });
  let params = common.createListParams(ipaddr, port, 'listurl');

  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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
  let expected = { error: 'gone so wrong' };
  let getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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
  let expected = { digest: 'lots of pages in this digest' };
  let ipaddr = '4.3.2.1';
  let port = 9876;
  let peerConn = sinon.stub();
  peerConn.getCacheDigest = sinon.stub().resolves(expected);

  let getOrCreateConnectionSpy = sinon.stub();
  getOrCreateConnectionSpy.withArgs(ipaddr, port).resolves(peerConn);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });
  let params = common.createListParams(ipaddr, port, 'listurl');

  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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
  let expected = { error: 'gone so wrong' };
  let getOrCreateConnectionSpy = sinon.stub().rejects(expected);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getOrCreateConnectionSpy
    }
  });

  let peerAccessor = new webrtcImpl.WebrtcPeerAccessor();
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

test('getCacheBloomFilter resolves on success', function(t) {
  let expected = 'the bloom filter';
  let params = getListParams();
  let getBloomStub = sinon.stub().resolves(expected);

  let pcxn = {
    getCacheBloomFilter: getBloomStub
  };

  let getCxnStub = sinon.stub();
  getCxnStub.withArgs(params.ipAddress, params.port).resolves(pcxn);

  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getCxnStub
    }
  });

  let accessor = new webrtcImpl.WebrtcPeerAccessor();
  accessor.getCacheBloomFilter(params)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheBloomFilter rejects on error', function(t) {
  let expected = { err: 'nope' };

  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: sinon.stub().rejects(expected)
    }
  });

  let accessor = new webrtcImpl.WebrtcPeerAccessor();
  accessor.getCacheBloomFilter({})
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
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
