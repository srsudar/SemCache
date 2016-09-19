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

test('getParameters returns results', function(t) {
  var expected = {
    key: 'logKey',
    numIterations: 15,
    currentIter: 2,
    urlList: ['url0', 'url1', 'url2'],
    urlListIndex: 1,
    activeUrl: 'url1'
  };

  var expectedGetArg = [
    evaluation.KEY_NUM_ITERATIONS,
    evaluation.KEY_CURRENT_ITERATION,
    evaluation.KEY_LOG_KEY,
    exports.KEY_URL_LIST,
    exports.KEY_URL_LIST_INDEX
  ];

  var getResult = {};
  getResult[evaluation.KEY_NUM_ITERATIONS] = expected.numIterations;
  getResult[evaluation.KEY_CURRENT_ITERATION] = expected.currentIter;
  getResult[evaluation.KEY_LOG_KEY] = expected.key;
  getResult[evaluation.KEY_URL_LIST] = expected.urlList;
  getResult[evaluation.KEY_URL_LIST_INDEX] = expected.urlListIndex;

  var getSpy = sinon.stub().withArgs(expectedGetArg).resolves(getResult);
  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      get: getSpy
    }
  });

  evaluation.getParameters()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetEvaluation();
    });
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
            evaluation.KEY_CURRENT_ITERATION,
            evaluation.KEY_LOG_KEY,
            evaluation.KEY_URL_LIST,
            evaluation.KEY_URL_LIST_INDEX
          ]
        ]
      );
      t.end();
      resetEvaluation();
    });
});

test('runSavePageIteration returns save result', function(t) {
  // var key = 'googleCom';
  // var numIter = 8;
  // var totalIterations = 10;

  var timingInfo = {
    time: 'for tea'
  };
  // var metadata = {
  //   soMeta: '#hashtag'
  // };

  // var expectedLogArg = {
  //   time: timingInfo.time,
  //   metadata: metadata
  // };
  // var expectedSetArg = {};
  // expectedSetArg[evaluation.KEY_CURRENT_ITERATION] = numIter + 1;

  var savePageSpy = sinon.stub().resolves(timingInfo);
  // var createMetadataForLogSpy = sinon.stub().returns(metadata);
  // var logTimeSpy = sinon.stub();
  // var setSpy = sinon.stub().resolves();
  // var reloadSpy = sinon.stub();
  // var getWindowSpy = sinon.stub().returns({
  //   location: {
  //     reload: reloadSpy
  //   }
  // });

  proxyquireEvaluation({
    '../util/util': {
      wait: sinon.stub().resolves()
    },
  });
  evaluation.savePage = savePageSpy;

  evaluation.runSavePageIteration()
  .then(actual => {
    t.equal(actual, timingInfo);
    t.end();
    resetEvaluation();
  });
});

test('onPageLoadComplete deletes values if no more iterations', function(t) {
  var key = 'googleCom';
  // this will be the last iteration
  var numIter = 9;
  var totalIterations = 10;

  var urlList = ['url0', 'url1', 'url2'];
  var urlListIndex = 2; // the last one
  var activeUrl = urlList[urlListIndex];

  var params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  var getParametersSpy = sinon.stub().resolves(params);

  var timingInfo = {
    time: 'for tea'
  };
  var metadata = {
    soMeta: '#hashtag'
  };

  var expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  var createMetadataForLogSpy = sinon.stub().returns(metadata);
  var logTimeSpy = sinon.stub();
  var deleteStorageHelperValuesSpy = sinon.stub().resolves();
  var logResultSpy = sinon.stub();
  var runSavePageIterationSpy = sinon.stub().resolves(timingInfo);

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/evaluation': {
      logTime: logTimeSpy
    }
  });
  evaluation.createMetadataForLog = createMetadataForLogSpy;
  evaluation.deleteStorageHelperValues = deleteStorageHelperValuesSpy;
  evaluation.logResult = logResultSpy;
  evaluation.getParameters = getParametersSpy;
  evaluation.runSavePageIteration = runSavePageIterationSpy;
  evaluation.isPerformingTrial = sinon.stub().resolves(true);
  evaluation.getHref = sinon.stub().returns(activeUrl);

  evaluation.onPageLoadComplete()
  .then(actual => {
    // We expect no resolved value
    t.equal(actual, undefined);
    t.deepEqual(deleteStorageHelperValuesSpy.args[0], []);
    t.true(deleteStorageHelperValuesSpy.calledOnce);
    t.deepEqual(logTimeSpy.args[0], [key, expectedLogArg]);
    t.deepEqual(logResultSpy.args[0], [key]);
    t.end();
    resetEvaluation();
  });
});

