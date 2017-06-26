'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var common = require('../../../app/scripts/peer-interface/common');
var httpImpl = require('../../../app/scripts/peer-interface/http-impl');

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
  var peer = new httpImpl.HttpPeerAccessor();
  t.notEqual(null, peer);
  end(t);
});

test('getFileBlob resolves with blob', function(t) {
  var mhtmlUrl = 'the url';
  var response = sinon.stub();
  var expected = { testType: 'I am the blob, coo coo cuchoo' };
  response.blob = sinon.stub().resolves(expected);

  let params = common.createFileParams('foo', 1234);
  params.fileUrl = mhtmlUrl;

  var fetchSpy = sinon.stub();
  fetchSpy.withArgs(mhtmlUrl).resolves(response);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var pa = new httpImpl.HttpPeerAccessor();
  pa.getFileBlob(params)
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFileBlob rejects with error', function(t) {
  var url = 'url';
  var expected = { error: 'fetch went south' };
  var fetchSpy = sinon.stub().rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var pa = new httpImpl.HttpPeerAccessor();
  pa.getFileBlob(url)
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
  var listUrl = 'http://1.2.3.4:22';
  var expected = { list: 'so many pages' };
  var response = sinon.stub();
  response.json = sinon.stub().resolves(expected);

  var fetchSpy = sinon.stub();
  fetchSpy.withArgs(listUrl).resolves(response);
  
  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var params = common.createListParams(null, null, listUrl);
  var peerAccessor = new httpImpl.HttpPeerAccessor();
  peerAccessor.getList(params)
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
  var expected = { error: 'fetch done gone wrong' };
  var fetchSpy = sinon.stub().rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var peerAccessor = new httpImpl.HttpPeerAccessor();
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
  var digestUrl = 'http://1.2.3.4:22/page_digest';
  var expected = { digest: 'lots of stuff' };
  var response = sinon.stub();
  response.json = sinon.stub().resolves(expected);

  var params = { digestUrl: digestUrl };
  var fetchSpy = sinon.stub();
  fetchSpy.withArgs(digestUrl).resolves(response);
  
  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var peerAccessor = new httpImpl.HttpPeerAccessor();
  peerAccessor.getCacheDigest(params)
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
  var expected = { error: 'fetch done gone wrong' };
  var fetchSpy = sinon.stub().rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var peerAccessor = new httpImpl.HttpPeerAccessor();
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
