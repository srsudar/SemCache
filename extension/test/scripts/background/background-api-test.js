/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var api = require('../../../app/scripts/background/background-api');

/**
 * Proxyquire the api object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../../app/scripts/background/background-api',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetApi() {
  delete require.cache[
    require.resolve('../../../app/scripts/background/background-api')
  ];
  api = require('../../../app/scripts/background/background-api');
}

test('savePageForContentScript resolves if saveTab resolves', function(t) {
  var tab = { tabId: 1234 };

  var start = 100;
  var end = 103;
  var totalTime = end - start;

  var expected = { timeToWrite: totalTime };

  var saveTabSpy = sinon.stub().withArgs(tab).resolves();
  var getNowSpy = sinon.stub();
  getNowSpy.onCall(0).returns(start);
  getNowSpy.onCall(1).returns(end);

  proxyquireApi({
    '../popup/popup-api': {
      saveTab: saveTabSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      getNow: getNowSpy
    }
  });

  api.savePageForContentScript(tab)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});

test('savePageForContentScript rejects if saveTab rejects', function(t) {
  var tab = { tabId: 1234 };

  var expected = { msg: 'done gone wrong' };

  var saveTabSpy = sinon.stub().withArgs(tab).rejects(expected);
  var getNowSpy = sinon.stub();

  proxyquireApi({
    '../popup/popup-api': {
      saveTab: saveTabSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      getNow: getNowSpy
    }
  });

  api.savePageForContentScript(tab)
    .catch(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});