test('onPageLoadComplete increments iteration variables', function(t) {
  var key = 'googleCom';
  // this will be the last iteration
  var numIter = 8;
  var totalIterations = 10;

  var urlList = ['url0', 'url1', 'url2'];
  var urlListIndex = 2; // the last one
  var activeUrl = urlList[urlListIndex];

  var params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  var getParametersSpy = sinon.stub().resolves(params);

  var timingInfo = {
    time: 'for tea'
  };
  var metadata = {
    soMeta: '#hashtag'
  };

  var expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  var createMetadataForLogSpy = sinon.stub().returns(metadata);
  var logTimeSpy = sinon.stub();
  var logResultSpy = sinon.stub();
  var runSavePageIterationSpy = sinon.stub().resolves(timingInfo);
  var setSpy = sinon.stub().resolves();
  var deleteStorageHelperValuesSpy = sinon.stub().resolves();

  var reloadSpy = sinon.stub();
  var windowObj = {
    location: {
      reload: reloadSpy
    }
  };
  var getWindowSpy = sinon.stub().returns(windowObj);

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      set: setSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      logTime: logTimeSpy
    },
    '../util/util': {
      getWindow: getWindowSpy
    }
  });
  evaluation.createMetadataForLog = createMetadataForLogSpy;
  evaluation.logResult = logResultSpy;
  evaluation.getParameters = getParametersSpy;
  evaluation.runSavePageIteration = runSavePageIterationSpy;
  evaluation.isPerformingTrial = sinon.stub().resolves(true);
  evaluation.getHref = sinon.stub().returns(activeUrl);
  evaluation.deleteStorageHelperValues = deleteStorageHelperValuesSpy;

  var setArg = {};
  setArg[evaluation.KEY_CURRENT_ITERATION] = numIter + 1;

  evaluation.onPageLoadComplete()
  .then(actual => {
    // We expect no resolved value
    t.equal(actual, undefined);
    t.deepEqual(setSpy.args[0], [setArg]);
    t.deepEqual(logTimeSpy.args[0], [key, expectedLogArg]);
    t.deepEqual(logResultSpy.args[0], [key]);
    t.deepEqual(reloadSpy.args[0], [true]);
    t.equal(deleteStorageHelperValuesSpy.callCount, 0);
    t.end();
    resetEvaluation();
  });
});

test('onPageLoadComplete moves to next url', function(t) {
  var key = 'googleCom';
  // this will be the last iteration
  var numIter = 9;
  var totalIterations = 10;

  var urlList = ['url0', 'url1', 'url2'];
  var urlListIndex = 1;
  var activeUrl = urlList[urlListIndex];

  var params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  var getParametersSpy = sinon.stub().resolves(params);

  var timingInfo = {
    time: 'for tea'
  };
  var metadata = {
    soMeta: '#hashtag'
  };

  var expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  var createMetadataForLogSpy = sinon.stub().returns(metadata);
  var logTimeSpy = sinon.stub();
  var logResultSpy = sinon.stub();
  var runSavePageIterationSpy = sinon.stub().resolves(timingInfo);
  var setSpy = sinon.stub().resolves();
  var deleteStorageHelperValuesSpy = sinon.stub().resolves();

  var windowObj = {
    location: {
      href: null
    }
  };
  var getWindowSpy = sinon.stub().returns(windowObj);

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      set: setSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      logTime: logTimeSpy
    },
    '../util/util': {
      getWindow: getWindowSpy
    }
  });
  evaluation.createMetadataForLog = createMetadataForLogSpy;
  evaluation.logResult = logResultSpy;
  evaluation.getParameters = getParametersSpy;
  evaluation.runSavePageIteration = runSavePageIterationSpy;
  evaluation.isPerformingTrial = sinon.stub().resolves(true);
  evaluation.getHref = sinon.stub().returns(activeUrl);
  evaluation.deleteStorageHelperValues = deleteStorageHelperValuesSpy;

  var setArg = {};
  setArg[evaluation.KEY_CURRENT_ITERATION] = 0;
  setArg[evaluation.KEY_URL_LIST_INDEX] = urlListIndex + 1;

  evaluation.onPageLoadComplete()
  .then(actual => {
    // We expect no resolved value
    t.equal(actual, undefined);
    t.deepEqual(setSpy.args[0], [setArg]);
    t.deepEqual(logTimeSpy.args[0], [key, expectedLogArg]);
    t.deepEqual(logResultSpy.args[0], [key]);
    t.deepEqual(windowObj.location.href, urlList[urlListIndex + 1]);
    t.equal(deleteStorageHelperValuesSpy.callCount, 0);
    t.end();
    resetEvaluation();
  });
});

test('startSavePageTrial sets variables and reloads', function(t) {
  var urls = ['url0', 'url1'];

  var setSpy = sinon.stub().resolves();

  var numIterations = 10;
  var key = 'firstTry';

  var setArg = {};
  setArg[evaluation.KEY_NUM_ITERATIONS] = numIterations;
  setArg[evaluation.KEY_PERFORMING_TRIAL] = true;
  setArg[evaluation.KEY_CURRENT_ITERATION] = 0;
  setArg[evaluation.KEY_LOG_KEY] = key;
  setArg[evaluation.KEY_URL_LIST] = urls;
  setArg[evaluation.KEY_URL_LIST_INDEX] = 0;

  proxyquireEvaluation({
    '../../../../chromeapp/app/scripts/chrome-apis/storage': {
      set: setSpy
    },
    '../util/util': {
      wait: sinon.stub().resolves()
    }
  });

  evaluation.startSavePageTrial(urls, numIterations, key)
    .then(() => {
      t.deepEqual(setSpy.args[0], [setArg]);
      t.end();
      resetEvaluation();
    });
});
