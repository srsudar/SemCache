'use strict';

var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var digest = require('../../../app/scripts/coalescence/digest-strategy');
var coalObjects = require('../../../app/scripts/coalescence/objects');
var objects = require('../../../app/scripts/coalescence/objects');
var pifCommon = require('../../../app/scripts/peer-interface/common');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDigest() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/digest-strategy')
  ];
  digest = require('../../../app/scripts/coalescence/digest-strategy');
}

function proxyquireDigest(proxies) {
  digest = proxyquire(
    '../../../app/scripts/coalescence/digest-strategy', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetDigest();
  t.end();
}

function createPeerInfos() {
  var peerInfo1 = {
    ipAddress: '1.2.3.4',
    port: 1111
  };
  var peerInfo2 = {
    ipAddress: '9.8.7.6',
    port: 2222
  };

  return [peerInfo1, peerInfo2];
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

  proxyquireDigest({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().resolves(peerInfos)
    },
    '../peer-interface/manager': {
      getPeerAccessor: sinon.stub().returns(peerAccessor)
    }
  });
  digest.getAndProcessDigests = sinon.stub().withArgs(peerAccessor, peerInfos)
    .resolves(processedDigests);
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

  var getCacheDigestStub = sinon.stub();
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(rawDigests[0]);
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).resolves(rawDigests[1]);
  
  var peerInterface = {
    getCacheDigest: getCacheDigestStub
  };

  var expected = createProcessedDigests();

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

test('getAndProcessDigests resolves last rejects', function(t) {
  var peerInfos = createPeerInfos();
  var rawDigests = createRawDigests();

  var getCacheDigestStub = sinon.stub();
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[0].ipAddress, peerInfos[0].port, null
    )
  ).resolves(rawDigests[0]);
  getCacheDigestStub.withArgs(
    pifCommon.createListParams(
      peerInfos[1].ipAddress, peerInfos[1].port, null
    )
  ).rejects({ msg: 'an error that will be swallowed' });
  
  var peerInterface = {
    getCacheDigest: getCacheDigestStub
  };

  var expected = createProcessedDigests().slice(0, 1);

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
    new objects.NetworkCachedPage(
      'probable',
      {
        url: urlOnly1,
        captureDate: urlOnly1CaptureDate
      },
      peerInfos[0]
    )
  ];

  var urlOnly2Result = [
    new objects.NetworkCachedPage(
      'probable',
      {
        url: urlOnly2,
        captureDate: urlOnly2CaptureDate
      },
      peerInfos[1]
    )
  ];

  var urlBothResult = [
    new objects.NetworkCachedPage(
      'probable', {
        url: urlBoth,
        captureDate: urlBothCaptureDatePeer1
      },
      peerInfos[0]
    ),
    new objects.NetworkCachedPage(
      'probable',
      {
        url: urlBoth,
        captureDate: urlBothCaptureDatePeer2
      },
      peerInfos[1]
    )
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
        url: urlOnly1,
        captureDate: urlOnly1CaptureDate
      },
      {
        url: urlBoth,
        captureDate: urlBothCaptureDatePeer1
      }
    ]
  );

  var digest2 = new objects.Digest(
    peerInfos[1],
    [
      {
        url: urlOnly2,
        captureDate: urlOnly2CaptureDate
      },
      {
        url: urlBoth,
        captureDate: urlBothCaptureDatePeer2
      }
    ]
  );
  
  var digests = [ digest1, digest2 ];
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
    }
  });
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
