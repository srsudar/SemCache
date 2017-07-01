'use strict';

const sinon = require('sinon');
const test = require('tape');

const coalObjects = require('../../../app/scripts/coalescence/objects');
const objects = require('../../../app/scripts/coalescence/objects');
const sutil = require('../server/util');
const tutil = require('../test-util');

let digestStrategy = require('../../../app/scripts/coalescence/digest-strategy');

let DigestStrategy = digestStrategy.DigestStrategy;


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDigest() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/digest-strategy')
  ];
  digestStrategy = require('../../../app/scripts/coalescence/digest-strategy');
  DigestStrategy = digestStrategy.DigestStrategy;
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetDigest();
  t.end();
}

test('performQuery returns empty array if no matches', function(t) {
  let digest1 = sinon.stub();
  digest1.performQueryForPage = sinon.stub().returns(null);
  let digest2 = sinon.stub();
  digest2.performQueryForPage = sinon.stub().returns(null);

  let digests = [digest1, digest2];
  let digest = new DigestStrategy();
  digest.setResources(digests);
  digest.isInitialized = sinon.stub().returns(true);

  digest.performQuery(['http://foo.com', 'http://bar.com'])
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

  let urlOnly1CaptureDate = '2014-05-01';
  let urlOnly2CaptureDate = '2014-06-01';
  let urlBothCaptureDatePeer1 = '2014-07-01';
  let urlBothCaptureDatePeer2 = '2014-07-02';

  // We want to handle duplicates as well as single results.
  let urlOnly1 = 'http://onDigest1.com';
  let urlOnly2 = 'http://onDigest2.com';
  let urlNeither = 'http://inNoDigests.com';
  let urlBoth = 'http://inBothDigests.com';

  let urls = [ urlOnly1, urlOnly2, urlNeither, urlBoth ];

  let urlOnly1Result = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      captureHref: urlOnly1,
      captureDate: urlOnly1CaptureDate
    },
  ];

  let urlOnly2Result = [
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      captureHref: urlOnly2,
      captureDate: urlOnly2CaptureDate
    }
  ];

  let urlBothResult = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      captureHref: urlBoth,
      captureDate: urlBothCaptureDatePeer1
    },
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      captureHref: urlBoth,
      captureDate: urlBothCaptureDatePeer2
    }
  ];

  let expected = {};
  expected[urlOnly1] = urlOnly1Result;
  expected[urlOnly2] = urlOnly2Result;
  expected[urlBoth] = urlBothResult;

  // Note that this does not fully mock out the Digest object. Doing so led to
  // too much duplication of API, so this is not a true unit test.
  let digest1 = new objects.Digest(
    peerInfos[0],
    [
      {
        fullUrl: urlOnly1,
        captureDate: urlOnly1CaptureDate
      },
      {
        fullUrl: urlBoth,
        captureDate: urlBothCaptureDatePeer1
      }
    ]
  );

  let digest2 = new objects.Digest(
    peerInfos[1],
    [
      {
        fullUrl: urlOnly2,
        captureDate: urlOnly2CaptureDate
      },
      {
        fullUrl: urlBoth,
        captureDate: urlBothCaptureDatePeer2
      }
    ]
  );
  
  let digests = [ digest1, digest2 ];
  let digest = new DigestStrategy();
  digest.setResources(digests);
  digest.isInitialized = sinon.stub().returns(true);

  digest.performQuery(urls)
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

  let digestStub = { 
    performQueryForPage: sinon.stub().throws(expected)
  };

  let digest = new DigestStrategy();
  digest.setResources([ digestStub ]);

  digest.performQuery([ 'http://woot.com' ])
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getResourceFromPeer resolves with digest', function(t) {
  let rawDigest = sutil.getDigestResponseParsed();
  let peerInfo = tutil.genCacheInfos(1).next().value;
  let expected = new coalObjects.Digest(peerInfo, rawDigest);

  let pa = sinon.stub();
  pa.getCacheDigest = sinon.stub().resolves(rawDigest);

  let digest = new DigestStrategy();
  digest.getResourceFromPeer(pa, peerInfo)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResourceFromPeer rejects on error', function(t) {
  let expected = { msg: 'err' };

  let pa = {
    getCacheDigest: sinon.stub().rejects(expected)
  };

  let digest = new DigestStrategy();
  digest.getResourceFromPeer(pa, null)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
