'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var datastore = require('../../../app/scripts/persistence/datastore');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDatastore() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/datastore')
  ];
  datastore = require('../../../app/scripts/persistence/datastore');
}

test('CachedPage constructs', function(t) {
  var url = 'http://www.example.com';
  var path = 'pages/www.example.com';
  var captureDate = 'date';

  var actual = new datastore.CachedPage(url, captureDate, path);

  t.equal(actual.captureUrl, url);
  t.equal(actual.captureDate, captureDate);
  t.equal(actual.accessPath, path);

  t.end();
});

test('createFileNameForPage returns correct string', function(t) {
  var url = 'http://whatever-you-say.url.org.co.lt';
  var captureDate = '2016-07-22T08:49:19.182Z';

  var actual = datastore.createFileNameForPage(url, captureDate);
  var expected = url + '_' + captureDate;

  t.equal(expected, actual);
  t.end();
});

test('getCaptureUrlFromName returns name', function(t) {
  var expected = 'www.example.com/hello_world.html';
  var name = expected + '_2016-07-22T08:49:19.182Z';
  var actual = datastore.getCaptureUrlFromName(name);

  t.equal(actual, expected);
  t.end();
});

test('getCaptureDateFromName returns date string', function(t) {
  var expected = '2016-07-22T08:49:19.182Z';
  var name = 'www.example.com/hello_world.html_' + expected;
  var actual = datastore.getCaptureDateFromName(name);

  t.equal(actual, expected);
  t.end();
});

test('getAllCachedPages resolves all pages', function(t) {
  var entries = ['a', 'b', 3, {}];
  var getAllFileEntriesSpy = sinon.stub().resolves(entries);

  var getMockCachedPage = function(param) {
    return {cachedPage: param};
  };
  var expectedCachedPages = [];
  entries.forEach(entry => {
    expectedCachedPages.push(getMockCachedPage(entry));
  });

  var getEntryAsCachedPageSpy = sinon.stub();
  for (var i = 0; i < expectedCachedPages.length; i++) {
    getEntryAsCachedPageSpy.onCall(i).returns(expectedCachedPages[i]);
  }

  datastore.getAllFileEntriesForPages = getAllFileEntriesSpy;
  datastore.getEntryAsCachedPage = getEntryAsCachedPageSpy;

  datastore.getAllCachedPages()
  .then(pages => {
    t.deepEqual(pages, expectedCachedPages);
    t.end();
    resetDatastore();
  });
});

test('getAllCachedPages rejects if base dir not set', function(t) {
  var expectedErr = {cause: 'error msg from getAllFileEntriesForPages'};
  var getAllFileEntriesSpy = sinon.stub().rejects(expectedErr);

  datastore.getAllFileEntriesForPages = getAllFileEntriesSpy;

  datastore.getAllCachedPages()
  .catch(actualErr => {
    t.equal(actualErr, expectedErr);
    t.end();
    resetDatastore();
  });
});

test('getAllFileEntriesForPages resolves all pages', function(t) {
  var dirEntry = 'baseDir';
  var getPersistedBaseDirSpy = sinon.stub().resolves(dirEntry);

  var expectedEntries = ['a', 'b', 54321, 'foobar', {}];
  var listEntriesSpy = sinon.stub().resolves(expectedEntries);

  var fileSystemStub = {};
  fileSystemStub.getPersistedBaseDir = getPersistedBaseDirSpy;
  var fsUtilStub = {};
  fsUtilStub.listEntries = listEntriesSpy;

  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore',
    {
      './file-system': fileSystemStub,
      './file-system-util': fsUtilStub
    }
  );

  datastore.getAllFileEntriesForPages()
  .then(entries => {
    t.deepEqual(entries, expectedEntries);
    t.end();
    resetDatastore();
  });
});

test('getAllFileEntriesForPages rejects if base dir not set', function(t) {
  var getPersistedBaseDirSpy = sinon.stub().resolves(null);
  var fileSystemStub = {};
  fileSystemStub.getPersistedBaseDir = getPersistedBaseDirSpy;

  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore',
    {
      './file-system': fileSystemStub
    }
  );

  datastore.getAllFileEntriesForPages()
  .catch(err => {
    t.equal(err, 'dir not set');
    t.end();
    resetDatastore();
  });
});

test('getEntryAsCachedPage returns CachedPage', function(t) {
  var url = 'www.example.co.uk/fancyExample.html';
  var date = 'dateTime';
  var entry = {
    name: url + '_' + date,
    fullPath: '/cache/dir/www.example.co.uk/fancyExample.html_dateTime',
  };

  var accessUrl = 'the url with the file';
  var getAccessUrlStub = sinon.stub().returns(accessUrl);
  var serverApiStub = {};
  serverApiStub.getAccessUrlForCachedPage = getAccessUrlStub;

  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore',
    {
      '../server/server-api': serverApiStub
    }
  );

  var getUrlStub = sinon.stub().returns(url);
  var getDateStub = sinon.stub().returns(date);

  datastore.getCaptureUrlFromName = getUrlStub;
  datastore.getCaptureDateFromName = getDateStub;

  var expected = new datastore.CachedPage(url, date, accessUrl);
  var actual = datastore.getEntryAsCachedPage(entry);

  t.deepEqual(actual, expected);
  t.end();
});
