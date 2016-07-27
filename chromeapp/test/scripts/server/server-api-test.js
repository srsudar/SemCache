'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var api = require('../../../app/scripts/server/server-api');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetApi() {
  delete require.cache[
    require.resolve('../../../app/scripts/server/server-api')
  ];
}

test('getAccessUrlForCachedPage outputs correct url', function(t) {
  var fullPath = 'www.example.com_somedate';

  // TODO: For now we are hard-coding in the host and port, which we'll later
  // have to inject in
  var expected = 'http://127.0.0.1:8081/pages/' + fullPath;
  var actual = api.getAccessUrlForCachedPage(fullPath);

  t.equal(expected, actual);
  t.end();
});

test('getResponseForAllCachedPages rejects if read fails', function(t) {
  var errObj = {msg: 'could not read pages'};
  var getAllCachedPagesSpy = sinon.stub().rejects(errObj);

  var mockedApi = proxyquire(
    '../../../app/scripts/server/server-api',
    {
      '../persistence/datastore': {
        getAllCachedPages: getAllCachedPagesSpy
      }
    }
  );

  mockedApi.getResponseForAllCachedPages()
    .catch(actualErr => {
      t.deepEqual(actualErr, errObj);
      t.end();
      resetApi();
    });

});

test('getResponseForAllCachedPages resolves with pages', function(t) {
  var pages = ['alpha', 2, 'gamma'];
  var metadataObj = {foo: 'bar'};
  var getAllCachedPagesSpy = sinon.stub().resolves(pages);

  var mockedApi = proxyquire(
    '../../../app/scripts/server/server-api',
    {
      '../persistence/datastore': {
        getAllCachedPages: getAllCachedPagesSpy
      }
    }
  );
  mockedApi.createMetadatObj = sinon.stub().returns(metadataObj);

  var expected = {
    metadata: metadataObj,
    cachedPages: pages
  };

  mockedApi.getResponseForAllCachedPages()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });

});

test('getCachedFileNameFromPath parses path correct', function(t) {
  var expected = 'www.npm.js_somedate.mhtml';
  var path = '/pages/' + expected;

  var api = require('../../../app/scripts/server/server-api');

  var actual = api.getCachedFileNameFromPath(path);
  t.equal(actual, expected);
  t.end();
});
