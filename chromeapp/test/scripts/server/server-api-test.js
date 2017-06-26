'use strict';

const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

const BloomFilter = require('../../../app/scripts/coalescence/bloom-filter').BloomFilter;
const putil = require('../persistence/persistence-util');
const sutil = require('./util');

let api = require('../../../app/scripts/server/server-api');

function proxyquireApi(proxies) {
  api = proxyquire('../../../app/scripts/server/server-api', proxies);
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetApi() {
  delete require.cache[
    require.resolve('../../../app/scripts/server/server-api')
  ];
  api = require('../../../app/scripts/server/server-api');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetApi();
  t.end();
}

test('getAccessUrlForCachedPage outputs correct url', function(t) {
  let fullPath = 'www.example.com_somedate';
  let iface = {
    address: '172.9.18.145',
    port: 1234
  };

  let expected = 'http://' +
    iface.address +
    ':' +
    iface.port +
    '/pages/' +
    fullPath;

  proxyquireApi({
    '../app-controller': {
      getListeningHttpInterface: sinon.stub().returns(iface)
    }
  });

  let actual = api.getAccessUrlForCachedPage(fullPath);
  t.equal(expected, actual);
  end(t);
});

test('getResponseForAllCachedPages rejects if read fails', function(t) {
  let errObj = {msg: 'could not read pages'};
  let getCachedPageSummariesStub = sinon.stub().rejects(errObj);

  proxyquireApi({
    '../persistence/datastore': {
      getCachedPageSummaries: getCachedPageSummariesStub
    }
  });

  api.getResponseForAllCachedPages()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actualErr => {
    t.deepEqual(actualErr, errObj);
    end(t);
  });
});

test('getResponseForAllCachedPages resolves with pages', function(t) {
  let cpsums = [...putil.genCPSummaries(9)];
  let metadataObj = { foo: 'bar' };
  let getSummariesStub = sinon.stub();
  getSummariesStub.withArgs(0, 50).resolves(cpsums);

  proxyquireApi({
    '../persistence/datastore': {
      getCachedPageSummaries: getSummariesStub
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  let expectedJson = {
    metadata: metadataObj,
    cachedPages: cpsums
  };
  let expectedBuff = Buffer.from(JSON.stringify(expectedJson));

  api.getResponseForAllCachedPages()
  .then(actual => {
    t.deepEqual(actual, expectedBuff);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getCachedFileNameFromPath parses path correct', function(t) {
  let expected = 'www.npm.js_somedate.mhtml';
  let path = '/pages/' + expected;

  let api = require('../../../app/scripts/server/server-api');

  let actual = api.getCachedFileNameFromPath(path);
  t.equal(actual, expected);
  t.end();
});

test('getListPageUrlForCache returns correct URL', function(t) {
  let ipAddress = '123.4.56.7';
  let port = 3333;

  let expected = 'http://123.4.56.7:3333/list_pages';
  let actual = api.getListPageUrlForCache(ipAddress, port);
  t.equal(actual, expected);
  end(t);
});

test('getResponseForAllPagesDigest rejects if read fails', function(t) {
  let errObj = { msg: 'could not read pages' };
  let getAllCachedPagesSpy = sinon.stub().rejects(errObj);

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: getAllCachedPagesSpy
    }
  });

  api.getResponseForAllPagesDigest()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actualErr => {
    t.deepEqual(actualErr, errObj);
    end(t);
  });
});

test('getResponseForAllPagesDigest resolves on success', function(t) {
  let cpinfos = [...putil.genCPInfos(2)];

  let metadataObj = { foo: 'bar' };
  let getAllCachedPagesSpy = sinon.stub().resolves(cpinfos);

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: getAllCachedPagesSpy
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  let expectedJson = {
    metadata: metadataObj,
    digest: cpinfos.map(info => {
      return {
        fullUrl: info.captureHref,
        captureDate: info.captureDate
      };
    })
  };
  let expectedBuff = Buffer.from(JSON.stringify(expectedJson));

  api.getResponseForAllPagesDigest()
  .then(actual => {
    t.deepEqual(actual, expectedBuff);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResponseForBloomFilter resolves on success', function(t) {
  let cpinfos = [...putil.genCPInfos(5)];
  let bf = new BloomFilter();
  cpinfos.forEach(info => bf.add(info.captureHref));
  let expected = bf.serialize();

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().resolves(cpinfos)
    }
  });

  api.getResponseForBloomFilter()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResponseForAllPagesDigest rejects on error', function(t) {
  let expected = { err: 'nope' };

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().rejects(expected)
    }
  });

  api.getResponseForBloomFilter()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getResponseForCachedPage resolves on success', function(t) {
  let href = 'https://hello';
  let params = { href };
  let metadataObj = { meta: 'oh my ' };

  let disks = [...putil.genCPDisks(2)];

  let disk1 = disks[0];
  let disk2 = disks[1];

  let expected = disk1.asBuffer();

  let getSpy = sinon.stub();
  getSpy.withArgs(href).resolves([ disk1, disk2 ]);

  proxyquireApi({
    '../persistence/datastore': {
      getCPDiskForHrefs: getSpy
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  api.getResponseForCachedPage(params)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResponseForCachedPage resolves null if not found', function(t) {
  proxyquireApi({
    '../persistence/datastore': {
      getCPDiskForHrefs: sinon.stub().resolves([])
    }
  });

  api.getResponseForCachedPage({})
  .then(actual => {
    t.deepEqual(actual, null);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResponseForCachedPage rejects on err', function(t) {
  let expected = { err: 'ohno' };
  proxyquireApi({
    '../persistence/datastore': {
      getCPDiskForHrefs: sinon.stub().rejects(expected)
    }
  });

  api.getResponseForCachedPage({})
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('parseResponseForList correct', function(t) {
  let expected = sutil.getListResponseObj();
  let response = sutil.getListResponseBuff();
  
  let actual = api.parseResponseForList(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForCachedPage correct if non-null', function(t) {
  let expected = sutil.getCachedPageResponseObj();
  let response = sutil.getCachedPageResponseBuff();

  let actual = api.parseResponseForCachedPage(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForDigest correct', function(t) {
  let expected = sutil.getDigestResponseJson();
  let response = sutil.getDigestResponseBuff();

  let actual = api.parseResponseForDigest(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForBloomFilter correct', function(t) {
  let expected = new BloomFilter();
  expected.add('yo');

  // We expect the response to be just a serialized Bloom filter.
  let buff = expected.serialize();

  let actual = api.parseResponseForBloomFilter(buff);

  // Testing for deepEqual on the top level object fails because of the
  // _locations field. This seems to never be used in the object? Unclear as to
  // what it is, so just ignoring it.
  t.deepEqual(actual.buckets, expected.buckets);
  end(t);
});
