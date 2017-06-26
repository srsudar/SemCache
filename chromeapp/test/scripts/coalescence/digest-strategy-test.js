'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

let digestStrategy = require('../../../app/scripts/coalescence/digest-strategy');

const coalObjects = require('../../../app/scripts/coalescence/objects');
const objects = require('../../../app/scripts/coalescence/objects');
const pifCommon = require('../../../app/scripts/peer-interface/common');
const tutil = require('../test-util');

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
}

function proxyquireDigest(proxies) {
  digestStrategy= proxyquire(
    '../../../app/scripts/coalescence/digest-strategy', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetDigest();
  t.end();
}

function createPeerInfos() {
  return [...tutil.genCacheInfos(2)];
}

function createRawDigests() {
  var digest1 = [
    {
      fullUrl: 'http://foo.com',
      captureDate: '2017-04-03'
    }
  ];
  var digest2 = [
    {
      fullUrl: 'http://two.com',
      captureDate: '2017-05-03'
    }
  ];
  return [digest1, digest2];
}

function createProcessedDigests() {
  var peerInfos = createPeerInfos();
  var rawDigests = createRawDigests();
  var result = [];
  for (var i = 0; i < peerInfos.length; i++) {
    var digest = new coalObjects.Digest(peerInfos[i], rawDigests[i]);
    result.push(digest);
  }
  return result;
}

test('initialize rejects if something goes wrong', function(t) {
  var expectedErr = { msg: 'browse rejected' };
  proxyquireDigest({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().rejects(expectedErr)
    }
  });

  var digest = new digestStrategy.DigestStrategy();

  t.false(digest.isInitializing());
  t.false(digest.isInitialized());

  digest.initialize()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    t.false(digest.isInitializing());
    t.false(digest.isInitialized());
    end(t);
  });
});

