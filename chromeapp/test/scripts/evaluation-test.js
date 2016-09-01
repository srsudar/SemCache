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

test('runDiscoverPeerPagesTrial calls helper', function(t) {
  var numPeers = 30;
  var numPages = 15;
  var numIterations = 5;

  var expected = [ 0.1, 1.1, 2.1, 3.1, 4.1 ];

  var runDiscoverPeerPagesIterationSpy = sinon.stub();
  runDiscoverPeerPagesIterationSpy.onCall(0).resolves(expected[0]);
  runDiscoverPeerPagesIterationSpy.onCall(1).resolves(expected[1]);
  runDiscoverPeerPagesIterationSpy.onCall(2).resolves(expected[2]);
  runDiscoverPeerPagesIterationSpy.onCall(3).resolves(expected[3]);
  runDiscoverPeerPagesIterationSpy.onCall(4).resolves(expected[4]);

  evaluation.runDiscoverPeerPagesIteration = runDiscoverPeerPagesIterationSpy;

  evaluation.runDiscoverPeerPagesTrial(numPeers, numPages, numIterations)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.equal(runDiscoverPeerPagesIterationSpy.callCount, numIterations);
    t.deepEqual(
      runDiscoverPeerPagesIterationSpy.args[0],
      [numPeers, numPages]
    );
    t.end();
    resetEvaluation(); 
  });
});

test('runDiscoverPeerPagesTrial handles rejects', function(t) {
  t.true(t);
  console.log('unimplemented');
  t.end();
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
