/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var api = require('../../../app/scripts/popup/popup-api');

/**
 * Proxyquire the api object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../../app/scripts/popup/popup-api',
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
    require.resolve('../../../app/scripts/popup/popup-api')
  ];
  api = require('../../../app/scripts/popup/popup-api');
}

test('saveTab resolves if all resolve', function(t) {
  var fullUrl = 'https://www.foo.com#money';
  var blob = 'so blobby';
  var tab = { tabId: 13, url: fullUrl };
  var captureArg = { tabId: tab.tabId };

  var saveAsMhtmlSpy = sinon.stub().withArgs(captureArg).resolves(blob);
  var savePageSpy = sinon.stub().withArgs(tab, blob).resolves();
  
  proxyquireApi({
    '../chrome-apis/page-capture': {
      saveAsMHTML: saveAsMhtmlSpy
    },
    '../persistence/datastore': {
      savePage: savePageSpy
    }
  });

  api.saveTab(tab)
    .then(result => {
      // We don't expect a resolve object.
      t.equal(result, undefined);
      t.deepEqual(savePageSpy.args[0], [tab, blob]);
      t.end();
      resetApi();
    });
});

test('saveTab rejects if savePage rejects', function(t) {
  // We don't currently permit this, but we are going to test for it just in
  // case.
  var fullUrl = 'https://www.foo.com#money';
  var blob = 'so blobby';
  var tab = { tabId: 13, url: fullUrl };
  var captureArg = { tabId: tab.tabId };

  var expected = { msg: 'went wrong as expected' };

  var saveAsMhtmlSpy = sinon.stub().withArgs(captureArg).resolves(blob);
  var savePageSpy = sinon.stub().withArgs(fullUrl, blob).rejects(expected);
  
  proxyquireApi({
    '../chrome-apis/page-capture': {
      saveAsMHTML: saveAsMhtmlSpy
    },
    '../persistence/datastore': {
      savePage: savePageSpy
    }
  });

  api.saveTab(tab)
    .catch(actual => {
      t.equal(actual, expected);
      t.end();
      resetApi();
    });
});

test('saveCurrentPage resolves if saveTab resolves', function(t) {
  var tab = { tabId: 13 };

  var getActiveTabSpy = sinon.stub().resolves(tab);
  var saveTabSpy = sinon.stub().withArgs(tab).resolves();

  proxyquireApi({
    '../util/util': {
      getActiveTab: getActiveTabSpy
    },
  });
  api.saveTab = saveTabSpy;

  api.saveCurrentPage()
    .then(result => {
      // We don't expect a resolve object.
      t.equal(result, undefined);
      t.deepEqual(saveTabSpy.args[0], [tab]);
      t.end();
      resetApi();
    });
});

test('saveCurrentPage rejects if saveTab rejects', function(t) {
  var tab = { tabId: 13 };

  var expected = { msg: 'went wrong as expected' };

  var getActiveTabSpy = sinon.stub().resolves(tab);
  var saveTabSpy = sinon.stub().withArgs(tab).rejects(expected);
  
  proxyquireApi({
    '../util/util': {
      getActiveTab: getActiveTabSpy
    }
  });
  api.saveTab = saveTabSpy;

  api.saveCurrentPage()
    .catch(actual => {
      t.equal(actual, expected);
      t.end();
      resetApi();
    });
});

test('waitForCurrentPageToLoad calls sendMessage and resolves', function(t) {
  var activeTab = { id: 156 };
  var getActiveTabSpy = sinon.stub().resolves(activeTab);
  var messageForContentScript = { hello: 'how long did it take you to load?' };
  var expected = { msg: 'I come from the content script' };

  var sendArgs = [];
  var sendMessageSpy = function(tabId, message, callback) {
    sendArgs.push(tabId);
    sendArgs.push(message);
    sendArgs.push(callback);
    callback(expected);
  };

  proxyquireApi({
    '../chrome-apis/tabs': {
      sendMessage: sendMessageSpy
    },
    '../util/util': {
      getActiveTab: getActiveTabSpy
    }
  });
  api.createLoadMessage = sinon.stub().returns(messageForContentScript);


  api.waitForCurrentPageToLoad()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.deepEqual(sendArgs[0], activeTab.id);
      t.deepEqual(sendArgs[1], messageForContentScript);
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});
