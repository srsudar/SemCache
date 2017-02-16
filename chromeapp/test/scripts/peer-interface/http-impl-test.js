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

test('can create PeerAccessor', function(t) {
  var peer = new httpImpl.HttpPeerAccessor();
  t.notEqual(null, peer);
  t.end();
});

test('getFileBlob resolves with blob', function(t) {
  var mhtmlUrl = 'the url';
  var response = sinon.stub();
  var expected = { testType: 'I am the blob, coo coo cuchoo' };
  response.blob = sinon.stub().resolves(expected);
  var fetchSpy = sinon.stub().withArgs(mhtmlUrl).resolves(response);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var pa = new httpImpl.HttpPeerAccessor();
  pa.getFileBlob(mhtmlUrl)
  .then(actual => {
    t.equal(actual, expected);
    t.end();
    resetHttpImpl();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetHttpImpl();
  });
});

test('getFileBlob rejects with error', function(t) {
  var url = 'url';
  var expected = { error: 'fetch went south' };
  var fetchSpy = sinon.stub().withArgs(url).rejects(expected);

  proxyquireHttpImpl({
    '../util': {
      fetch: fetchSpy
    }
  });

  var pa = new httpImpl.HttpPeerAccessor();
  pa.getFileBlob(url)
  .then(res => {
    t.fail(res);
    t.end();
    resetHttpImpl();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetHttpImpl();
  });
});

test('getList resolves with json', function(t) {
  var listUrl = 'http://1.2.3.4:22';
  var expected = { list: 'so many pages' };
  var response = sinon.stub();
  response.json = sinon.stub().resolves(expected);

  var fetchSpy = sinon.stub().withArgs(listUrl).resolves(response);
  
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
    t.end();
    resetHttpImpl();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetHttpImpl();
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
    t.end();
    resetHttpImpl();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetHttpImpl();
  });
});
