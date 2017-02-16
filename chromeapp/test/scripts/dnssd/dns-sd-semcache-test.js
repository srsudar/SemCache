'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var dnssd = require('../../../app/scripts/dnssd/dns-sd');
require('sinon-as-promised');

test('registerSemCache calls dnssd.register with correct args', function(t) {
  // This function should just call through to dns-sd.
  var registerMock = sinon.spy();
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      register: registerMock
    }
  });

  var host = 'workstation.local';
  var name = 'Fancy SemCache';
  var port = 1234;

  dnssdSem.registerSemCache(host, name, port);

  // Verify register was called with the correct arguments.
  t.equal(registerMock.firstCall.args[0], host);
  t.equal(registerMock.firstCall.args[1], name);
  t.equal(registerMock.firstCall.args[2], dnssdSem.getSemCacheServiceString());
  t.equal(registerMock.firstCall.args[3], port);

  t.end();
});

test('registerSemCache returns dnssd.register result', function(t) {
  // This function should just call through to dns-sd.
  var returnResult = 'foobar';
  var registerMock = sinon.stub().returns(returnResult);
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      register: registerMock
    }
  });

  var host = 'myhost.local';
  var name = 'my instance name';
  var port = 1111;
  var actualReturn = dnssdSem.registerSemCache(host, name, port);
  t.equal(actualReturn, returnResult);
  t.deepEqual(
    registerMock.args[0],
    [
      host, name, dnssdSem.getSemCacheServiceString(), port
    ]
  );

  t.end();
});

test('browseForSemCacheInstanceNames calls dnssd module', function(t) {
  var expected = ['foo', 'bar'];
  var queryForServiceInstancesSpy = sinon.stub().returns(expected);

  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      queryForServiceInstances: queryForServiceInstancesSpy
    }
  });

  var actual = dnssdSem.browseForSemCacheInstanceNames();

  t.deepEqual(actual, expected);
  t.deepEqual(
    queryForServiceInstancesSpy.args[0],
    [
      dnssdSem.getSemCacheServiceString(),
      dnssd.DEFAULT_QUERY_WAIT_TIME,
      dnssd.DEFAULT_NUM_PTR_RETRIES
    ]
  );
  t.end();
});

test('resolveCache rejects if resolveService rejects', function(t) {
  var expected = { err: 'wrong stuff' };
  var resolveServiceSpy = sinon.stub().rejects(expected);
  var fullName = 'name';

  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      resolveService: resolveServiceSpy
    }
  });

  dnssdSem.resolveCache(fullName)
  .then(res => {
    t.fail(res);
    t.end();
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.end();
  });
});

test('resolveCache adds listUrl and resolves', function(t) {
  var friendlyName = 'Tyrion Cache Money';
  var fullName = friendlyName + '_semcache._tcp.local';
  var domain = 'casterlyrock.local';
  var ipAddress = '5.4.3.2';
  var port = 9999;
  var listUrl = 'url/for/list.json';

  var expected = {
    friendlyName: friendlyName,
    instanceName: fullName,
    domainName: domain,
    ipAddress: ipAddress,
    port: port,
    listUrl: listUrl
  };

  var getListPageUrlForCacheSpy = sinon.stub();
  getListPageUrlForCacheSpy.withArgs(ipAddress, port).returns(listUrl);

  var resolveServiceSpy = sinon.stub().resolves(expected);

  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      resolveService: resolveServiceSpy
    },
    '../server/server-api': {
      getListPageUrlForCache: getListPageUrlForCacheSpy
    }
  });

  dnssdSem.resolveCache(fullName)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(getListPageUrlForCacheSpy.args[0], [ipAddress, port]);
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
  });
});

test('browseForSemCacheInstances calls browse with correct args', function(t) {
  // This function should just call through to dns-sd.
  var browseMock = sinon.spy();
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      browseServiceInstances: browseMock
    }
  });

  dnssdSem.browseForSemCacheInstances();

  // Verify register was called with the correct arguments.
  t.equal(browseMock.firstCall.args[0], dnssdSem.getSemCacheServiceString());

  t.end();
});

test('browseForSemCacheInstances returns dnssd.browse result', function(t) {
  // This function should just call through to dns-sd.
  var returnResult = 'manyinstances';
  var browseMock = sinon.stub().returns(returnResult);
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      browseServiceInstances: browseMock
    }
  });

  var actualReturn = dnssdSem.browseForSemCacheInstances();
  t.equal(actualReturn, returnResult);

  t.end();
});

test('getFullName correct', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-semcache');

  var friendlyName = 'Tyrion\'s Cache';
  var expected = friendlyName + '.' +
    dnssdSem.getSemCacheServiceString() +
    '.local';

  var actual = dnssdSem.getFullName(friendlyName);
  t.equal(actual, expected);
  t.end();
});
