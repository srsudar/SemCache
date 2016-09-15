/*jshint esnext:true*/
'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var evaluation = require('../../app/scripts/evaluation');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetEvaluation() {
  delete require.cache[
    require.resolve('../../app/scripts/evaluation')
  ];
}

/**
 * Proxyquire the evaluation object with proxies passed as the proxied modules.
 */
function proxyquireEvaluation(proxies) {
  evaluation = proxyquire(
    '../../app/scripts/evaluation',
    proxies
  );
}

test('getTimeValues returns result of get', function(t) {
  var key = 'timeMePlz';
  var scopedKey = 'timing_timeMePlz';
  var expected = [1, 2, 3];

  var getResult = {};
  getResult[scopedKey] = expected;
  var getSpy = sinon.stub().resolves(getResult);

  proxyquireEvaluation({
    './chrome-apis/storage': {
      get: getSpy
    }
  });

  evaluation.getTimeValues(key)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.deepEqual(getSpy.args[0], [scopedKey]);
      t.end();
      resetEvaluation();
    });
});

test('getTimeValues returns null if not present', function(t) {
  var key = 'timeMePlz';
  var scopedKey = 'timing_timeMePlz';
  var expected = null;

  var getSpy = sinon.stub().resolves({});

  proxyquireEvaluation({
    './chrome-apis/storage': {
      get: getSpy
    }
  });

  evaluation.getTimeValues(key)
    .then(actual => {
      t.equal(actual, expected);
      t.deepEqual(getSpy.args[0], [scopedKey]);
      t.end();
      resetEvaluation();
    });
});

test('fulfillPromises all resolve', function(t) {
  var expected = [ 
    { resolved: 0.1 },
    { resolved: 1.1 },
    { resolved: 2.1 },
    { resolved: 3.1 },
    { resolved: 4.1 }
  ];

  var promises = [];
  promises[0] = () => Promise.resolve(expected[0].resolved);

  // This value will have the option to not resolve immediately, to ensure that
  // we are waiting between executing in order to do so synchronously.
  var delayedResolve = function() {
    return new Promise(function(resolve) {
      setTimeout(
        function() {
          resolve(expected[1].resolved);
        },
        // change to a >0 number, like 1000, to ensure that we execute the
        // Promises in order and not parallelized. We are keeping it at 0 for
        // the checked in version to resolve immediately and not slow down the
        // tests.
        0
      );
    });
  };

  promises[1] = delayedResolve;
  promises[2] = () => Promise.resolve(expected[2].resolved);
  promises[3] = () => Promise.resolve(expected[3].resolved);
  promises[4] = () => Promise.resolve(expected[4].resolved);

  evaluation.fulfillPromises(promises)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation(); 
  });
});

test('fulfillPromises all reject', function(t) {
  var expected = [ 
    { caught: 0.1 },
    { caught: 1.1 },
    { caught: 2.1 },
    { caught: 3.1 },
    { caught: 4.1 }
  ];

  var promises = [];
  promises[0] = () => Promise.reject(expected[0].caught);
  promises[1] = () => Promise.reject(expected[1].caught);
  promises[2] = () => Promise.reject(expected[2].caught);
  promises[3] = () => Promise.reject(expected[3].caught);
  promises[4] = () => Promise.reject(expected[4].caught);

  evaluation.fulfillPromises(promises)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation(); 
  });

});

