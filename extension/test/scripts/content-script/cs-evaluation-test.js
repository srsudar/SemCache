/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

let evaluation = require('../../../app/scripts/content-script/cs-evaluation');


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
  let getResult = {};
  getResult[key] = expected;
  let getSpy = sinon.stub().resolves(getResult);

  proxyquireEvaluation({
    '../chrome-apis/storage': {
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
  let getSpy = sinon.stub().resolves({});

  proxyquireEvaluation({
    '../chrome-apis/storage': {
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
  let expected = 'value from set';
  storageGetHelper(
    evaluation.KEY_PERFORMING_TRIAL,
    expected,
    'isPerformingTrial',
    t
  );
});

test('getParameters returns results', function(t) {
  let expected = {
    key: 'logKey',
    numIterations: 15,
    currentIter: 2,
    urlList: ['url0', 'url1', 'url2'],
    urlListIndex: 1,
    activeUrl: 'url1'
  };

  let expectedGetArg = [
    evaluation.KEY_NUM_ITERATIONS,
    evaluation.KEY_CURRENT_ITERATION,
    evaluation.KEY_LOG_KEY,
    exports.KEY_URL_LIST,
    exports.KEY_URL_LIST_INDEX
  ];

  let getResult = {};
  getResult[evaluation.KEY_NUM_ITERATIONS] = expected.numIterations;
  getResult[evaluation.KEY_CURRENT_ITERATION] = expected.currentIter;
  getResult[evaluation.KEY_LOG_KEY] = expected.key;
  getResult[evaluation.KEY_URL_LIST] = expected.urlList;
  getResult[evaluation.KEY_URL_LIST_INDEX] = expected.urlListIndex;

  let getSpy = sinon.stub().withArgs(expectedGetArg).resolves(getResult);
  proxyquireEvaluation({
    '../chrome-apis/storage': {
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
  let expectedMessage = { type: 'savePageForContentScript' };
  let expected = 'response from sendMessage';

  let sendMessageSpy = function(actualMessage, callback) {
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
  let loadTime = 10101.2;
  let savePageResult = { timeToWrite: 1982.2 };
  let totalTime = loadTime + savePageResult.timeToWrite;

  let getFullLoadTimeSpy = sinon.stub().returns(loadTime);
  let requestSavePageSpy = sinon.stub().resolves(savePageResult);
  let getOnCompletePromiseSpy = sinon.stub().resolves();

  let expected = {
    domCompleteTime: loadTime,
    timeToWrite: savePageResult.timeToWrite,
    totalTime: totalTime
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
  let dateStr = 'april happy day';
  let href = 'www.fancy.org#ugh';

  let getWindowSpy = sinon.stub().returns({
    location: {
      href: href
    }
  });

  let getTodaySpy = sinon.stub().returns({
    toString: sinon.stub().returns(dateStr)
  });
  
  proxyquireEvaluation({
    '../util/util': {
      getWindow: getWindowSpy,
      getToday: getTodaySpy
    }
  });

  let expected = {
    href: href,
    date: dateStr
  };

  let actual = evaluation.createMetadataForLog();
  t.deepEqual(actual, expected);
  t.end();
  resetEvaluation();
});

test('deleteStorageHelperValues deletes and resolves', function(t) {
  let removeSpy = sinon.stub().resolves();
  proxyquireEvaluation({
    '../chrome-apis/storage': {
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
  // let key = 'googleCom';
  // let numIter = 8;
  // let totalIterations = 10;

  let timingInfo = {
    time: 'for tea'
  };
  // let metadata = {
  //   soMeta: '#hashtag'
  // };

  // let expectedLogArg = {
  //   time: timingInfo.time,
  //   metadata: metadata
  // };
  // let expectedSetArg = {};
  // expectedSetArg[evaluation.KEY_CURRENT_ITERATION] = numIter + 1;

  let savePageSpy = sinon.stub().resolves(timingInfo);
  // let createMetadataForLogSpy = sinon.stub().returns(metadata);
  // let logTimeSpy = sinon.stub();
  // let setSpy = sinon.stub().resolves();
  // let reloadSpy = sinon.stub();
  // let getWindowSpy = sinon.stub().returns({
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
  let key = 'googleCom';
  // this will be the last iteration
  let numIter = 9;
  let totalIterations = 10;

  let urlList = ['url0', 'url1', 'url2'];
  let urlListIndex = 2; // the last one
  let activeUrl = urlList[urlListIndex];

  let params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  let getParametersSpy = sinon.stub().resolves(params);

  let timingInfo = {
    time: 'for tea'
  };
  let metadata = {
    soMeta: '#hashtag'
  };

  let expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  let createMetadataForLogSpy = sinon.stub().returns(metadata);
  let logTimeSpy = sinon.stub();
  let deleteStorageHelperValuesSpy = sinon.stub().resolves();
  let logResultSpy = sinon.stub();
  let runSavePageIterationSpy = sinon.stub().resolves(timingInfo);

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
  let key = 'googleCom';
  // this will be the last iteration
  let numIter = 8;
  let totalIterations = 10;

  let urlList = ['url0', 'url1', 'url2'];
  let urlListIndex = 2; // the last one
  let activeUrl = urlList[urlListIndex];

  let params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  let getParametersSpy = sinon.stub().resolves(params);

  let timingInfo = {
    time: 'for tea'
  };
  let metadata = {
    soMeta: '#hashtag'
  };

  let expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  let createMetadataForLogSpy = sinon.stub().returns(metadata);
  let logTimeSpy = sinon.stub();
  let logResultSpy = sinon.stub();
  let runSavePageIterationSpy = sinon.stub().resolves(timingInfo);
  let setSpy = sinon.stub().resolves();
  let deleteStorageHelperValuesSpy = sinon.stub().resolves();

  let reloadSpy = sinon.stub();
  let windowObj = {
    location: {
      reload: reloadSpy
    }
  };
  let getWindowSpy = sinon.stub().returns(windowObj);

  proxyquireEvaluation({
    '../chrome-apis/storage': {
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

  let setArg = {};
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
  let key = 'googleCom';
  // this will be the last iteration
  let numIter = 9;
  let totalIterations = 10;

  let urlList = ['url0', 'url1', 'url2'];
  let urlListIndex = 1;
  let activeUrl = urlList[urlListIndex];

  let params = {
    key: key,
    numIterations: totalIterations,
    currentIter: numIter,
    urlList: urlList,
    urlListIndex: urlListIndex,
    activeUrl: activeUrl
  };
  let getParametersSpy = sinon.stub().resolves(params);

  let timingInfo = {
    time: 'for tea'
  };
  let metadata = {
    soMeta: '#hashtag'
  };

  let expectedLogArg = {
    timing: timingInfo,
    metadata: metadata,
    iteration: params.currentIter,
    numIterations: params.numIterations,
    url: params.activeUrl,
    urlListIndex: params.urlListIndex
  };

  let createMetadataForLogSpy = sinon.stub().returns(metadata);
  let logTimeSpy = sinon.stub();
  let logResultSpy = sinon.stub();
  let runSavePageIterationSpy = sinon.stub().resolves(timingInfo);
  let setSpy = sinon.stub().resolves();
  let deleteStorageHelperValuesSpy = sinon.stub().resolves();

  let windowObj = {
    location: {
      href: null
    }
  };
  let getWindowSpy = sinon.stub().returns(windowObj);

  proxyquireEvaluation({
    '../chrome-apis/storage': {
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

  let setArg = {};
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
  let urls = ['url0', 'url1'];

  let setSpy = sinon.stub().resolves();

  let numIterations = 10;
  let key = 'firstTry';

  let setArg = {};
  setArg[evaluation.KEY_NUM_ITERATIONS] = numIterations;
  setArg[evaluation.KEY_PERFORMING_TRIAL] = true;
  setArg[evaluation.KEY_CURRENT_ITERATION] = 0;
  setArg[evaluation.KEY_LOG_KEY] = key;
  setArg[evaluation.KEY_URL_LIST] = urls;
  setArg[evaluation.KEY_URL_LIST_INDEX] = 0;

  proxyquireEvaluation({
    '../chrome-apis/storage': {
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
