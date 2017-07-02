'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const BloomFilter = require('../../../app/scripts/coalescence/bloom-filter').BloomFilter;
const putil = require('../persistence/persistence-util');
const sutil = require('./util');
const tutil = require('../test-util');

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

function helperThrowsIfNotSpecified(t, fn) {
  let { ipAddress, port } = tutil.getIpPort();

  let throwIp = function() {
    fn(null, port);
  };

  let throwPort = function() {
    fn(ipAddress, null);
  };

  t.throws(throwIp);
  t.throws(throwPort);
}

function getUrlForPath(ipAddress, port, path) {
  let result = [
    'http://',
    ipAddress,
    ':',
    port,
    '/',
    path
  ].join('');
  return result;
}

test('getUrlForDigest outputs correct url', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let expected = getUrlForPath(
    ipAddress, port, api.getApiEndpoints().pageDigest
  );
  let actual = api.getUrlForDigest(ipAddress, port);
  t.equal(actual, expected);
  end(t);
});

test('getUrlForDigest throws if invalid params', function(t) {
  helperThrowsIfNotSpecified(t, api.getUrlForDigest);
  end(t);
});

test('getUrForBloomFilter outputs correct url', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  let expected = getUrlForPath(
    ipAddress, port, api.getApiEndpoints().bloomFilter
  );
  let actual = api.getUrlForBloomFilter(ipAddress, port);
  t.equal(actual, expected);
  end(t);
});

test('getUrlForBloomFilter throws if invalid params', function(t) {
  helperThrowsIfNotSpecified(t, api.getUrlForBloomFilter);
  end(t);
});

test('getAccessUrlForCachedPage outputs correct url', function(t) {
  // We'll test this by encoding and decoding it.
  let { ipAddress, port } = tutil.getIpPort();
  let href = tutil.genUrls(1).next().value;

  let path = api.getAccessUrlForCachedPage(ipAddress, port, href);
  let recovered = api.getCachedPageHrefFromPath(path);

  t.equal(recovered, href);
  end(t);
});

test('getAccessUrlForCachedPage throws if invalid params', function(t) {
  helperThrowsIfNotSpecified(t, api.getAccessUrlForCachedPage);

  let noHref = function() {
    api.getAccessUrlForCachedPage('1.2.3.4', 1234, null);
  };

  t.throws(noHref);
  end(t);
});

test('getResponseForList rejects if read fails', function(t) {
  let errObj = {msg: 'could not read pages'};
  let getCachedPageSummariesStub = sinon.stub().rejects(errObj);

  proxyquireApi({
    '../persistence/datastore': {
      getCachedPageSummaries: getCachedPageSummariesStub
    }
  });

  api.getResponseForList()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actualErr => {
    t.deepEqual(actualErr, errObj);
    end(t);
  });
});

test('getResponseForList resolves no next, no prev', function(t) {
  let offset = 0;
  let limit = 50;
  let num = 9;
  let cpsums = [...putil.genCPSummaries(num)];
  let metadataObj = { foo: 'bar' };
  let getSummariesStub = sinon.stub();
  getSummariesStub.withArgs(offset, limit).resolves(cpsums);

  proxyquireApi({
    '../persistence/datastore': {
      getCachedPageSummaries: getSummariesStub,
      getNumCachedPages: sinon.stub().resolves(num)
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  let expectedJson = {
    metadata: metadataObj,
    hasPrev: false,
    hasNext: false,
    cachedPages: cpsums.map(cpsum => cpsum.toJSON())
  };
  let expectedBuff = Buffer.from(JSON.stringify(expectedJson));

  api.getResponseForList(offset, limit)
  .then(actualBuff => {
    // Can't rely on order of these things when you're stringifying, and
    // straight Buffer comparisons rely on order. Instead prase them and make
    // sure we reclaim both as identical.
    let expected = JSON.parse(expectedBuff.toString());
    let actual = JSON.parse(actualBuff.toString());
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getResponseForList correct for prev and next', function(t) {
  let offset = 10;
  let limit = 5;
  let num = 100;
  let cpsums = [...putil.genCPSummaries(num)].slice(offset, offset + limit);
  let metadataObj = { foo: 'bar' };
  let getSummariesStub = sinon.stub();
  getSummariesStub
    .withArgs(offset, limit).resolves(cpsums);

  proxyquireApi({
    '../persistence/datastore': {
      getCachedPageSummaries: getSummariesStub,
      getNumCachedPages: sinon.stub().resolves(num)
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  let expectedJson = {
    metadata: metadataObj,
    hasPrev: true,
    hasNext: true,
    prevOffset: offset - limit,
    nextOffset: offset + limit,
    cachedPages: cpsums.map(cpsum => cpsum.toJSON())
  };
  let expectedBuff = Buffer.from(JSON.stringify(expectedJson));

  api.getResponseForList(offset, limit)
  .then(actualBuff => {
    let actual = JSON.parse(actualBuff.toString());
    let expected = JSON.parse(expectedBuff.toString());
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getListPageUrlForCache returns correct URL', function(t) {
  let { ipAddress, port } = tutil.getIpPort();

  let expected = getUrlForPath(
    ipAddress, port, api.getApiEndpoints().listPageCache
  );
  let actual = api.getListPageUrlForCache(ipAddress, port);
  t.equal(actual, expected);
  end(t);
});

test('getListPageUrlForCache throws if invalid params', function(t) {
  helperThrowsIfNotSpecified(t, api.getListPageUrlForCache);
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
  let expected = bf.toBuffer();

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
  let metadataObj = { meta: 'oh my ' };

  let disks = [...putil.genCPDisks(2)];

  let disk1 = disks[0];
  let disk2 = disks[1];

  let expected = disk1.toBuffer();

  let getSpy = sinon.stub();
  getSpy.withArgs(href).resolves([ disk1, disk2 ]);

  proxyquireApi({
    '../persistence/datastore': {
      getCPDiskForHrefs: getSpy
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  api.getResponseForCachedPage(href)
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

  api.getResponseForCachedPage()
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

  api.getResponseForCachedPage()
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
  let expected = sutil.getListResponseParsed();
  let response = sutil.getListResponseBuff();
  
  let actual = api.parseResponseForList(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForCachedPage correct if non-null', function(t) {
  let expected = sutil.getCachedPageResponseParsed();
  let response = sutil.getCachedPageResponseBuff();

  let actual = api.parseResponseForCachedPage(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForDigest correct', function(t) {
  let expected = sutil.getDigestResponseParsed();
  let response = sutil.getDigestResponseBuff();

  let actual = api.parseResponseForDigest(response);

  t.deepEqual(actual, expected);
  end(t);
});

test('parseResponseForBloomFilter correct', function(t) {
  let expected = sutil.getBloomResponseParsed();
  let response = sutil.getBloomResponseBuff();

  let actual = api.parseResponseForBloomFilter(response);

  tutil.assertBloomFiltersEqual(t, actual, expected);
  end(t);
});
