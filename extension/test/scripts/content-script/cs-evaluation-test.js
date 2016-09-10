/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var evaluation = require('../../../app/scripts/content-script/cs-evaluation');

/**
 * Proxyquire the object with proxies passed as the proxied modules.
 */
function proxyquireEvaluation(proxies) {
  evaluation = proxyquire(
    '../../../app/scripts/content-script/cs-evaluation',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetEvaluation() {
  delete require.cache[
    require.resolve('../../../app/scripts/content-script/cs-evaluation')
  ];
  evaluation = require('../../../app/scripts/content-script/cs-evaluation');
}

function storageGetHelper(key, expected, fnName, t) {
  var getResult = {};
  getResult[key] = expected;
  var getSpy = sinon.stub().resolves(getResult);

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      get: getSpy
    }
  });

  // Unfortunately, b/c we proxyquire in the helper, we pass the method name.
  evaluation[fnName]().then(actual => {
      t.deepEqual(actual, expected);
      t.deepEqual(getSpy.args[0], [key]);
      t.end();
      resetEvaluation();
  })
  .catch(err => {
    console.log(err);
  });
}

test('isPerformingTrial correct if not set', function(t) {
  var getSpy = sinon.stub().resolves({});

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      get: getSpy
    }
  });

  evaluation.isPerformingTrial()
    .then(actual => {
      t.false(actual);
      t.deepEqual(getSpy.args[0], [evaluation.KEY_PERFORMING_TRIAL]);
      t.end();
      resetEvaluation();
    });
});

test('isPerformingTrial returns result if present', function(t) {
  var expected = 'value from set';
  storageGetHelper(
    evaluation.KEY_PERFORMING_TRIAL,
    expected,
    'isPerformingTrial',
    t
  );
});

test('getTotalIterations returns set value', function(t) {
  var expected = 55;
  storageGetHelper(
    evaluation.KEY_NUM_ITERATIONS,
    expected,
    'getTotalIterations',
    t
  );
});

test('getCurrentIteration returns set value', function(t) {
  var expected = 0;
  storageGetHelper(
    evaluation.KEY_CURRENT_ITERATION,
    expected,
    'getCurrentIteration',
    t
  );
});

test('getDomainAndPath returns result if present', function(t) {
  var expected = 'www.google.com/mailstuff';
  storageGetHelper(
    evaluation.KEY_DOMAIN_AND_PATH,
    expected,
    'getDomainAndPath',
    t
  );
});

test('getLogKey returns result if present', function(t) {
  var expected = 'wwwgoogle';
  storageGetHelper(
    evaluation.KEY_LOG_KEY,
    expected,
    'getLogKey',
    t
  );
});

test('requestSavePage sends message and resolves', function(t) {
  var expectedMessage = { type: 'savePageForContentScript' };
  var expected = 'response from sendMessage';

  var sendMessageSpy = function(actualMessage, callback) {
    t.deepEqual(actualMessage, expectedMessage);
    callback(expected);
  };

  proxyquireEvaluation({
    '../chrome-apis/runtime': {
      sendMessage: sendMessageSpy
    }
  });

  evaluation.requestSavePage()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetEvaluation();
    });
});

test('savePage resolves as expected', function(t) {
  var loadTime = 10101.2;
  var savePageResult = { timeToWrite: 1982.2 };

  var getFullLoadTimeSpy = sinon.stub().returns(loadTime);
  var requestSavePageSpy = sinon.stub().resolves(savePageResult);
  var getOnCompletePromiseSpy = sinon.stub().resolves();

  var expected = {
    totalLoadTime: loadTime,
    timeToWrite: savePageResult.timeToWrite
  };

  proxyquireEvaluation({
    './cs-api': {
      getFullLoadTime: getFullLoadTimeSpy
    },
    '../util/util': {
      getOnCompletePromise: getOnCompletePromiseSpy
    }
  });
  evaluation.requestSavePage = requestSavePageSpy;

  evaluation.savePage()
    .then(actual => {
      t.deepEqual(actual, expected);

      t.equal(getOnCompletePromiseSpy.callCount, 1);
      t.end();
      resetEvaluation();
    });
});

test('createMetadataForLog correct', function(t) {
  var dateStr = 'april happy day';
  var href = 'www.fancy.org#ugh';

  var getWindowSpy = sinon.stub().returns({
    location: {
      href: href
    }
  });

  var getTodaySpy = sinon.stub().returns({
    toString: sinon.stub().returns(dateStr)
  });
  
  proxyquireEvaluation({
    '../util/util': {
      getWindow: getWindowSpy,
      getToday: getTodaySpy
    }
  });

  var expected = {
    href: href,
    date: dateStr
  };

  var actual = evaluation.createMetadataForLog();
  t.deepEqual(actual, expected);
  t.end();
  resetEvaluation();
});

test('deleteStorageHelperValues deletes and resolves', function(t) {
  var removeSpy = sinon.stub().resolves();
  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      remove: removeSpy
    }
  });

  evaluation.deleteStorageHelperValues()
    .then(() => {
      t.deepEqual(
        removeSpy.args[0],
        [
          [
            evaluation.KEY_PERFORMING_TRIAL,
            evaluation.KEY_NUM_ITERATIONS,
            evaluation.KEY_CURRENT_ITERATION
          ]
        ]
      );
      t.end();
      resetEvaluation();
    });
});