test('runDiscoverPeerPagesIteration resolves if all is well', function(t) {
  var numPeers = 2;
  var numPages = 5;

  var peer1 = {
    serviceName: 'Tyrion Cache',
    type: '_semcache._tcp',
    domain: 'tyrion.local',
    port: 8877,
    ipAddress: '1.2.3.4'
  };

  var peer2 = {
    serviceName: 'Cersei Cache',
    type: '_semcache._tcp',
    domain: 'cersei.local',
    port: 8888,
    ipAddress: '172.198.14.23'
  };

  // We will return < the number we expect.
  var resolvedInstances = [ peer1, peer2 ];

  var peer1Response = {
    metadata: { version: 0 },
    cachedPages: [ 'one', 'two', 'three', 'four', 'five' ]
  };

  var peer2Response = {
    metadata: { version: 0 },
    cachedPages: [ 'a', 'b', 'c', 'd', 'e' ]
  };

  var evalUrl1 = 'tyrion/eval.json';
  var evalUrl2 = 'cersei/eval.json';
  var getEvalPagesUrlSpy = sinon.stub();
  getEvalPagesUrlSpy.onCall(0).returns(evalUrl1);
  getEvalPagesUrlSpy.onCall(1).returns(evalUrl2);

  var fetchJsonSpy = sinon.stub();
  fetchJsonSpy.withArgs(evalUrl1).resolves(peer1Response);
  fetchJsonSpy.withArgs(evalUrl2).resolves(peer2Response);

  var startTime = 5413;
  var browsePeerEnd = 8171;
  var browsePageEnd = 1200;
  var totalTime = browsePageEnd - startTime;
  var browsePeerTime = browsePeerEnd - startTime;
  var browsePageTime = browsePageEnd - browsePeerEnd;

  var getNowSpy = sinon.stub();
  getNowSpy.onCall(0).returns(startTime);
  getNowSpy.onCall(1).returns(browsePeerEnd);
  getNowSpy.onCall(2).returns(browsePageEnd);
  
  var expected = {
    timeBrowsePeers: browsePeerTime,
    timeBrowsePages: browsePageTime,
    totalTime: totalTime
  };

  var getBrowseableCachesSpy = sinon.stub().resolves(resolvedInstances);
  proxyquireEvaluation({
    './app-controller': {
      getBrowseableCaches: getBrowseableCachesSpy
    },
    './util': {
      fetchJson: fetchJsonSpy
    }
  });
  evaluation.getNow = getNowSpy;
  evaluation.getEvalPagesUrl = getEvalPagesUrlSpy;
  
  evaluation.runDiscoverPeerPagesIteration(numPeers, numPages)
  .then(actual => { 
    t.deepEqual(actual, expected);
    t.equal(fetchJsonSpy.callCount, 2);
    t.deepEqual(
      getEvalPagesUrlSpy.args[0],
      [
        peer1.ipAddress,
        peer1.port,
        numPages
      ]
    );
    t.deepEqual(
      getEvalPagesUrlSpy.args[1],
      [
        peer2.ipAddress,
        peer2.port,
        numPages
      ]
    );
    t.deepEqual(fetchJsonSpy.args[0], [ evalUrl1 ]);
    t.deepEqual(fetchJsonSpy.args[1], [ evalUrl2 ]);
    t.end();
    resetEvaluation();
  });
});

test('runDiscoverPeerPagesIteration rejects if not enough pages', function(t) {
  var numPeers = 2;
  var numPages = 5;

  var peer1 = {
    serviceName: 'Tyrion Cache',
    type: '_semcache._tcp',
    domain: 'tyrion.local',
    port: 8877,
    ipAddress: '1.2.3.4'
  };

  var peer2 = {
    serviceName: 'Cersei Cache',
    type: '_semcache._tcp',
    domain: 'cersei.local',
    port: 8888,
    ipAddress: '172.2.9.45'
  };

  var resolvedInstances = [ peer1, peer2 ];

  var evalUrl1 = 'tyrionlist.json';
  var evalUrl2 = 'cersei/list.json';
  var getEvalPagesUrlSpy = sinon.stub();
  getEvalPagesUrlSpy.withArgs(peer1.ipAddress).returns(evalUrl1);
  getEvalPagesUrlSpy.withArgs(peer2.ipAddress).returns(evalUrl2);

  var peer1Response = {
    metadata: { version: 0 },
    cachedPages: [ 'one', 'two', 'three' ]
  };
  var fetchJsonSpy = sinon.stub();
  fetchJsonSpy.withArgs(evalUrl1).resolves(peer1Response);
  
  var expected = { err: 'missing pages: found 3, expected 5' };

  var getBrowseableCachesSpy = sinon.stub().resolves(resolvedInstances);
  proxyquireEvaluation({
    './app-controller': {
      getBrowseableCaches: getBrowseableCachesSpy
    },
    './util': {
      fetchJson: fetchJsonSpy
    }
  });
  evaluation.getNow = sinon.stub();
  evaluation.getEvalPagesUrl = getEvalPagesUrlSpy;
  
  evaluation.runDiscoverPeerPagesIteration(numPeers, numPages)
  .catch(actual => { 
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation();
  });
});

test('runDiscoverPeerPagesIteration rejects if missing peers', function(t) {
  var numPeers = 5;
  var numPages = 10;

  // We will return < the number we expect.
  var resolvedCaches = [ 'one', 'two', 'three', 'four' ];
  
  var expected = { err: 'missing peer: found 4, expected 5' };

  var getBrowseableCachesSpy = sinon.stub().resolves(resolvedCaches);
  proxyquireEvaluation({
    './app-controller': {
      getBrowseableCaches: getBrowseableCachesSpy
    }
  });
  evaluation.getNow = sinon.stub();
  
  evaluation.runDiscoverPeerPagesIteration(numPeers, numPages)
  .catch(actual => { 
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation();
  });
});

