/*jshint esnext:true*/
/* globals Promise */
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
 * @return {object} an object mimicking Chrome's Tab object
 */
function createTabObj(id, title, url, faviconUrl) {
  var result = {
    tabId: id,
    url: url,
    favIconUrl: faviconUrl,
    title: title
  };
  return result;
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
      t.deepEqual(
        captureVisibleTabSpy.args[0],
        [null, { quality: datastore.DEFAULT_SNAPSHOT_QUALITY }]
      );
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('getFaviconAsUrl resolves with data url', function(t) {
  var url = 'http://g.co/favicon.png';
  var raw = 'rawfavicon';
  var expected = 'dataurl';
  
  var fetchResponse = {
    blob: sinon.stub().resolves(raw)
  };
  var fetchSpy = sinon.stub().withArgs(url).resolves(fetchResponse);
  var getBlobAsDataUrlSpy = sinon.stub().withArgs(raw).resolves(expected);

  proxyquireDatastore({
    '../util': {
      fetch: fetchSpy
    }
  });
  datastore.getBlobAsDataUrl = getBlobAsDataUrlSpy;

  datastore.getFaviconAsUrl(url)
    .then(actual => {
      t.equal(actual, expected);
      t.deepEqual(fetchSpy.args[0], [url]);
      t.deepEqual(getBlobAsDataUrlSpy.args[0], [raw]);
      t.end();
    });
});

testWrapper('getFaviconAsUrl empty if rejects', function(t) {
  var url = 'hello.png';
  var expected = '';

  var fetchSpy = sinon.stub().withArgs(url).rejects(expected);

  proxyquireDatastore({
    '../util': {
      fetch: fetchSpy
    }
  });

  datastore.getFaviconAsUrl(url)
    .catch(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('getFaviconAsUrl handles invalid url input', function(t) {
  var invalid1 = datastore.getFaviconAsUrl(undefined);
  var invalid2 = datastore.getFaviconAsUrl('');

  Promise.all([invalid1, invalid2])
    .then(results => {
      t.deepEqual(results, ['', '']);
      t.end();
    });
});

testWrapper('createMetadataForWrite no favicon if empty', function(t) {
  var fullUrl = 'https://www.foo.com#happyDays?happy=maybe';
  var mimeType = 'multipart/related';
  var favUrl = 'http://foo.com/tinyIcon.png';
  var title = 'The Day The Earth Stood Still';
  var tabId = 'the-tab-id';

  var tab = createTabObj(tabId, title, fullUrl, favUrl);

  var snapshotUrl = 'data:snappy';
  var faviconDataUrl = '';

  var expected = {
    fullUrl: fullUrl,
    snapshot: snapshotUrl,
    mimeType: mimeType,
    title: title,
  };

  datastore.getSnapshotDataUrl = sinon.stub().resolves(snapshotUrl);
  datastore.getFaviconAsUrl = sinon.stub().withArgs(favUrl)
    .resolves(faviconDataUrl);

  datastore.createMetadataForWrite(tab)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('createMetadataForWrite correct if all resolve', function(t) {
  var fullUrl = 'https://www.foo.com#happyDays?happy=maybe';
  var mimeType = 'multipart/related';
  var favUrl = 'http://foo.com/tinyIcon.png';
  var title = 'The Day The Earth Stood Still';
  var tabId = 'the-tab-id';

  var tab = createTabObj(tabId, title, fullUrl, favUrl);

  var snapshotUrl = 'data:snappy';
  var faviconDataUrl = 'data:fromIcon';

  var expected = {
    fullUrl: fullUrl,
    snapshot: snapshotUrl,
    mimeType: mimeType,
    title: title,
    favicon: faviconDataUrl
  };

  datastore.getSnapshotDataUrl = sinon.stub().resolves(snapshotUrl);
  datastore.getFaviconAsUrl = sinon.stub().withArgs(favUrl)
    .resolves(faviconDataUrl);

  datastore.createMetadataForWrite(tab)
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
  var faviconUrl = 'path/to/favicon';
  var faviconAsData = 'faviconAsData';
  var id = 12345;
  var title = 'fancy msg';
  var expected = {
    fullUrl: fullUrl,
    mimeType: mimeType,
    favicon: faviconAsData,
    title: title
  };

  var tab = createTabObj(id, title, fullUrl, faviconUrl);

  datastore.getSnapshotDataUrl = sinon.stub().resolves(snapshotUrl);
  datastore.getFaviconAsUrl = sinon.stub().withArgs(faviconUrl)
    .resolves(faviconAsData);

  datastore.createMetadataForWrite(tab)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
    });
});

testWrapper('savePage rejects if messaging.savePage rejects', function(t) {
  var tab = createTabObj(4, 'any title', 'any url', 'faviconUrl');
  var blob = 'blobby mcblobface';
  var dataUrl = 'data url for blobby';
  var metadata = 'mdata';

  var errFromDatastore = { msg: 'things gone wrong' };
  var savePageSpy = sinon.stub().rejects(errFromDatastore);

  proxyquireDatastore({
    '../app-bridge/messaging': {
      savePage: savePageSpy,
      setTimeout: sinon.stub()
    }
  });
  datastore.getDateForSave = sinon.stub();
  datastore.getBlobAsDataUrl = sinon.stub().withArgs(blob).resolves(dataUrl);
  datastore.createMetadataForWrite = sinon.stub().withArgs(tab)
    .resolves(metadata);

  datastore.savePage(tab, blob)
    .catch(err => {
      t.deepEqual(err, errFromDatastore);
      t.end();
    });
});

testWrapper('savePage calls messaging component with params', function(t) {
  var captureUrl = 'http://www.savemeplz.com';
  var domain = 'www.savemeplz.com';
  var captureDate = 'today';
  var dataUrl = 'data: blob';
  var metadata = { much: 'fancy', less: 'lame' };
  var title = 'titular title';
  var messageFromApp = 'from the app';

  var blob = 'mhtml blob';
  var tab = createTabObj(4, title, captureUrl, 'faviconUrl');

  var getBlobAsDataUrlSpy = sinon.stub().withArgs(blob).resolves(dataUrl);
  var savePageSpy = sinon.stub().resolves(messageFromApp);
  var createMetadataForWriteSpy = sinon.stub().withArgs(captureUrl)
    .resolves(metadata);

  proxyquireDatastore({
    '../app-bridge/messaging': {
      savePage: savePageSpy,
      setTimeout: sinon.stub()
    }
  });
  datastore.getBlobAsDataUrl = getBlobAsDataUrlSpy;
  datastore.getDateForSave = sinon.stub().returns(captureDate);
  datastore.createMetadataForWrite = createMetadataForWriteSpy;

  datastore.savePage(tab, blob)
    .then(result => {
      t.deepEqual(
        savePageSpy.args[0],
        [domain, captureDate, dataUrl, metadata]
      );
      t.deepEqual(createMetadataForWriteSpy.args[0], [tab]);
      t.equal(result, messageFromApp);
      t.end();
    });
});
