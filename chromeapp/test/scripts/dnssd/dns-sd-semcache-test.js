'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

const dnssd = require('../../../app/scripts/dnssd/dns-sd');

test('registerSemCache calls dnssd.register with correct args', function(t) {
  // This function should just call through to dns-sd.
  let registerMock = sinon.spy();
  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      register: registerMock
    }
  });

  let host = 'workstation.local';
  let name = 'Fancy SemCache';
  let port = 1234;

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
  let returnResult = 'foobar';
  let registerMock = sinon.stub().returns(returnResult);
  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      register: registerMock
    }
  });

  let host = 'myhost.local';
  let name = 'my instance name';
  let port = 1111;
  let actualReturn = dnssdSem.registerSemCache(host, name, port);
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
  let expected = ['foo', 'bar'];
  let queryForServiceInstancesSpy = sinon.stub().returns(expected);

  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      queryForServiceInstances: queryForServiceInstancesSpy
    }
  });

  let actual = dnssdSem.browseForSemCacheInstanceNames();

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
  let expected = { err: 'wrong stuff' };
  let resolveServiceSpy = sinon.stub().rejects(expected);
  let fullName = 'name';

  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
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
  let friendlyName = 'Tyrion Cache Money';
  let fullName = friendlyName + '_semcache._tcp.local';
  let domain = 'casterlyrock.local';
  let ipAddress = '5.4.3.2';
  let port = 9999;
  let listUrl = 'url/for/list.json';

  let expected = {
    friendlyName: friendlyName,
    instanceName: fullName,
    domainName: domain,
    ipAddress: ipAddress,
    port: port,
    listUrl: listUrl
  };

  let getListPageUrlForCacheSpy = sinon.stub();
  getListPageUrlForCacheSpy.withArgs(ipAddress, port).returns(listUrl);

  let resolveServiceSpy = sinon.stub().resolves(expected);

  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
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
  let browseMock = sinon.spy();
  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
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
  let returnResult = 'manyinstances';
  let browseMock = sinon.stub().returns(returnResult);
  let dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {
      browseServiceInstances: browseMock
    }
  });

  let actualReturn = dnssdSem.browseForSemCacheInstances();
  t.equal(actualReturn, returnResult);

  t.end();
});

test('getFullName correct', function(t) {
  let dnssdSem = require('../../../app/scripts/dnssd/dns-sd-semcache');

  let friendlyName = 'Tyrion\'s Cache';
  let expected = friendlyName + '.' +
    dnssdSem.getSemCacheServiceString() +
    '.local';

  let actual = dnssdSem.getFullName(friendlyName);
  t.equal(actual, expected);
  t.end();
});