test('runDiscoverPeerPagesTrial calls helper', function(t) {
  var numPeers = 30;
  var numPages = 15;
  var numIterations = 4;
  var key = 'testKey';

  var expected = [
    { resolved: 'fee' },
    { resolved: 'fi' },
    { resolved: 'fo' },
    { resolved: 'fum' }
  ];

  proxyquireEvaluation({
    './util': {
      wait: sinon.stub().resolves()
    }
  });
  
  var logTimeSpy = sinon.stub();
  var runDiscoverPeerPagesIterationSpy = sinon.stub();
  for (var i = 0; i < expected.length; i++) {
    logTimeSpy.onCall(i).resolves();
    runDiscoverPeerPagesIterationSpy.onCall(i).resolves(expected[i].resolved);
  }
  evaluation.logTime = logTimeSpy;
  evaluation.runDiscoverPeerPagesIteration = runDiscoverPeerPagesIterationSpy;

  evaluation.runDiscoverPeerPagesTrial(numPeers, numPages, numIterations, key)
  .then(actual => {
    t.deepEqual(actual, expected);

    for (var j = 0; j < expected.length; j++) {
      console.log('first j: ', j);
      t.deepEqual(
        logTimeSpy.args[j],
        [
          key,
          {
            timing: expected[j].resolved,
            type: 'discoverPeers',
            numPeers: numPeers,
            numPages: numPages,
            numIterations: numIterations,
            iteration: j
          }
        ]
      );
    }

    t.end();
    resetEvaluation(); 
  });
});

test('logTime calls storage correctly if new stream', function(t) {
  var key = 'foo';
  var time = 1234;
  var scopedKey = 'timing_foo';

  var setSpy = sinon.stub();
  var getSpy = sinon.stub().resolves({});
  proxyquireEvaluation({
    './chrome-apis/storage': {
      set: setSpy,
      get: getSpy
    }
  });

  var expectedSet = {};
  expectedSet[scopedKey] = [ time ];

  evaluation.logTime(key, time)
    .then(() => {
      t.deepEqual(setSpy.args[0], [ expectedSet ]);
      t.end();
      resetEvaluation();
    });
});

test('logTime calls storage correctly if appending to stream', function(t) {
  var key = 'openKhan';
  var time = 123.56;
  var scopedKey = 'timing_openKhan';

  var existingValues = {};
  var existingTimes = [ 3, 5 ];
  existingValues[scopedKey] = existingTimes;

  var setSpy = sinon.stub();
  var getSpy = sinon.stub().resolves(existingValues);
  proxyquireEvaluation({
    './chrome-apis/storage': {
      set: setSpy,
      get: getSpy
    }
  });

  var expectedSet = {};
  var newTimes = existingTimes.slice();
  newTimes.push(time);
  expectedSet[scopedKey] = newTimes;

  evaluation.logTime(key, time)
    .then(() => {
      t.deepEqual(setSpy.args[0], [ expectedSet ]);
      t.end();
      resetEvaluation();
    });
});

test('generateDummyPage incorporates nonce and number', function(t) {
  var index = 123;
  var nonce = 'feefifofum';

  var actual = evaluation.generateDummyPage(index, nonce);

  t.notEqual(actual.captureUrl.indexOf(index), -1);
  t.notEqual(actual.captureUrl.indexOf(nonce), -1);
  t.end();
  resetEvaluation();
});

test('generateDummyPages calls helper and correct size', function(t) {
  var page1 = 'foo';
  var page2 = 'bar';

  var numPages = 2;
  var nonce = 'abcdef';

  var generateDummyPageSpy = sinon.stub();
  generateDummyPageSpy.onCall(0).returns(page1);
  generateDummyPageSpy.onCall(1).returns(page2);
  evaluation.generateDummyPage = generateDummyPageSpy;

  var expected = [page1, page2];
  var actual = evaluation.generateDummyPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPageSpy.args[0], [0, nonce]);
  t.deepEqual(generateDummyPageSpy.args[1], [1, nonce]);
  t.end();
  resetEvaluation();
});

