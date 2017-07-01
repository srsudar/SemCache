'use strict';

const sinon = require('sinon');
const test = require('tape');

const coalObjects = require('../../../app/scripts/coalescence/objects');
const sutil = require('../server/util');
const tutil = require('../test-util');

let bloomStrat = require('../../../app/scripts/coalescence/bloom-strategy');


function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/bloom-strategy')
  ];
  bloomStrat = require('../../../app/scripts/coalescence/bloom-strategy');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  reset();
  t.end();
}

test('performQuery returns empty array if no matches', function(t) {
  let bloom1 = sinon.stub();
  bloom1.performQueryForPage = sinon.stub().returns(false);
  let bloom2 = sinon.stub();
  bloom2.performQueryForPage = sinon.stub().returns(false);

  let blooms = [bloom1, bloom2];
  let bloom = new bloomStrat.BloomStrategy();
  bloom.setResources(blooms);
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
  let peerInfos = [...tutil.genCacheInfos(2)];

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
  bloom.setResources(blooms);
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
  bloom.setResources([ bloomStub ]);

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

test('getResourceFromPeer resolves on success', function(t) {
  let peerInfo = tutil.genCacheInfos(1).next().value;
  let rawBloom = sutil.getBloomResponseParsed();

  let pa = {
    getCacheBloomFilter: sinon.stub().resolves(rawBloom)
  };

  let expected = new coalObjects.PeerBloomFilter(peerInfo, rawBloom);

  let bloom = new bloomStrat.BloomStrategy();

  bloom.getResourceFromPeer(pa, peerInfo)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResourceFromPeer rejects on err', function(t) {
  let expected = { msg: 'nope' };
  let pa = {
    getCacheBloomFilter: sinon.stub().rejects(expected)
  };

  let bloom = new bloomStrat.BloomStrategy();

  bloom.getResourceFromPeer(pa, null)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
