'use strict';

const Buffer = require('buffer/').Buffer;
const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

let api = require('../../../app/scripts/server/server-api');
const putil = require('../persistence/persistence-util');
const sutil = require('./util');

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
  var fullPath = 'www.example.com_somedate';
  var iface = {
    address: '172.9.18.145',
    port: 1234
  };

  var expected = 'http://' +
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

  var actual = api.getAccessUrlForCachedPage(fullPath);
  t.equal(expected, actual);
  end(t);
});

test('getResponseForAllCachedPages rejects if read fails', function(t) {
  var errObj = {msg: 'could not read pages'};
  var getCachedPageSummariesStub = sinon.stub().rejects(errObj);

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
  var expected = 'www.npm.js_somedate.mhtml';
  var path = '/pages/' + expected;

  var api = require('../../../app/scripts/server/server-api');

  var actual = api.getCachedFileNameFromPath(path);
  t.equal(actual, expected);
  t.end();
});

test('getListPageUrlForCache returns correct URL', function(t) {
  var ipAddress = '123.4.56.7';
  var port = 3333;

  var expected = 'http://123.4.56.7:3333/list_pages';
  var actual = api.getListPageUrlForCache(ipAddress, port);
  t.equal(actual, expected);
  end(t);
});

test('getResponseForAllPagesDigest rejects if read fails', function(t) {
  var errObj = { msg: 'could not read pages' };
  var getAllCachedPagesSpy = sinon.stub().rejects(errObj);

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
