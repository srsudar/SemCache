'use strict';
let test = require('tape');
let sinon = require('sinon');
let proxyquire = require('proxyquire');
require('sinon-as-promised');

let datastore = require('../../../app/scripts/persistence/datastore');
let objects = require('../../../app/scripts/persistence/objects');
let putil = require('./persistence-util');

let CPDisk = objects.CPDisk;


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/datastore')
  ];
  datastore = require('../../../app/scripts/persistence/datastore');
}

function proxyquireDatastore(proxies) {
  datastore = proxyquire(
    '../../../app/scripts/persistence/datastore', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}

test('createFileNameForPage returns correct string', function(t) {
  let href = 'http://www.nytimes.com/long/stuff.html?foo#bar';

  let captureDate = '2016-07-22T08:49:19.182Z';

  let actual = datastore.createFileNameForPage(href, captureDate);
  let expected = 'www.nytimes.com' + '_' + '2016-07-22T084919.182Z' + '.mhtml';

  t.equal(actual, expected);
  end(t);
});

test('getAllCachedPages returns database call', function(t) {
  let expected = 'hello';
  proxyquireDatastore({
    './database': {
      getAllCPInfos: sinon.stub().returns(expected)
    }
  });

  let actual = datastore.getAllCachedPages();
  t.equal(actual, expected);
  end(t);
});

test('getCachedPageSummaries returns database call', function(t) {
  let expected = 'summary info';
  let offset = 5;
  let num = 20;

  let stub = sinon.stub();
  stub.withArgs(offset, num).returns(expected);

  proxyquireDatastore({
    './database': {
      getCachedPageSummaries: stub
    }
  });

  let actual = datastore.getCachedPageSummaries(offset, num);
  t.equal(actual, expected);
  end(t);
});

test('addPageToCache rejects if getFile rejects', function(t) {
  const expected = { err: 'things did not go as planned' };
  const fileName = 'hello.mhtml';

  const href = 'http://nytimes.com';
  const date = '2017-06-24';

  const cpdisk = new CPDisk({ captureHref: href, captureDate: date });
  
  const getFileForWritingCachedPageStub = sinon.stub();
  getFileForWritingCachedPageStub.withArgs(fileName).rejects(expected);

  proxyquireDatastore({
    './file-system': {
      getFileForWritingCachedPage: getFileForWritingCachedPageStub
    },
    './database': {
      addPageToDb: sinon.stub().resolves()
    }
  });
  datastore.createFileNameForPage = sinon.stub();
  datastore.createFileNameForPage.withArgs(href, date).returns(fileName);

  datastore.addPageToCache(cpdisk)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('addPageToCache resolves if all others succeed', function(t) {
  const expected = { name: 'I am the file entry' };
  const fileName = 'very_right.mhtml';

  const href = 'http://nytimes.com';
  const date = '2017-06-24';
  const mhtml = 'I am the blob';

  const page = new CPDisk({
    captureHref: href,
    captureDate: date,
    mhtml: mhtml
  });

  // This page should be modified and a file name added.
  const expectedPage = new CPDisk({
    captureHref: href,
    captureDate: date,
    mhtml: mhtml,
    filePath: fileName
  });
  
  const getFileForWritingCachedPageStub = sinon.stub();
  getFileForWritingCachedPageStub.withArgs(fileName).resolves(expected);
  const writeToFileStub = sinon.stub();
  writeToFileStub.withArgs(expected,mhtml) .resolves();

  const addPageToDbStub = sinon.stub().resolves();
  proxyquireDatastore({
    './file-system': {
      getFileForWritingCachedPage: getFileForWritingCachedPageStub
    },
    './file-system-util': {
      writeToFile: writeToFileStub
    },
    './database': {
      addPageToDb: addPageToDbStub
    }
  });
  datastore.createFileNameForPage = sinon.stub();
  datastore.createFileNameForPage.withArgs(href, date).returns(fileName);

  datastore.addPageToCache(page)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(addPageToDbStub.args[0], [expectedPage]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCPDiskForHrefs correct on success', function(t) {
  let num = 5;
  let cpdisks = [...putil.genAllParams(num)].map(params => new CPDisk(params));

  let cpsummaries = cpdisks.map(cpdisk => cpdisk.asCPSummary());
  let hrefs = cpdisks.map(cpdisk => cpdisk.captureHref);

  let getCPSummariesStub = sinon.stub();
  getCPSummariesStub.withArgs(hrefs).resolves(cpsummaries);

  let getFileContentsStub = sinon.stub();
  cpdisks.forEach(cpdisk => {
    getFileContentsStub.withArgs(cpdisk.filePath).resolves(cpdisk.mhtml);
  });

  proxyquireDatastore({
    './database': {
      getCPSummariesForHrefs: getCPSummariesStub
    },
    './file-system': {
      getFileContentsFromName: getFileContentsStub
    }
  });

  let expected = cpdisks;

  datastore.getCPDiskForHrefs(hrefs)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCPDiskForHrefs rejects on error', function(t) {
  let expected = { err: 'they call me MR TRUBS' };
  let hrefs = [...putil.genAllParams(10)].map(params => params.captureHref);

  let getCPSummariesStub = sinon.stub();
  getCPSummariesStub.withArgs(hrefs).rejects(expected);

  proxyquireDatastore({
    './database': {
      getCPSummariesForHrefs: getCPSummariesStub
    },
  });

  datastore.getCPDiskForHrefs(hrefs)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
