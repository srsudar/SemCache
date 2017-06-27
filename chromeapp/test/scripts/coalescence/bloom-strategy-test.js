'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const BloomFilter = require('../../../app/scripts/coalescence/bloom-filter').BloomFilter;
const coalObjects = require('../../../app/scripts/coalescence/objects');
const pifCommon = require('../../../app/scripts/peer-interface/common');
const tutil = require('../test-util');

let bloomStrat = require('../../../app/scripts/coalescence/bloom-strategy');


function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/bloom-strategy')
  ];
  bloomStrat = require('../../../app/scripts/coalescence/bloom-strategy');
}

function proxyquireBloom(proxies) {
  bloomStrat= proxyquire(
    '../../../app/scripts/coalescence/bloom-strategy', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  reset();
  t.end();
}

function createPeerInfos() {
  return [...tutil.genCacheInfos(2)];
}

function createBloomFilters() {
  let a = new BloomFilter();
  a.add('foo');
  let b = new BloomFilter();
  return [a, b];
}

function createProcessedBlooms() {
  let peerInfos = createPeerInfos();
  let bloomFilters = createBloomFilters();

  return [
    new coalObjects.PeerBloomFilter(peerInfos[0], bloomFilters[0].serialize()),
    new coalObjects.PeerBloomFilter(peerInfos[1], bloomFilters[1].serialize()),
  ];
}

test('initialize rejects if something goes wrong', function(t) {
  let expectedErr = { msg: 'browse rejected' };
  proxyquireBloom({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().rejects(expectedErr)
    }
  });

  let bloom = new bloomStrat.BloomStrategy();

  t.false(bloom.isInitializing());
  t.false(bloom.isInitialized());

  bloom.initialize()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    t.false(bloom.isInitializing());
    t.false(bloom.isInitialized());
    end(t);
  });
});