test('getDummyResponseForAllCachedPages calls helpers', function(t) {
  var mdataObj = { md: 'meta' };
  var pages = ['alpha', 'beta'];

  var createMetadatObjSpy = sinon.stub().returns(mdataObj);
  var generateDummyPagesSpy = sinon.stub().returns(pages);

  proxyquireEvaluation({
    './server/server-api': {
      createMetadatObj: createMetadatObjSpy
    }
  });
  evaluation.generateDummyPages = generateDummyPagesSpy;

  var numPages = 5;
  var nonce = 'poobear';

  var expected = {
    metadata: mdataObj,
    cachedPages: pages
  };

  var actual = evaluation.getDummyResponseForAllCachedPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPagesSpy.args[0], [numPages, nonce]);
  t.end();
  resetEvaluation();
});

test('getEvalPagesUrl correct', function(t) {
  var ipAddress = '1.2.3.4';
  var port = 123;
  var numPages = 5;

  var expected = 'http://1.2.3.4:123/eval_list?numPages=5';
  var actual = evaluation.getEvalPagesUrl(ipAddress, port, numPages);

  t.equal(actual, expected);
  t.end();
});

test('runLoadPageTrial correct', function(t) {
  var numIterations = 4;
  var key = 'loadKey';
  var captureUrl = 'original_url.html';
  var captureDate = 'the date it was saved';
  var mhtmlUrl = 'the_url_to_save_the_page.mhtml';
  var metadata = { meta: 'data', fullUrl: 'full url' };

  var loadTimes = [
    1.1,
    2.2,
    3.3,
    4.4
  ];
  var expected = [];

  var runLoadPageIterationSpy = sinon.stub();
  for (var i = 0; i < numIterations; i++) {
    var value = loadTimes[i];
    runLoadPageIterationSpy.onCall(i).resolves(value);
    expected.push({ resolved: value });
  }

  proxyquireEvaluation({
    './util': {
      wait: sinon.stub().resolves()
    }
  });
  
  var logTimeSpy = sinon.stub();
  evaluation.logTime = logTimeSpy;
  evaluation.runLoadPageIteration = runLoadPageIterationSpy;

  evaluation.runLoadPageTrial(
    numIterations,
    key,
    captureUrl,
    captureDate,
    mhtmlUrl,
    metadata
  )
  .then(actual => {
    t.deepEqual(actual, expected);
    t.equal(runLoadPageIterationSpy.callCount, numIterations);

    for (var j = 0; j < expected.length; j++) {
      t.deepEqual(
        logTimeSpy.args[j],
        [
          key,
          {
            timeToOpen: expected[j].resolved,
            captureUrl: captureUrl,
            numIterations: numIterations,
            mhtmlUrl: mhtmlUrl,
            fullUrl: metadata.fullUrl,
            type: 'loadPage',
            iteration: j
          } 
        ]
      );
    }

    t.end();
    resetEvaluation(); 
  });
});

test('runLoadPageTrialForCache correct', function(t) {
  var listPagesUrl = 'host:port/list_pages';
  var numIterations = 3;
  var key = 'cacheKey';

  var page1 = {
    captureUrl: 'url1',
    captureDate: 'date1',
    accessPath: 'path1',
    metadata: { mdata: '1' }
  };

  var page2 = {
    captureUrl: 'url2',
    captureDate: 'date2',
    accessPath: 'path2',
    metadata: { mdata: '2' }
  };

  var caches = {
    cachedPages: [page1, page2]
  };

  var fetchJsonSpy = sinon.stub().withArgs(listPagesUrl).resolves(caches);

  var pageResults = [
    'result for page 1',
    'result for page 2',
  ];

  var expected = [];

  var runLoadPageTrialSpy = sinon.stub();
  for (var i = 0; i < caches.cachedPages.length; i++) {
    var value = pageResults[i];
    runLoadPageTrialSpy.onCall(i).resolves(value);
    expected.push({ resolved: value });
  }

  proxyquireEvaluation({
    './util': {
      fetchJson: fetchJsonSpy,
      wait: sinon.stub().resolves()
    }
  });
  evaluation.runLoadPageTrial = runLoadPageTrialSpy;

  evaluation.runLoadPageTrialForCache(numIterations, key, listPagesUrl)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.equal(runLoadPageTrialSpy.callCount, caches.cachedPages.length);

    t.deepEqual(
      runLoadPageTrialSpy.args[0],
      [
        numIterations,
        key,
        page1.captureUrl,
        page1.captureDate,
        page1.accessPath,
        page1.metadata
      ]
    );

    t.deepEqual(
      runLoadPageTrialSpy.args[1],
      [
        numIterations,
        key,
        page2.captureUrl,
        page2.captureDate,
        page2.accessPath,
        page2.metadata
      ]
    );

    t.end();
    resetEvaluation(); 
  });

});
