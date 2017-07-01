'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const tutil = require('../test-util');

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


/**
 * @return {WebrtcPeerAccessor}
 */
function createAccessor() {
  let { ipAddress, port } = tutil.getIpPort();
  return new webrtcImpl.WebrtcPeerAccessor({ ipAddress, port });
}

test('can create PeerAccessor', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let pa = createAccessor();
  t.deepEqual(pa.getIpAddress(), ipAddress);
  t.deepEqual(pa.getPort(), port);
  end(t);
});

test('getList resolves with json', function(t) {
  let expected = { listOfPages: 'much list' };

  let peerConn = sinon.stub();
  peerConn.getList = sinon.stub().resolves(expected);

  let pa = createAccessor();
  pa.getConnection = sinon.stub().resolves(peerConn);

  pa.getList()
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getList rejects with error', function(t) {
  let expected = { error: 'gone so wrong' };
  let getConnectionStub = sinon.stub().rejects(expected);

  let pa = createAccessor();
  pa.getConnection = getConnectionStub;

  pa.getList()
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

  let peerConn = sinon.stub();
  peerConn.getCacheDigest = sinon.stub().resolves(expected);

  let pa = createAccessor();
  pa.getConnection = sinon.stub().resolves(peerConn);

  pa.getCacheDigest()
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheDigest rejects with error', function(t) {
  let expected = { error: 'gone so wrong' };
  let getConnectionStub = sinon.stub().rejects(expected);

  let pa = createAccessor();
  pa.getConnection = getConnectionStub;

  pa.getCacheDigest()
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
  let getBloomStub = sinon.stub().resolves(expected);

  let pcxn = {
    getCacheBloomFilter: getBloomStub
  };

  let getCxnStub = sinon.stub().resolves(pcxn);

  let pa = createAccessor();
  pa.getConnection = getCxnStub;

  pa.getCacheBloomFilter()
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

test('getConnection returns result', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let expected = 'it is me';

  let getCxnStub = sinon.stub();
  getCxnStub.withArgs(ipAddress, port).resolves(expected);
  
  proxyquireWebrtcImpl({
    '../webrtc/connection-manager': {
      getOrCreateConnection: getCxnStub
    }
  });

  let pa = createAccessor();

  pa.getConnection()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