test('runSavePageIteration reloads if more iterations', function(t) {
  var key = 'googleCom';
  var numIter = 8;
  var totalIterations = 10;

  var timingInfo = {
    time: 'for tea'
  };
  var metadata = {
    soMeta: '#hashtag'
  };

  var expectedLogArg = {
    time: timingInfo.time,
    metadata: metadata
  };
  var expectedSetArg = {};
  expectedSetArg[evaluation.KEY_CURRENT_ITERATION] = numIter + 1;

  var savePageSpy = sinon.stub().resolves(timingInfo);
  var createMetadataForLogSpy = sinon.stub().returns(metadata);
  var logTimeSpy = sinon.stub();
  var setSpy = sinon.stub().resolves();
  var reloadSpy = sinon.stub();
  var getWindowSpy = sinon.stub().returns({
    location: {
      reload: reloadSpy
    }
  });

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      set: setSpy
    },
    '../util/util': {
      getWindow: getWindowSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      logTime: logTimeSpy
    }
  });
  evaluation.createMetadataForLog = createMetadataForLogSpy;
  evaluation.savePage = savePageSpy;

  evaluation.runSavePageIteration(numIter, totalIterations, key)
  .then(actual => {
    // We expect no resolved value
    t.equal(actual, undefined);
    t.deepEqual(logTimeSpy.args[0], [key, expectedLogArg]);
    t.deepEqual(setSpy.args[0], [expectedSetArg]);
    t.deepEqual(reloadSpy.args[0], [true]);
    t.end();
    resetEvaluation();
  });
});

test('runSavePageIteration deletes values if no more iterations', function(t) {
  var key = 'googleCom';
  // this will be the last iteration
  var numIter = 9;
  var totalIterations = 10;

  var timingInfo = {
    time: 'for tea'
  };
  var metadata = {
    soMeta: '#hashtag'
  };

  var expectedLogArg = {
    time: timingInfo.time,
    metadata: metadata
  };
  var expectedSetArg = {};
  expectedSetArg[evaluation.KEY_CURRENT_ITERATION] = numIter + 1;

  var savePageSpy = sinon.stub().resolves(timingInfo);
  var createMetadataForLogSpy = sinon.stub().returns(metadata);
  var logTimeSpy = sinon.stub();
  var deleteStorageHelperValuesSpy = sinon.stub().resolves();
  var logResultSpy = sinon.stub();

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/evaluation': {
      logTime: logTimeSpy
    }
  });
  evaluation.createMetadataForLog = createMetadataForLogSpy;
  evaluation.savePage = savePageSpy;
  evaluation.deleteStorageHelperValues = deleteStorageHelperValuesSpy;
  evaluation.logResult = logResultSpy;

  evaluation.runSavePageIteration(numIter, totalIterations, key)
  .then(actual => {
    // We expect no resolved value
    t.equal(actual, undefined);
    t.deepEqual(deleteStorageHelperValuesSpy.args[0], []);
    t.deepEqual(logTimeSpy.args[0], [key, expectedLogArg]);
    t.deepEqual(logResultSpy.args[0], []);
    t.end();
    resetEvaluation();
  });
});

test('createPageIdentifier correct', function(t) {
  var path = 'foo/bar';
  var host = 'www.google.com';
  var expected = host + '/' + path;

  var windowSpy = {
    location: {
      host: host,
      pathname: path
    }
  };
  var getWindowSpy = sinon.stub().returns(windowSpy);

  proxyquireEvaluation({
    '../util/util': {
      getWindow: getWindowSpy
    },
  });

  var actual = evaluation.createPageIdentifier();
  t.deepEqual(actual, expected);
  t.end();
  resetEvaluation();
});

test('startSavePageTrial sets variables and reloads', function(t) {
  var reloadSpy = sinon.stub();
  var windowStub = {
    location: {
      reload: reloadSpy
    }
  };
  var pageIdentifier = 'google/path';

  var getWindowSpy = sinon.stub().returns(windowStub);
  var createPageIdentifierSpy = sinon.stub().returns(pageIdentifier);
  var setSpy = sinon.stub().resolves();

  var numIterations = 10;
  var key = 'firstTry';

  var setArg = {};
  setArg[evaluation.KEY_NUM_ITERATIONS] = numIterations;
  setArg[evaluation.KEY_PERFORMING_TRIAL] = true;
  setArg[evaluation.KEY_CURRENT_ITERATION] = 0;
  setArg[evaluation.KEY_DOMAIN_AND_PATH] = pageIdentifier;
  setArg[evaluation.KEY_LOG_KEY] = key;

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      set: setSpy
    },
    '../util/util': {
      getWindow: getWindowSpy
    }
  });
  evaluation.createPageIdentifier = createPageIdentifierSpy;

  evaluation.startSavePageTrial(numIterations, key)
    .then(() => {
      t.deepEqual(setSpy.args[0], [setArg]);
      t.deepEqual(reloadSpy.args[0], [true]);
      t.end();
      resetEvaluation();
    });
});
