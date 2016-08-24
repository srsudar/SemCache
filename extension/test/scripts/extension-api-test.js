/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var api = require('../../app/scripts/extension-api');

/**
 * Proxyquire the api object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../app/scripts/extension-api',
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
    require.resolve('../../../app/scripts/extension-api')
  ];
  api = require('../../../app/scripts/extension-api');
}

/**
 * @return {object} a valid argument to tab.query
 */
function getQueryArg() {
  return { currentWindow: true, active: true };
}

test('saveCurrentPage resolves if all resolve', function(t) {
  var fullUrl = 'https://www.foo.com#money';
  var blob = 'so blobby';
  var tab = { tabId: 13, url: fullUrl };
  var expectedTabs = [tab];
  var captureArg = { tabId: tab.tabId };

  var querySpy = sinon.stub().withArgs(getQueryArg).resolves(expectedTabs);
  var saveAsMhtmlSpy = sinon.stub().withArgs(captureArg).resolves(blob);
  var savePageSpy = sinon.stub().withArgs(tab, blob).resolves();
  
  proxyquireApi({
    './chrome-apis/tabs': {
      query: querySpy
    },
    './chrome-apis/page-capture': {
      saveAsMHTML: saveAsMhtmlSpy
    },
    './persistence/datastore': {
      savePage: savePageSpy
    }
  });

  api.saveCurrentPage()
    .then(result => {
      // We don't expect a resolve object.
      t.equal(result, undefined);
      t.deepEqual(savePageSpy.args[0], [tab, blob]);
      t.end();
      resetApi();
    });
});

test('saveCurrentPage rejects if savePage rejects', function(t) {
  // We don't currently permit this, but we are going to test for it just in
  // case.
  var fullUrl = 'https://www.foo.com#money';
  var blob = 'so blobby';
  var tab = { tabId: 13, url: fullUrl };
  var expectedTabs = [tab];
  var captureArg = { tabId: tab.tabId };

  var expected = { msg: 'went wrong as expected' };

  var querySpy = sinon.stub().withArgs(getQueryArg).resolves(expectedTabs);
  var saveAsMhtmlSpy = sinon.stub().withArgs(captureArg).resolves(blob);
  var savePageSpy = sinon.stub().withArgs(fullUrl, blob).rejects(expected);
  
  proxyquireApi({
    './chrome-apis/tabs': {
      query: querySpy
    },
    './chrome-apis/page-capture': {
      saveAsMHTML: saveAsMhtmlSpy
    },
    './persistence/datastore': {
      savePage: savePageSpy
    }
  });

  api.saveCurrentPage()
    .catch(actual => {
      // We don't expect a resolve object.
      t.equal(actual, expected);
      t.end();
      resetApi();
    });
});
