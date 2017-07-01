'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const dnssd = require('../../../app/scripts/dnssd/dns-sd');
const tutil = require('../test-util');

let dnssdSem = require('../../../app/scripts/dnssd/dns-sd-semcache');


function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-sd-semcache')
  ];
  dnssdSem = require('../../../app/scripts/dnssd/dns-sd-semcache');
}

function proxyquireDnssdSem(proxies) {
  dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd-semcache', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}


test('registerSemCache calls dnssd.register with correct args', function(t) {
  // This function should just call through to dns-sd.
  let registerMock = sinon.spy();
  proxyquireDnssdSem({
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

  end(t);
});

test('registerSemCache returns dnssd.register result', function(t) {
  // This function should just call through to dns-sd.
  let returnResult = 'foobar';
  let registerMock = sinon.stub().returns(returnResult);
  proxyquireDnssdSem({
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

  end(t);
});

test('browseForSemCacheInstanceNames calls dnssd module', function(t) {
  let expected = ['foo', 'bar'];
  let queryForServiceInstancesSpy = sinon.stub().returns(expected);

  proxyquireDnssdSem({
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
  end(t);
});

test('resolveCache rejects if resolveService rejects', function(t) {
  let expected = { err: 'wrong stuff' };
  let resolveServiceSpy = sinon.stub().rejects(expected);
  let fullName = 'name';

  proxyquireDnssdSem({
    './dns-sd': {
      resolveService: resolveServiceSpy
    }
  });

  dnssdSem.resolveCache(fullName)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
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

  proxyquireDnssdSem({
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
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('browseForSemCacheInstances resolves filtered instances', function(t) {
  // This function should just call through to dns-sd.
  let browseResult = [...tutil.genCacheInfos(3)];
  let browseMock = sinon.stub();
  browseMock
    .withArgs(dnssdSem.getSemCacheServiceString())
    .resolves(browseResult);
  
  let expected = browseResult.slice(1);
  let removeOwnStub = sinon.stub();
  removeOwnStub.withArgs(browseResult).resolves(expected);

  proxyquireDnssdSem({
    './dns-sd': {
      browseServiceInstances: browseMock
    }
  });
  dnssdSem.removeOwnInfo = removeOwnStub;

  dnssdSem.browseForSemCacheInstances(true)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('browseServiceInstances resolves unfiltered instances', function(t) {
  let browseResult = [...tutil.genCacheInfos(5)];
  let expected = browseResult;
  let browseMock = sinon.stub();
  browseMock
    .withArgs(dnssdSem.getSemCacheServiceString())
    .resolves(browseResult);
  
  let removeOwnStub = sinon.stub();

  proxyquireDnssdSem({
    './dns-sd': {
      browseServiceInstances: browseMock
    }
  });
  dnssdSem.removeOwnInfo = removeOwnStub;

  dnssdSem.browseForSemCacheInstances(false)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.equal(removeOwnStub.callCount, 0);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('browseForSemCacheInstances rejects', function(t) {
  let expected = { err: 'uh oh' };

  proxyquireDnssdSem({
    './dns-sd': {
      browseServiceInstances: sinon.stub().rejects(expected)
    }
  });

  dnssdSem.browseForSemCacheInstances()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getFullName correct', function(t) {
  let dnssdSem = require('../../../app/scripts/dnssd/dns-sd-semcache');

  let friendlyName = 'Tyrion\'s Cache';
  let expected = friendlyName + '.' +
    dnssdSem.getSemCacheServiceString() +
    '.local';

  let actual = dnssdSem.getFullName(friendlyName);
  t.equal(actual, expected);
  end(t);
});

test('removeOwnInfo does nothing if not present', function(t) {
  proxyquireDnssdSem({
    '../settings': {
      init: sinon.stub().resolves(),
      getHostName: sinon.stub().returns('not in there')
    }
  });

  let peerInfos = [...tutil.genCacheInfos(3)];
  let expected = peerInfos;

  dnssdSem.removeOwnInfo(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('removeOwnInfo removes our own information', function(t) {
  let peerInfos = [...tutil.genCacheInfos(5)];
  let ourInfo = peerInfos[0];
  let expected = peerInfos.slice(1);

  proxyquireDnssdSem({
    '../settings': {
      init: sinon.stub().resolves(),
      getHostName: sinon.stub().returns(ourInfo.domainName)
    }
  });

  dnssdSem.removeOwnInfo(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('removeOwnInfo rejects on error', function(t) {
  let expected = { msg: 'trubs' };
  let peerInfos = [...tutil.genCacheInfos(1)];

  proxyquireDnssdSem({
    '../settings': {
      init: sinon.stub().rejects(expected)
    }
  });

  dnssdSem.removeOwnInfo(peerInfos)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
