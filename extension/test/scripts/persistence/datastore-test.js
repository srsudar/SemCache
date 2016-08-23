/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');
var datastore = require('../../../app/scripts/persistence/datastore');

/**
 * Proxyquire the datastore object with proxies passed as the proxied modules.
 */
function proxyquireDatastore(proxies) {
  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore',
    proxies
  );
}

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

/**
 * A wrapper around test() that takes care of resetting anything that tests do
 * to the datastore object (e.g. changes to required modules by proxyquire).
 */
function testWrapper(description, fn) {
  test(description, function(t) {
    fn(t);
    resetDatastore();
  });
}

testWrapper('getDomain works for http://www.google.com', function(t) {
  var expected = 'www.google.com';
  var url = 'http://www.google.com';
  var actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

testWrapper('getDomain works for https://t.co', function(t) {
  var expected = 't.co';
  var url = 'https://t.co';
  var actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

testWrapper('getDomain ignores hash', function(t) {
  var expected = 'example.com';
  var url = 'http://example.com#foo';
  var actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

testWrapper('getDomain ignores query parameters', function(t) {
  var expected = 'foo.bar.com';
  var url = 'https://foo.bar.com?happy=golucky&foo=bar';
  var actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

testWrapper('getDomain ignores both hash and query parameters', function(t) {
  var expected = 'example.com';
  var url = 'https://example.com#frame?foo=baz';
  var actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

testWrapper('getSnapshotDataUrl resolves with correct result', function(t) {
  // We are relying on chrome.tabs.captureVisibleTab, so just return the result
  // of that.
  var expected = 'data:someUrl';
  var captureVisibleTabSpy = sinon.stub().resolves(expected);

  proxyquireDatastore({
    '../chrome-apis/tabs': {
      captureVisibleTab: captureVisibleTabSpy
    }
  });

  datastore.getSnapshotDataUrl()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('createMetadataForWrite correct if all resolve', function(t) {
  var fullUrl = 'https://www.foo.com#happyDays?happy=maybe';
  var snapshotUrl = 'data:snappy';
  var mimeType = 'multipart/related';
  var expected = {
    fullUrl: fullUrl,
    snapshot: snapshotUrl,
    mimeType: mimeType
  };

  datastore.getSnapshotDataUrl = sinon.stub().resolves(snapshotUrl);

  datastore.createMetadataForWrite(fullUrl)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('createMetadataForWrite correct if snapshot empty', function(t) {
  // Make sure we fail gracefully if for some reason snapshot doesn't work.
  var fullUrl = 'https://www.foo.com#happyDays?happy=maybe';
  var snapshotUrl = '';
  var mimeType = 'multipart/related';
  var expected = {
    fullUrl: fullUrl,
    mimeType: mimeType
  };

  datastore.getSnapshotDataUrl = sinon.stub().resolves(snapshotUrl);

  datastore.createMetadataForWrite(fullUrl)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('savePage calls messaging component with params', function(t) {
  var captureUrl = 'http://www.savemeplz.com';
  var domain = 'www.savemeplz.com';
  var captureDate = 'today';
  var dataUrl = 'data: blob';
  var metadata = { much: 'fancy', less: 'lame' };

  var blob = 'mhtml blob';

  var getBlobAsDataUrlSpy = sinon.stub().withArgs(blob).returns(dataUrl);
  var savePageSpy = sinon.stub();

  proxyquireDatastore({
    '../app-bridge/messaging': {
      savePage: savePageSpy
    }
  });
  datastore.getBlobAsDataUrl = getBlobAsDataUrlSpy;
  datastore.getDateForSave = sinon.stub().returns(captureDate);
  datastore.createMetadataForWrite = sinon.stub().withArgs(captureUrl)
    .resolves(metadata);

  datastore.savePage(captureUrl, blob)
    .then(result => {
      t.deepEqual(
        savePageSpy.args[0],
        [domain, captureDate, dataUrl, metadata]
      );
      // We don't expect a resolved value.
      t.equal(result, undefined);
      t.end();
    });
});
