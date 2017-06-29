/*jshint esnext:true*/
/* globals Promise */
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const putil = require('../../../../chromeapp/test/scripts/persistence/persistence-util');
const util = require('../test-util');

let datastore = require('../../../app/scripts/persistence/datastore');


/**
 * Proxyquire the datastore object with proxies passed as the proxied modules.
 */
function proxyquireDatastore(proxies) {
  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore',
    proxies
  );
}

function resetDatastore() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/datastore')
  ];
  datastore = require('../../../app/scripts/persistence/datastore');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  resetDatastore();
}

test('getDomain works for http://www.google.com', function(t) {
  let expected = 'www.google.com';
  let url = 'http://www.google.com';
  let actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

test('getDomain works for https://t.co', function(t) {
  let expected = 't.co';
  let url = 'https://t.co';
  let actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

test('getDomain ignores hash', function(t) {
  let expected = 'example.com';
  let url = 'http://example.com#foo';
  let actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

test('getDomain ignores query parameters', function(t) {
  let expected = 'foo.bar.com';
  let url = 'https://foo.bar.com?happy=golucky&foo=bar';
  let actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

test('getDomain ignores both hash and query parameters', function(t) {
  let expected = 'example.com';
  let url = 'https://example.com#frame?foo=baz';
  let actual = datastore.getDomain(url);
  t.equal(actual, expected);
  t.end();
});

test('getSnapshotDataUrl resolves with correct result', function(t) {
  let expected = 'data:someUrl';

  let options = { quality: datastore.DEFAULT_SNAPSHOT_QUALITY };
  let captureSpy = sinon.stub();
  captureSpy.withArgs(null, options).resolves(expected);

  proxyquireDatastore({
    '../chrome-apis/tabs': {
      captureVisibleTab: captureSpy
    }
  });

  datastore.getSnapshotDataUrl()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFaviconAsUrl resolves with data url', function(t) {
  let url = 'http://g.co/favicon.png';
  let blob = 'blob';
  let expected = 'dataurl';

  let fetchStub = sinon.stub();
  fetchStub.withArgs(url).resolves({
    blob: sinon.stub().resolves(blob)
  });

  let getBlobAsDataUrlStub = sinon.stub();
  getBlobAsDataUrlStub.withArgs(blob).resolves(expected);

  proxyquireDatastore({
    '../util/util': {
      fetch: fetchStub
    },
    '../../../../chromeapp/app/scripts/util': {
      getBlobAsDataUrl: getBlobAsDataUrlStub
    }
  });

  datastore.getFaviconAsUrl(url)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFaviconAsUrl handles invalid url input', function(t) {
  let invalid1 = datastore.getFaviconAsUrl(undefined);
  let invalid2 = datastore.getFaviconAsUrl('');

  Promise.all([invalid1, invalid2])
    .then(results => {
      t.deepEqual(results, ['', '']);
      t.end();
    });
});

test('getMhtmlBuff resolves with Buffer', function(t) {
  let tab = util.genTabs(1).next().value;

  let blob = 'blob';
  let buff = 'buff';

  let saveArg = { tabId: tab.id };
  let saveAsMHTMLStub = sinon.stub();
  saveAsMHTMLStub.withArgs(saveArg).resolves(blob);

  let blobToBufferStub = sinon.stub();
  blobToBufferStub.withArgs(blob).resolves(buff);

  proxyquireDatastore({
    '../chrome-apis/page-capture': {
      saveAsMHTML: saveAsMHTMLStub
    },
    '../../../../chromeapp/app/scripts/util': {
      blobToBuffer: blobToBufferStub
    }
  });

  datastore.getMhtmlBuff(tab)
  .then(actual => {
    t.deepEqual(actual, buff);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getMhtmlBuff rejects', function(t) {
  let expected = { err: 'no' };

  proxyquireDatastore({
    '../chrome-apis/page-capture': {
      saveAsMHTML: sinon.stub().rejects(expected)
    }
  });

  datastore.getMhtmlBuff({})
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('saveTab resolves with response', function(t) {
  let cpdisk = putil.genCPDisks(1).next().value;
  // Make a copy b/c the as JSON methods mutate it in place.
  let cpdiskCopy = putil.genCPDisks(1).next().value;
  // Clear the  filepath on both.
  cpdisk.filePath = null;
  cpdiskCopy.filePath = null;

  let expectedJson = cpdiskCopy.toJSON();

  let tab = util.genTabs(1).next().value;
  tab.url = cpdisk.captureHref;
  tab.title = cpdisk.title;

  let getFaviconStub = sinon.stub();
  getFaviconStub.withArgs(tab.favIconUrl).resolves(cpdisk.favicon);
  
  let getSnapshotStub = sinon.stub();
  getSnapshotStub.resolves(cpdisk.screenshot);

  let getMhtmlStub = sinon.stub();
  getMhtmlStub.withArgs(tab).resolves(cpdisk.mhtml);

  let getDateStub = sinon.stub();
  getDateStub.returns(cpdisk.captureDate);

  let from = 'popup';

  let expected = 'from savepage';

  let savePageStub = sinon.stub();
  savePageStub.withArgs(from, expectedJson).resolves(expected);

  proxyquireDatastore({
    '../app-bridge/messaging': {
      savePage: savePageStub
    }
  });
  datastore.getFaviconAsUrl = getFaviconStub;
  datastore.getSnapshotDataUrl = getSnapshotStub;
  datastore.getMhtmlBuff = getMhtmlStub;
  datastore.getDateForSave = getDateStub;

  datastore.saveTab(from, tab)
  .then(actual => {
    t.deepEqual(actual, expected);
    // Assert this again, even though we have the withArgs() above, so that we
    // get more informative errors.
    t.deepEqual(savePageStub.args[0][1], expectedJson);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('saveTab rejects on error', function(t) {
  let expected = { err: 'dating problems' };
  
  datastore.getDateForSave = sinon.stub().throws(expected);

  datastore.saveTab('popup', {})
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