test('initialize resolves on success', function(t) {
  let peerInfos = createPeerInfos();
  let processedBlooms = createProcessedBlooms();

  let peerAccessor = 'I am a fake peer accessor';
  let removeOwnInfoStub = sinon.stub().resolves(peerInfos);

  proxyquireBloom({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().resolves(peerInfos)
    },
    '../peer-interface/manager': {
      getPeerAccessor: sinon.stub().returns(peerAccessor)
    },
    './util': {
      removeOwnInfo: removeOwnInfoStub
    }
  });

  let bloom = new bloomStrat.BloomStrategy();

  let getAndProcessStub = sinon.stub();
  getAndProcessStub
    .withArgs(peerAccessor, peerInfos)
    .resolves(processedBlooms);
  bloom.getAndProcessBloomFilters = getAndProcessStub;

  // Rather than use a stub to monitor whether or not the blooms have been
  // set, we're going to use a function so that we can also assert that the
  // isInitializing() function is set correctly.
  let moduleBlooms = null;
  bloom.setBloomFilters = function(passedBlooms) {
    moduleBlooms = passedBlooms;
    t.true(bloom.isInitializing());
  };

  t.false(bloom.isInitializing());
  t.false(bloom.isInitialized());

  bloom.initialize()
  .then(actual => {
    t.deepEqual(actual, undefined);
    t.false(bloom.isInitializing());
    t.true(bloom.isInitialized());
    // And the blooms should have been set
    t.deepEqual(moduleBlooms, processedBlooms);
    t.deepEqual(removeOwnInfoStub.args[0], [ peerInfos ]);
    t.true(removeOwnInfoStub.calledOnce);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessBloomFilters returns empty array if no peers', function(t) {
  let digest = new bloomStrat.BloomStrategy();
  let expected = [];

  digest.getAndProcessBloomFilters({}, [])
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});


test('getAndProcessBloomFilters resolves all success', function(t) {
  let peerInfos = createPeerInfos();
  let bloomFilters = createBloomFilters();
  bloomFilters = bloomFilters.map(bf => bf.serialize());

  let getCacheBloomStub = sinon.stub();
  getCacheBloomStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(bloomFilters[0]);
  getCacheBloomStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).resolves(bloomFilters[1]);
  
  let peerInterface = {
    getCacheBloomFilter: getCacheBloomStub
  };

  let expected = createProcessedBlooms();
  let bloom = new bloomStrat.BloomStrategy();

  bloom.getAndProcessBloomFilters(peerInterface, peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessBloomFilters resolves last rejects', function(t) {
  let peerInfos = createPeerInfos();
  let bloomFilters = createBloomFilters();
  bloomFilters = bloomFilters.map(bf => bf.serialize());

  let getCacheBloomStub = sinon.stub();
  getCacheBloomStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(bloomFilters[0]);
  getCacheBloomStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).rejects({ msg: 'an error that will be swallowed' });
  
  let peerInterface = {
    getCacheBloomFilter: getCacheBloomStub
  };

  let expected = [
    new coalObjects.PeerBloomFilter(peerInfos[0], bloomFilters[0])
  ];
  let bloom = new bloomStrat.BloomStrategy();

  bloom.getAndProcessBloomFilters(peerInterface, peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('performQuery returns empty array if no matches', function(t) {
  let bloom1 = sinon.stub();
  bloom1.performQueryForPage = sinon.stub().returns(false);
  let bloom2 = sinon.stub();
  bloom2.performQueryForPage = sinon.stub().returns(false);

  let blooms = [bloom1, bloom2];
  let bloom = new bloomStrat.BloomStrategy();
  bloom.setBloomFilters(blooms);
  bloom.isInitialized = sinon.stub().returns(true);

  bloom.performQuery(['http://foo.com', 'http://bar.com'])
  .then(actual => {
    t.deepEqual(actual, []);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('performQuery correct with extant pages', function(t) {
  let peerInfos = createPeerInfos();

  let peer1 = peerInfos[0];
  let peer2 = peerInfos[1];

  // We want to handle duplicates as well as single results.
  let urlOnly1 = 'http://onbloom1.com';
  let urlOnly2 = 'http://onbloom2.com';
  let urlNeither = 'http://inNoblooms.com';
  let urlBoth = 'http://inBothblooms.com';

  let urls = [ urlOnly1, urlOnly2, urlNeither, urlBoth ];

  let urlOnly1Result = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      captureHref: urlOnly1,
    },
  ];

  let urlOnly2Result = [
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      captureHref: urlOnly2,
    }
  ];

  let urlBothResult = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      captureHref: urlBoth,
    },
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      captureHref: urlBoth,
    }
  ];

  let expected = {};
  expected[urlOnly1] = urlOnly1Result;
  expected[urlOnly2] = urlOnly2Result;
  expected[urlBoth] = urlBothResult;

  let performQueryOneStub = sinon.stub();
  performQueryOneStub.withArgs(urlOnly1).returns(true);
  performQueryOneStub.withArgs(urlBoth).returns(true);

  let performQueryTwoStub = sinon.stub();
  performQueryTwoStub.withArgs(urlOnly2).returns(true);
  performQueryTwoStub.withArgs(urlBoth).returns(true);

  let blooms = [
    {
      peerInfo: peer1,
      performQueryForPage: performQueryOneStub
    },
    {
      peerInfo: peer2,
      performQueryForPage: performQueryTwoStub
    }
  ];
  let bloom = new bloomStrat.BloomStrategy();
  bloom.setBloomFilters(blooms);
  bloom.isInitialized = sinon.stub().returns(true);

  bloom.performQuery(urls)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('performQuery rejects with Error', function(t) {
  let expected = { msg: 'I am an error' };

  let bloomStub = { 
    performQueryForPage: sinon.stub().throws(expected)
  };

  let bloom = new bloomStrat.BloomStrategy();
  bloom.setBloomFilters([ bloomStub ]);

  bloom.performQuery([ 'http://woot.com' ])
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('reset restores state', function(t) {
  proxyquireBloom({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().resolves()
    },
    '../peer-interface/manager': {
      getPeerAccessor: sinon.stub().returns()
    },
    './util': {
      removeOwnInfo: sinon.stub().resolves()
    }
  });
  let bloom = new bloomStrat.BloomStrategy();
  bloom.getAndProcessBloomFilters = sinon.stub().resolves(['a']);
  bloom.setBloomFilters = sinon.stub();

  bloom.initialize()
  .then(() => {
    t.false(bloom.isInitializing());
    t.true(bloom.isInitialized());

    bloom.reset();
    t.false(bloom.isInitializing());
    t.false(bloom.isInitialized());
    // The second call will have been the reset one
    t.deepEqual(bloom.setBloomFilters.args[1][0], []);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

