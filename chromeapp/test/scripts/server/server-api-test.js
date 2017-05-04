'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var api = require('../../../app/scripts/server/server-api');

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
  var getAllCachedPagesSpy = sinon.stub().rejects(errObj);

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: getAllCachedPagesSpy
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
  var pages = ['alpha', 2, 'gamma'];
  var metadataObj = { foo: 'bar' };
  var getAllCachedPagesSpy = sinon.stub().resolves(pages);

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: getAllCachedPagesSpy
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  var expected = {
    metadata: metadataObj,
    cachedPages: pages
  };

  api.getResponseForAllCachedPages()
  .then(actual => {
    t.deepEqual(actual, expected);
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
  var page1 = {
    captureDate: '2017-04-03',
    metadata: {
      fullUrl: 'http://www.firstpage.com'
    }
  };
  var page2 = {
    captureDate: '2017-04-04',
    metadata: {
      fullUrl: 'http://www.secondpage.com'
    }
  };
  var pages = [ page1, page2];
  var metadataObj = { foo: 'bar' };
  var getAllCachedPagesSpy = sinon.stub().resolves(pages);

  proxyquireApi({
    '../persistence/datastore': {
      getAllCachedPages: getAllCachedPagesSpy
    }
  });
  api.createMetadatObj = sinon.stub().returns(metadataObj);

  var expected = {
    metadata: metadataObj,
    digest: [
      {
        fullUrl: page1.metadata.fullUrl,
        captureDate: page1.captureDate
      },
      {
        fullUrl: page2.metadata.fullUrl,
        captureDate: page2.captureDate
      }
    ]
  };

  api.getResponseForAllPagesDigest()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
