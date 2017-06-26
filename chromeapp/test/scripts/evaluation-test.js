/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const testUtil = require('./test-util');

let evaluation = require('../../app/scripts/evaluation');


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

function end(t) {
  if (!t) { throw new Error('you forgot to pass t'); }
  t.end();
  resetEvaluation();
}

/**
 * Proxyquire the evaluation object with proxies passed as the proxied modules.
 */
function proxyquireEvaluation(proxies, localStorageProxies) {
  proxies['./chrome-apis/chromep'] = {
    getStorageLocal: sinon.stub().returns(localStorageProxies),
  };
  evaluation = proxyquire(
    '../../app/scripts/evaluation',
    proxies
  );
}

function discoverPeerPagesHelper(doLazy, t) {
  let numPeers = 30;
  let numPages = 15;
  let numIterations = 4;
  let key = 'testKey';

  let expected = [
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
  
  let logTimeSpy = sinon.stub();
  let runIterationSpy = sinon.stub();
  for (let i = 0; i < expected.length; i++) {
    logTimeSpy.onCall(i).resolves();
    runIterationSpy.onCall(i).resolves(expected[i].resolved);
  }
  evaluation.logTime = logTimeSpy;

  if (doLazy) {
    evaluation.runDiscoverPeerPagesIterationLazy = runIterationSpy;
  } else {
    evaluation.runDiscoverPeerPagesIteration = runIterationSpy;
  }

  let resolveDelay = 4444;
  evaluation.runDiscoverPeerPagesTrial(
    numPeers, numPages, numIterations, key, doLazy, resolveDelay
  )
  .then(actual => {
    t.deepEqual(actual, expected);

    for (let j = 0; j < expected.length; j++) {
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
}

/**
 * Mock the getNow function on the evaluation module.
 *
 * @param {Array.<integer>} times values to return. The ith index will be
 * returned at the ith call to getNow()
 */
function mockGetNow(times) {
  let getNowSpy = sinon.stub();

  times.forEach((val, i) => {
    getNowSpy.onCall(i).returns(times[i]);
  });

  evaluation.getNow = getNowSpy;
}

test('getTimeValues returns result of get', function(t) {
  let key = 'timeMePlz';
  let scopedKey = 'timing_timeMePlz';
  let expected = [1, 2, 3];

  let getResult = {};
  getResult[scopedKey] = expected;
  let getSpy = sinon.stub().resolves(getResult);

  proxyquireEvaluation({}, { get: getSpy });

  evaluation.getTimeValues(key)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(getSpy.args[0], [scopedKey]);
    t.end();
    resetEvaluation();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('getTimeValues returns null if not present', function(t) {
  let key = 'timeMePlz';
  let scopedKey = 'timing_timeMePlz';
  let expected = null;

  let getSpy = sinon.stub().resolves({});

  proxyquireEvaluation({}, { get: getSpy });

  evaluation.getTimeValues(key)
  .then(actual => {
    t.equal(actual, expected);
    t.deepEqual(getSpy.args[0], [scopedKey]);
    t.end();
    resetEvaluation();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('getTimeValues rejects if error', function(t) {
  let expected = { error: 'sigh' };
  proxyquireEvaluation({}, { get: sinon.stub().rejects(expected)});
  evaluation.getTimeValues()
  .then(res => {
    t.fail(res);
    t.end();
    resetEvaluation();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetEvaluation();
  }); 
});

test('fulfillPromises all resolve', function(t) {
  let expected = [ 
    { resolved: 0.1 },
    { resolved: 1.1 },
    { resolved: 2.1 },
    { resolved: 3.1 },
    { resolved: 4.1 }
  ];

  let promises = [];
  promises[0] = () => Promise.resolve(expected[0].resolved);

  // This value will have the option to not resolve immediately, to ensure that
  // we are waiting between executing in order to do so synchronously.
  let delayedResolve = function() {
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('fulfillPromises all reject', function(t) {
  let expected = [ 
    { caught: 0.1 },
    { caught: 1.1 },
    { caught: 2.1 },
    { caught: 3.1 },
    { caught: 4.1 }
  ];

  let promises = [];
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('runDiscoverPeerPagesIteration resolves if all is well', function(t) {
  let numPeers = 2;
  let numPages = 5;

  let peer1 = {
    serviceName: 'Tyrion Cache',
    type: '_semcache._tcp',
    domain: 'tyrion.local',
    port: 8877,
    ipAddress: '1.2.3.4'
  };

  let peer2 = {
    serviceName: 'Cersei Cache',
    type: '_semcache._tcp',
    domain: 'cersei.local',
    port: 8888,
    ipAddress: '172.198.14.23'
  };

  // We will return < the number we expect.
  let resolvedInstances = [ peer1, peer2 ];

  let peer1Response = {
    metadata: { version: 0 },
    cachedPages: [ 'one', 'two', 'three', 'four', 'five' ]
  };

  let peer2Response = {
    metadata: { version: 0 },
    cachedPages: [ 'a', 'b', 'c', 'd', 'e' ]
  };

  let evalUrl1 = 'tyrion/eval.json';
  let evalUrl2 = 'cersei/eval.json';
  let getEvalPagesUrlSpy = sinon.stub();
  getEvalPagesUrlSpy.onCall(0).returns(evalUrl1);
  getEvalPagesUrlSpy.onCall(1).returns(evalUrl2);

  let fetchJsonSpy = sinon.stub();
  fetchJsonSpy.withArgs(evalUrl1).resolves(peer1Response);
  fetchJsonSpy.withArgs(evalUrl2).resolves(peer2Response);

  let startTime = 5413;
  let browsePeerEnd = 8171;
  let browsePageEnd = 1200;
  let totalTime = browsePageEnd - startTime;
  let browsePeerTime = browsePeerEnd - startTime;
  let browsePageTime = browsePageEnd - browsePeerEnd;

  let getNowSpy = sinon.stub();
  getNowSpy.onCall(0).returns(startTime);
  getNowSpy.onCall(1).returns(browsePeerEnd);
  getNowSpy.onCall(2).returns(browsePageEnd);
  
  let expected = {
    timeBrowsePeers: browsePeerTime,
    timeBrowsePages: browsePageTime,
    totalTime: totalTime
  };

  let getBrowseableCachesSpy = sinon.stub().resolves(resolvedInstances);
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('runDiscoverPeerPagesIteration rejects if not enough pages', function(t) {
  let numPeers = 2;
  let numPages = 5;

  let peer1 = {
    serviceName: 'Tyrion Cache',
    type: '_semcache._tcp',
    domain: 'tyrion.local',
    port: 8877,
    ipAddress: '1.2.3.4'
  };

  let peer2 = {
    serviceName: 'Cersei Cache',
    type: '_semcache._tcp',
    domain: 'cersei.local',
    port: 8888,
    ipAddress: '172.2.9.45'
  };

  let resolvedInstances = [ peer1, peer2 ];

  let evalUrl1 = 'tyrionlist.json';
  let evalUrl2 = 'cersei/list.json';
  let getEvalPagesUrlSpy = sinon.stub();
  getEvalPagesUrlSpy.withArgs(peer1.ipAddress).returns(evalUrl1);
  getEvalPagesUrlSpy.withArgs(peer2.ipAddress).returns(evalUrl2);

  let peer1Response = {
    metadata: { version: 0 },
    cachedPages: [ 'one', 'two', 'three' ]
  };
  let fetchJsonSpy = sinon.stub();
  fetchJsonSpy.withArgs(evalUrl1).resolves(peer1Response);
  
  let expected = { err: 'missing pages: found 3, expected 5' };

  let getBrowseableCachesSpy = sinon.stub().resolves(resolvedInstances);
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
  .then(res => {
    t.fail(res);
    t.end();
    resetEvaluation();
  })
  .catch(actual => { 
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation();
  });
});

test('runDiscoverPeerPagesIteration rejects if missing peers', function(t) {
  let numPeers = 5;
  let numPages = 10;

  // We will return < the number we expect.
  let resolvedCaches = [ 'one', 'two', 'three', 'four' ];
  
  let expected = { err: 'missing peer: found 4, expected 5' };

  let getBrowseableCachesSpy = sinon.stub().resolves(resolvedCaches);
  proxyquireEvaluation({
    './app-controller': {
      getBrowseableCaches: getBrowseableCachesSpy
    }
  });
  evaluation.getNow = sinon.stub();
  
  evaluation.runDiscoverPeerPagesIteration(numPeers, numPages)
  .then(res => {
    t.fail(res);
    t.end();
    resetEvaluation(); 
  })
  .catch(actual => { 
    t.deepEqual(actual, expected);
    t.end();
    resetEvaluation();
  });
});

test('runDiscoverPeerPagesTrial calls helper', function(t) {
  discoverPeerPagesHelper(false, t);
});

test('runDiscoverPeerPagesTrialLazy calls helper', function(t) {
  discoverPeerPagesHelper(true, t);
});

test('logTime calls storage correctly if new stream', function(t) {
  let key = 'foo';
  let time = 1234;
  let scopedKey = 'timing_foo';
  let markKeys = { foo: 'from marks' };

  let setSpy = sinon.stub();
  let getSpy = sinon.stub().resolves({});
  let getKeysFromMarksStub = sinon.stub().returns(markKeys);
  let clearMarksStub = sinon.stub();
  let getPerfStub = {
    clearMarks: clearMarksStub
  };
  proxyquireEvaluation(
    {
      './util': {
        getPerf: () => getPerfStub
      }
    },
    {
      set: setSpy,
      get: getSpy
    }
  );
  evaluation.getKeysFromMarks = getKeysFromMarksStub;

  let expectedSet = {};
  expectedSet[scopedKey] = [{
      time: time,
      keysFromMarks: markKeys
  }];

  evaluation.logTime(key, time)
  .then(() => {
    t.deepEqual(setSpy.args[0], [ expectedSet ]);
    t.true(clearMarksStub.calledOnce);
    t.end();
    resetEvaluation();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('logTime calls storage correctly if appending to stream', function(t) {
  let key = 'openKhan';
  let time = 123.56;
  let scopedKey = 'timing_openKhan';

  let existingValues = {};
  let existingTimes = [ 3, 5 ];
  existingValues[scopedKey] = existingTimes;

  let setSpy = sinon.stub();
  let getSpy = sinon.stub().resolves(existingValues);
  let clearMarksStub = sinon.stub();
  let getPerfStub = {
    clearMarks: clearMarksStub
  };
  proxyquireEvaluation(
    {
      './util': {
        getPerf: () => getPerfStub
      }
    },
    {
      set: setSpy,
      get: getSpy
    }
  );
  evaluation.getKeysFromMarks = sinon.stub().returns({});

  let expectedSet = {};
  let newTimes = existingTimes.slice();
  newTimes.push({
    time: time,
    keysFromMarks: {}
  });
  expectedSet[scopedKey] = newTimes;

  evaluation.logTime(key, time)
  .then(() => {
    t.deepEqual(setSpy.args[0], [ expectedSet ]);
    t.true(clearMarksStub.calledOnce);
    t.end();
    resetEvaluation();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('logTime rejects with error', function(t) {
  let expected = { error: 'nope' };
  evaluation.getTimeValues = sinon.stub().rejects(expected);
  evaluation.logTime()
  .then(res => {
    t.fail(res);
    t.end();
    resetEvaluation();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetEvaluation();
  });
});

test('generateDummyPage incorporates nonce and number', function(t) {
  let index = 123;
  let nonce = 'feefifofum';

  let actual = evaluation.generateDummyPage(index, nonce);

  t.notEqual(actual.captureHref.indexOf(index), -1);
  t.notEqual(actual.captureHref.indexOf(nonce), -1);
  t.end();
  resetEvaluation();
});

test('generateDummyPages calls helper and correct size', function(t) {
  let page1 = 'foo';
  let page2 = 'bar';

  let numPages = 2;
  let nonce = 'abcdef';

  let generateDummyPageSpy = sinon.stub();
  generateDummyPageSpy.onCall(0).returns(page1);
  generateDummyPageSpy.onCall(1).returns(page2);
  evaluation.generateDummyPage = generateDummyPageSpy;

  let expected = [page1, page2];
  let actual = evaluation.generateDummyPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPageSpy.args[0], [0, nonce]);
  t.deepEqual(generateDummyPageSpy.args[1], [1, nonce]);
  t.end();
  resetEvaluation();
});

test('getDummyResponseForAllCachedPages calls helpers', function(t) {
  let mdataObj = { md: 'meta' };
  let pages = ['alpha', 'beta'];

  let createMetadatObjSpy = sinon.stub().returns(mdataObj);
  let generateDummyPagesSpy = sinon.stub().returns(pages);

  proxyquireEvaluation({
    './server/server-api': {
      createMetadatObj: createMetadatObjSpy
    }
  });
  evaluation.generateDummyPages = generateDummyPagesSpy;

  let numPages = 5;
  let nonce = 'poobear';

  let expected = {
    metadata: mdataObj,
    cachedPages: pages
  };

  let actual = evaluation.getDummyResponseForAllCachedPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPagesSpy.args[0], [numPages, nonce]);
  t.end();
  resetEvaluation();
});

test('getEvalPagesUrl correct', function(t) {
  let ipAddress = '1.2.3.4';
  let port = 123;
  let numPages = 5;

  let expected = 'http://1.2.3.4:123/eval_list?numPages=5';
  let actual = evaluation.getEvalPagesUrl(ipAddress, port, numPages);

  t.equal(actual, expected);
  t.end();
});

test('runLoadPageTrial correct', function(t) {
  let numIterations = 4;
  let key = 'loadKey';
  let captureUrl = 'original_url.html';
  let captureDate = 'the date it was saved';
  let mhtmlUrl = 'the_url_to_save_the_page.mhtml';
  let metadata = { meta: 'data', fullUrl: 'full url' };

  let loadTimes = [
    1.1,
    2.2,
    3.3,
    4.4
  ];
  let expected = [];

  let runLoadPageIterationSpy = sinon.stub();
  for (let i = 0; i < numIterations; i++) {
    let value = loadTimes[i];
    runLoadPageIterationSpy.onCall(i).resolves(value);
    expected.push({ resolved: value });
  }

  proxyquireEvaluation({
    './util': {
      wait: sinon.stub().resolves()
    }
  });
  
  let logTimeSpy = sinon.stub();
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

    for (let j = 0; j < expected.length; j++) {
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('runLoadPageTrialForCache correct', function(t) {
  let listPagesUrl = 'host:port/list_pages';
  let numIterations = 3;
  let key = 'cacheKey';

  let page1 = {
    captureUrl: 'url1',
    captureDate: 'date1',
    accessPath: 'path1',
    metadata: { mdata: '1' }
  };

  let page2 = {
    captureUrl: 'url2',
    captureDate: 'date2',
    accessPath: 'path2',
    metadata: { mdata: '2' }
  };

  let caches = {
    cachedPages: [page1, page2]
  };

  let fetchJsonSpy = sinon.stub();
  fetchJsonSpy.withArgs(listPagesUrl).resolves(caches);

  let pageResults = [
    'result for page 1',
    'result for page 2',
  ];

  let expected = [];

  let runLoadPageTrialSpy = sinon.stub();
  for (let i = 0; i < caches.cachedPages.length; i++) {
    let value = pageResults[i];
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });

});

test('resolvePeers correct', function(t) {
  let cacheNames = testUtil.createCacheNames('_semcache._tcp', 3);
  let caches = testUtil.createCacheObjsFromNames(cacheNames);
  let toLog = {};

  let expectedErr = { msg: 'something went wrong' };

  let resolveCacheSpy = sinon.stub();
  resolveCacheSpy.withArgs(cacheNames[0].serviceName).resolves(caches[0]);
  resolveCacheSpy.withArgs(cacheNames[1].serviceName).resolves(caches[1]);
  resolveCacheSpy.withArgs(cacheNames[2].serviceName).rejects(expectedErr);

  let resolveDelay = 12345;

  let getNowSpy = sinon.stub();
  getNowSpy.onCall(0).returns(10);
  getNowSpy.onCall(1).returns(15);
  getNowSpy.onCall(2).returns(10);
  getNowSpy.onCall(3).returns(20);

  let expectedResolves = [ 5, 10 ];  // 15 - 10, 20 - 10
  let expectedServiceNames = [
    cacheNames[0].serviceName, 
    cacheNames[1].serviceName
  ];

  let waitSpy = sinon.stub();
  waitSpy.withArgs(resolveDelay).resolves();

  let expected = [
    { resolved: caches[0] },
    { resolved: caches[1] },
    { caught: expectedErr }
  ];

  proxyquireEvaluation({
    './util': {
      wait: waitSpy
    },
    './app-controller': {
      resolveCache: resolveCacheSpy
    }
  });
  evaluation.getNow = getNowSpy;

  evaluation.resolvePeers(cacheNames, resolveDelay, toLog)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(toLog.serviceNames, expectedServiceNames);
    t.deepEqual(toLog.resolves, expectedResolves);
    t.equal(waitSpy.callCount, caches.length);

    t.end();
    resetEvaluation();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetEvaluation(); 
  });
});

test('runFetchFileIteration correct on success', function(t) {
  let times = [10, 50];
  let totalTime = times[1] - times[0];
  let blob = { size: 7777 };

  let expected = {
    timeToFetch: totalTime,
    fileSize: blob.size
  };

  let ipAddr = '1.2.3.4';
  let port = 8876;
  let mhtmlUrl = 'whyme.mhtml';

  let params = { iam: 'aparam' };
  let createFileParamsSpy = sinon.stub();
  createFileParamsSpy.withArgs(ipAddr, port, mhtmlUrl).returns(params);

  let getFileBlobStub = sinon.stub();
  getFileBlobStub.withArgs(params).resolves(blob);
  let peerAccessor = {
    getFileBlob: getFileBlobStub
  };
  let getPeerAccessorSpy = sinon.stub().returns(peerAccessor);

  proxyquireEvaluation({
    './peer-interface/common': {
      createFileParams: createFileParamsSpy
    },
    './peer-interface/manager': {
      getPeerAccessor: getPeerAccessorSpy
    }
  });
  mockGetNow(times);

  evaluation.runFetchFileIteration(mhtmlUrl, ipAddr, port)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('runFetchFileTrial correct on success', function(t) {
  let numIterations = 4;
  let key = 'testKey';
  let mhtmlUrl = 'sigh.com';
  let ipAddr = '8.7.6.0';
  let port = 12345;
  let waitMillis = 4433;

  let iterationResults = [
    { timeToFetch: 1111, fileSize: 100 },
    { timeToFetch: 2222, fileSize: 100 },
    { timeToFetch: 3333, fileSize: 100 },
    { timeToFetch: 4444, fileSize: 100 }
  ];

  let expected = [
    { resolved: iterationResults[0] },
    { resolved: iterationResults[1] },
    { resolved: iterationResults[2] },
    { resolved: iterationResults[3] }
  ];

  proxyquireEvaluation({
    './util': {
      wait: sinon.stub().resolves()
    }
  });
  
  let logTimeSpy = sinon.stub();
  let runIterationSpy = sinon.stub();
  for (let i = 0; i < expected.length; i++) {
    logTimeSpy.onCall(i).resolves();
    runIterationSpy.onCall(i).resolves(expected[i].resolved);
  }
  evaluation.logTime = logTimeSpy;

  evaluation.runFetchFileIteration = runIterationSpy;

  evaluation.runFetchFileTrial(
    numIterations, key, mhtmlUrl, ipAddr, port, waitMillis
  )
  .then(actual => {
    t.deepEqual(actual, expected);

    for (let j = 0; j < expected.length; j++) {
      t.deepEqual(
        logTimeSpy.args[j],
        [
          key,
          {
            timeToFetch: iterationResults[j].timeToFetch,
            fileSize: iterationResults[j].fileSize,
            type: 'fetchFile',
            key: key,
            iteration: j,
            mhtmlUrl: mhtmlUrl,
            numIterations: numIterations,
            waitMillis: waitMillis
          }
        ]
      );
    }
    
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('generateDummyPageInfos broadly correct', function(t) {
  // Going to only kind of test this...there's a lot to change.
  let numPages = 12;
  let peerNumber = 2;

  let actual = evaluation.generateDummyPageInfos(numPages, peerNumber);

  t.equal(actual.length, numPages);
  actual.forEach(pageInfo => {
    t.true(pageInfo.hasOwnProperty('fullUrl'));
    t.true(pageInfo.hasOwnProperty('captureDate'));
  });
  end(t);
});

test('generateDummyDigests broadly correct', function(t) {
  let numDigests = 10;
  let numPages = 450;

  let actual = evaluation.generateDummyDigests(numDigests, numPages);

  t.equal(actual.length, numDigests);
  actual.forEach(digest => {
    // I don't trust instanceof after some weirdness a few days ago, so just
    // use this as a kind of hack.
    digest.hasOwnProperty('peerInfo');
  });
  end(t);
});

test('getKeysFromMarks correct' , function(t) {
  let marks = [
    {
      name: 'alpha',
      startTime: 100.0
    },
    {
      name: 'beta',
      startTime: 150.0
    }
  ];

  let expected = {
    MARK_alpha: 100.0,
    MARK_beta: 150.0,
    MARK_alpha_TO_MARK_beta: 50.0
  };

  let getEntriesStub = sinon.stub().withArgs('mark').returns(marks);
  evaluation.getPerf = sinon.stub().returns({
    getEntriesByType: getEntriesStub
  });

  let actual = evaluation.getKeysFromMarks();
  t.deepEqual(actual, expected);
  end(t);
});
