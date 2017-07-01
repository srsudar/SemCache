'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const serverApi = require('../../../app/scripts/server/server-api');
const sutil = require('../server/util');
const tutil = require('../test-util');

let httpImpl = require('../../../app/scripts/peer-interface/http-impl');


/**
 * Proxyquire the messaging module with proxies set as the proxied modules.
 */
function proxyquireHttpImpl(proxies) {
  httpImpl = proxyquire(
    '../../../app/scripts/peer-interface/http-impl',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetHttpImpl() {
  delete require.cache[
    require.resolve('../../../app/scripts/peer-interface/http-impl')
  ];
  httpImpl = require('../../../app/scripts/peer-interface/http-impl');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetHttpImpl();
}

test('can create PeerAccessor', function(t) {
  let peer = new httpImpl.HttpPeerAccessor();
  t.notEqual(null, peer);
  end(t);
});

test.only('getList resolves with json', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let listUrl = serverApi.getListPageUrlForCache(ipAddress, port);

  let expected = sutil.getListResponseParsed();
  let response = sinon.stub();

  let responseBuff = sutil.getListResponseBuff();
  console.log(responseBuff.length);
  console.log(responseBuff);
  console.log(responseBuff.buffer);
  // The buffer property is not truncated by default.
  let arrayBuffer = responseBuff.buffer.slice(0, responseBuff.length);
  console.log(arrayBuffer);

  response.arrayBuffer = sinon.stub().resolves(arrayBuffer);

  let fetchSpy = sinon.stub();
  fetchSpy.withArgs(listUrl).resolves(response);
  
  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  let peerAccessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  peerAccessor.getList()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getList rejects with error', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let expected = { error: 'fetch done gone wrong' };
  let fetchSpy = sinon.stub().rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  let peerAccessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  peerAccessor.getList()
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
  let { ipAddress, port } = tutil.getIpPort();
  let digestUrl = serverApi.getUrlForDigest(ipAddress, port);

  let expected = sutil.getDigestResponseParsed();
  let response = sinon.stub();
  response.arrayBuffer = sinon.stub().resolves(
    sutil.getDigestResponseBuff().buffer
  );

  let fetchSpy = sinon.stub();
  fetchSpy.withArgs(digestUrl).resolves(response);
  
  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  let peerAccessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  peerAccessor.getCacheDigest()
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
  let { ipAddress, port } = tutil.getIpPort();
  let expected = { error: 'fetch done gone wrong' };
  let fetchSpy = sinon.stub().rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  let peerAccessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  peerAccessor.getCacheDigest()
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
  let { ipAddress, port } = tutil.getIpPort();
  let bloomUrl = serverApi.getUrlForBloomFilter(ipAddress, port);
  // We need to return an ArrayBuffer from fetch and then pass a Buffer to our
  // parse method.
  let arrayBuff = sutil.getBloomResponseBuff().buffer;
  let expected = sutil.getBloomResponseParsed();

  let responseStub = {
    arrayBuffer: sinon.stub().resolves(arrayBuff)
  };

  let fetchStub = sinon.stub();
  fetchStub.withArgs(bloomUrl).resolves(responseStub);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchStub
    }
  });

  let peerAccessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  peerAccessor.getCacheBloomFilter()
  .then(actual => {
    tutil.assertBloomFiltersEqual(t, actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCacheBloomFilter rejects on error', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let expected = { err: 'yup' };
  
  proxyquireHttpImpl({
    '../util': {
      fetch: sinon.stub().rejects(expected)
    }
  });

  let accessor = new httpImpl.HttpPeerAccessor({ ipAddress, port });
  accessor.getCacheBloomFilter()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getCachedPage resolves on success', function(t) {
  t.fail();
  t.end();
});

test('getCachedPage rejects on error', function(t) {
  t.fail();
  t.end();
});