test('initialize resolves on success', function(t) {
  var peerInfos = [
    {
      ipAddress: '1.2.3.4',
      port: 1234
    }
  ];
  var processedDigests = [
    { digest: 'ate too much' },
    { digest: 'starving' }
  ];
  var peerAccessor = 'I am a fake peer accessor';
  var removeOwnInfoStub = sinon.stub().resolves(peerInfos);

  proxyquireDigest({
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

  var digest = new digestStrategy.DigestStrategy();

  let getAndProcessDigestsStub = sinon.stub();
  getAndProcessDigestsStub
    .withArgs(peerAccessor, peerInfos)
    .resolves(processedDigests);

  digest.getAndProcessDigests = getAndProcessDigestsStub;
  // Rather than use a stub to monitor whether or not the digests have been
  // set, we're going to use a function so that we can also assert that the
  // isInitializing() function is set correctly.
  var moduleDigests = null;
  digest.setDigests = function(passedDigests) {
    moduleDigests = passedDigests;
    t.true(digest.isInitializing());
  };

  t.false(digest.isInitializing());
  t.false(digest.isInitialized());

  digest.initialize()
  .then(actual => {
    t.deepEqual(actual, undefined);
    t.false(digest.isInitializing());
    t.true(digest.isInitialized());
    // And the digests should have been set
    t.equal(moduleDigests, processedDigests);
    t.deepEqual(removeOwnInfoStub.args[0], [ peerInfos ]);
    t.true(removeOwnInfoStub.calledOnce);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessDigests resolves all success', function(t) {
  var peerInfos = createPeerInfos();
  var rawDigests = createRawDigests();

  var digestResponse1 = {
    metadata: 'whatever',
    digest: rawDigests[0]
  };
  var digestResponse2 = {
    metadata: 'whatever',
    digest: rawDigests[1]
  };

  var getCacheDigestStub = sinon.stub();
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(digestResponse1);
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).resolves(digestResponse2);
  
  var peerInterface = {
    getCacheDigest: getCacheDigestStub
  };

  var expected = createProcessedDigests();
  var digest = new digestStrategy.DigestStrategy();

  digest.getAndProcessDigests(peerInterface, peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessDigests returns empty array if no peers', function(t) {
  let digest = new digestStrategy.DigestStrategy();
  let expected = [];

  digest.getAndProcessDigests({}, [])
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessDigests resolves last rejects', function(t) {
  var peerInfos = createPeerInfos();
  var rawDigests = createRawDigests();

  var digestResponse1 = {
    metadata: 'yawn',
    digest: rawDigests[0]
  };

  var getCacheDigestStub = sinon.stub();
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(digestResponse1);
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).rejects({ msg: 'an error that will be swallowed' });
  
  var peerInterface = {
    getCacheDigest: getCacheDigestStub
  };

  var expected = createProcessedDigests().slice(0, 1);
  var digest = new digestStrategy.DigestStrategy();

  digest.getAndProcessDigests(peerInterface, peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessDigests resolves all reject', function(t) {
  var peerInfos = createPeerInfos();

  var getCacheDigestStub = sinon.stub();
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).rejects({ msg: 'first will be swallowed' });
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).rejects({ msg: 'second that will be swallowed' });
  
  var peerInterface = {
    getCacheDigest: getCacheDigestStub
  };

  var expected = [];
  var digest = new digestStrategy.DigestStrategy();

  digest.getAndProcessDigests(peerInterface, peerInfos)
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
  var digest1 = sinon.stub();
  digest1.performQueryForPage = sinon.stub().returns(null);
  var digest2 = sinon.stub();
  digest2.performQueryForPage = sinon.stub().returns(null);

  var digests = [digest1, digest2];
  var digest = new digestStrategy.DigestStrategy();
  digest.setDigests(digests);
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
  var peerInfos = createPeerInfos();

  let peer1 = peerInfos[0];
  let peer2 = peerInfos[1];

  var urlOnly1CaptureDate = '2014-05-01';
  var urlOnly2CaptureDate = '2014-06-01';
  var urlBothCaptureDatePeer1 = '2014-07-01';
  var urlBothCaptureDatePeer2 = '2014-07-02';

  // We want to handle duplicates as well as single results.
  var urlOnly1 = 'http://onDigest1.com';
  var urlOnly2 = 'http://onDigest2.com';
  var urlNeither = 'http://inNoDigests.com';
  var urlBoth = 'http://inBothDigests.com';

  var urls = [ urlOnly1, urlOnly2, urlNeither, urlBoth ];

  var urlOnly1Result = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      href: urlOnly1,
      captureDate: urlOnly1CaptureDate
    },
  ];

  var urlOnly2Result = [
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      href: urlOnly2,
      captureDate: urlOnly2CaptureDate
    }
  ];

  var urlBothResult = [
    {
      serviceName: peer1.instanceName,
      friendlyName: peer1.friendlyName,
      href: urlBoth,
      captureDate: urlBothCaptureDatePeer1
    },
    {
      serviceName: peer2.instanceName,
      friendlyName: peer2.friendlyName,
      href: urlBoth,
      captureDate: urlBothCaptureDatePeer2
    }
  ];

  var expected = {};
  expected[urlOnly1] = urlOnly1Result;
  expected[urlOnly2] = urlOnly2Result;
  expected[urlBoth] = urlBothResult;

  // Note that this does not fully mock out the Digest object. Doing so led to
  // too much duplication of API, so this is not a true unit test.
  var digest1 = new objects.Digest(
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

  var digest2 = new objects.Digest(
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
  
  var digests = [ digest1, digest2 ];
  var digest = new digestStrategy.DigestStrategy();
  digest.setDigests(digests);
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
  var expected = { msg: 'I am an error' };

  var digestStub = { 
    performQueryForPage: sinon.stub().throws(expected)
  };

  var digest = new digestStrategy.DigestStrategy();
  digest.setDigests([ digestStub ]);

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

test('reset restores state', function(t) {
  proxyquireDigest({
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
  var digest = new digestStrategy.DigestStrategy();
  digest.getAndProcessDigests = sinon.stub().resolves(['a']);
  digest.setDigests = sinon.stub();

  digest.initialize()
  .then(() => {
    t.false(digest.isInitializing());
    t.true(digest.isInitialized());

    digest.reset();
    t.false(digest.isInitializing());
    t.false(digest.isInitialized());
    // The second call will have been the reset one
    t.deepEqual(digest.setDigests.args[1][0], []);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
