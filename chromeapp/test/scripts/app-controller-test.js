/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const constants = require('../../app/scripts/constants');
const putil = require('./persistence/persistence-util');
const tutil = require('./test-util');

let appc = require('../../app/scripts/app-controller');


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetAppController() {
  delete require.cache[
    require.resolve('../../app/scripts/app-controller')
  ];
  appc = require('../../app/scripts/app-controller');
}

function proxyquireAppc(proxies) {
  appc = proxyquire('../../app/scripts/app-controller', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  resetAppController();
}

function rejectIfMissingSettingHelper(instanceName, port, dirId, host, t) {
  proxyquireAppc({
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(dirId),
      getHostName: sinon.stub().returns(host)
    }
  });

  appc.startServersAndRegister()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.equal(err, 'Complete and save settings before starting');
    t.end();
    resetAppController();
  });
}

test('saveMhtmlAndOpen persists and opens', function(t) {
  let cacheInfo = tutil.genCacheInfos(1).next().value;
  let serviceName = cacheInfo.instanceName;
  let cpdisk = putil.genCPDisks(1).next().value;
  let href = cpdisk.captureHref;

  let entry = { fullPath: 'some/path' };
  let absPathToBaseDir = '/some/absolute/path/semcachedir';
  let fileUrl = 'file:///some path to the dir';

  let resolveCacheStub = sinon.stub();
  resolveCacheStub.withArgs(serviceName).resolves(cacheInfo);

  let getPeerAccessorStub = sinon.stub();
  let peerAccessorStub = sinon.stub();
  getPeerAccessorStub
    .withArgs(cacheInfo.ipAddress, cacheInfo.port)
    .returns(peerAccessorStub);
  let getCachedPageStub = sinon.stub();
  getCachedPageStub.withArgs(href).resolves(cpdisk);
  peerAccessorStub.getCachedPage = getCachedPageStub;

  let addPageStub = sinon.stub();
  addPageStub.withArgs(cpdisk).resolves(entry);

  let sendMessageToOpenSpy = sinon.spy();

  let constructFileSchemeUrlSpy = sinon.stub();
  constructFileSchemeUrlSpy
    .withArgs(absPathToBaseDir, entry.fullPath)
    .returns(fileUrl);

  let getNowStub = sinon.stub().returns(1);
  let logTimeStub = sinon.stub();

  proxyquireAppc({
      './persistence/datastore': {
        addPageToCache: addPageStub
      },
      './extension-bridge/messaging': {
        sendMessageToOpenUrl: sendMessageToOpenSpy
      },
      './persistence/file-system': {
        constructFileSchemeUrl: constructFileSchemeUrlSpy
      },
      './evaluation': {
        getNow: getNowStub,
        logTime: logTimeStub
      },
      './peer-interface/manager': {
        getPeerAccessor: getPeerAccessorStub
      }
    }
  );
  appc.getAbsPathToBaseDir = sinon.stub().returns(absPathToBaseDir);
  appc.resolveCache = resolveCacheStub;

  appc.saveMhtmlAndOpen(serviceName, href)
  .then(() => {
    t.equal(sendMessageToOpenSpy.args[0][0], fileUrl);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('saveMhtmlAndOpen rejects if error', function(t) {
  let expected = { error: 'went south' };

  proxyquireAppc({
    './evaluation': {
      getNow: sinon.stub().throws(expected)
    }
  });

  appc.saveMhtmlAndOpen('hi', 'bye')
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  });
});

test('getListFromService resolves with json', function(t) {
  let offset = 15;
  let limit = 10;
  let cacheInfo = tutil.genCacheInfos(1).next().value;
  let expected = { cachedPages: ['page1', 'page2'] };
  let serviceName = cacheInfo.instanceName;

  let peerAccessorStub = sinon.stub();

  let getListStub = sinon.stub();
  getListStub.withArgs(offset, limit).resolves(expected);
  peerAccessorStub.getList = getListStub;

  let resolveCacheStub = sinon.stub();
  resolveCacheStub
    .withArgs(serviceName)
    .resolves(cacheInfo);

  let getPeerStub = sinon.stub();
  getPeerStub
    .withArgs(cacheInfo.ipAddress, cacheInfo.port)
    .returns(peerAccessorStub);

  proxyquireAppc({
    './peer-interface/manager': {
      getPeerAccessor: getPeerStub
    }
  });

  appc.resolveCache = resolveCacheStub;

  appc.getListFromService(serviceName, offset, limit)
  .then(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getListFromService rejects with error', function(t) {
  let serviceName = 'hello.semcache.local';
  let expected = { error: 'getPeerAccessor failed' };

  appc.resolveCache = sinon.stub().rejects(expected);

  appc.getListFromService(serviceName)
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  });
});

test('startServersAndRegisters rejects if missing instance name', function(t) {
  rejectIfMissingSettingHelper(undefined, 1234, 'abc', 'host', t);
});

test('startServersAndRegisters rejects if missing port', function(t) {
  rejectIfMissingSettingHelper('instance', undefined, 'abc', 'host', t);
});

test('startServersAndRegisters rejects if missing dir id', function(t) {
  rejectIfMissingSettingHelper('instance', 1234, undefined, 'host', t);
});

test('startServersAndRegisters rejects if missing host', function(t) {
  rejectIfMissingSettingHelper('instance', 1234, 'abc', undefined, t);
});

test('startServersAndRegister rejects if register rejects', function(t) {
  let expectedErr = {message: 'reject in test plz'};
  let registerSemCacheSpy = sinon.stub().rejects(expectedErr);
  let iface = {
    address: '4.4.4.4',
    port: 8888
  };

  let instanceName = 'my instance';
  let port = '1234';
  let baseDirId = 'zyx';
  let hostName = 'laptop.local';

  proxyquireAppc({
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(baseDirId),
      getHostName: sinon.stub().returns(hostName)
    },
    './dnssd/dns-sd-semcache': {
      registerSemCache: registerSemCacheSpy
    },
    './dnssd/dns-controller': {
      start: sinon.stub().resolves(),
      getIPv4Interfaces: sinon.stub().returns([iface])
    }
  });
  appc.getServerController = sinon.stub().returns({
    start: sinon.stub()
  });
  appc.updateCachesForSettings = sinon.stub();

  appc.startServersAndRegister()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actualErr => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.equal(actualErr, expectedErr);
    t.false(appc.networkIsActive());
    t.end();
    resetAppController();
  });
});

test('startServersAndRegister rejects if no ifaces', function(t) {
  let expectedErr = 'No network interfaces in dns-controller';

  let instanceName = 'my instance';
  let port = '1234';
  let baseDirId = 'zyx';
  let hostName = 'laptop.local';

  proxyquireAppc({
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(baseDirId),
      getHostName: sinon.stub().returns(hostName)
    },
    './dnssd/dns-controller': {
      start: sinon.stub().resolves(),
      getIPv4Interfaces: sinon.stub().returns([])
    }
  });
  appc.updateCachesForSettings = sinon.stub();

  appc.startServersAndRegister()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actualErr => {
    t.equal(actualErr.message, expectedErr);
    t.false(appc.networkIsActive());
    t.end();
    resetAppController();
  });

});

test('startServersAndRegister resolves if register resolves', function(t) {
  let expectedRegisterResult = {foo: 'foo'};
  let instanceName = 'my instance';
  let port = '1234';
  let baseDirId = 'zyx';
  let hostName = 'laptop.local';

  let iface = {
    address: '1.2.3.fromDnsController',
    port: port
  };

  let registerSemCacheSpy = sinon.stub().resolves(expectedRegisterResult);
  let httpStartSpy = sinon.spy();
  let dnsControllerStartSpy = sinon.stub().resolves();
  let getIPv4InterfacesSpy = sinon.stub().returns([iface]);
  let updateCachesForSettingsSpy = sinon.stub();
  let coalMgrInitStub = sinon.stub();

  proxyquireAppc({
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(baseDirId),
      getHostName: sinon.stub().returns(hostName)
    },
    './dnssd/dns-sd-semcache': {
      registerSemCache: registerSemCacheSpy
    },
    './dnssd/dns-controller': {
      start: dnsControllerStartSpy,
      getIPv4Interfaces: getIPv4InterfacesSpy
    },
    './coalescence/manager': {
      initialize: coalMgrInitStub
    },
  });
  appc.getServerController = sinon.stub().returns({
    start: httpStartSpy
  });
  appc.updateCachesForSettings = updateCachesForSettingsSpy;

  // Set the listening interface to a value we don't want, like the stale value
  // that occurs after changing networks.
  appc.LISTENING_HTTP_INTERFACE = {
    address: '9.8.7.staleInterface',
    port: 'oldport'
  };

  appc.startServersAndRegister()
  .then(actualResult => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.deepEqual(actualResult, expectedRegisterResult);
    t.deepEqual(httpStartSpy.args[0], ['0.0.0.0', port]);
    t.deepEqual(appc.LISTENING_HTTP_INTERFACE, iface);
    
    t.true(coalMgrInitStub.calledOnce);
    t.true(updateCachesForSettingsSpy.calledOnce);
    t.true(dnsControllerStartSpy.calledOnce);
    t.true(appc.networkIsActive());
    
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getOwnCache returns correct info', function(t) {
  let listUrl = 'list url';
  let expected = tutil.genCacheInfos(1).next().value;
  expected.listUrl = listUrl;
  
  let getInstanceNameSpy = sinon.stub().returns(expected.friendlyName);
  let getServerPortSpy = sinon.stub().returns(expected.port);
  let getHostNameSpy = sinon.stub().returns(expected.domainName);
  let getHttpIfaceSpy = sinon.stub().returns({ address: expected.ipAddress });
  let getListUrlSpy = sinon.stub().returns(expected.listUrl);

  proxyquireAppc({
    './settings': {
      getInstanceName: getInstanceNameSpy,
      getServerPort: getServerPortSpy,
      getHostName: getHostNameSpy
    },
    './server/server-api': {
      getListPageUrlForCache: getListUrlSpy
    }
  });
  appc.getListeningHttpInterface = getHttpIfaceSpy;
  let actual = appc.getOwnCache();

  t.deepEqual(actual, expected);
  t.end();
  resetAppController();
});

test('getOwnCacheName correct', function(t) {
  let friendlyName = 'Sam Cache';
  let fullName = 'Sam Cache._semcache._tcp.local';
  let serviceType = '_semcache._tcp';

  let expected = {
    serviceType: serviceType,
    friendlyName: friendlyName,
    serviceName: fullName
  };

  let getInstanceNameSpy = sinon.stub().returns(friendlyName);
  proxyquireAppc({
    './settings': {
      getInstanceName: getInstanceNameSpy,
    }
  });

  let actual = appc.getOwnCacheName();
  t.deepEqual(expected, actual);
  t.end();
});

test('getPeerCacheNames does not query network if not started', function(t) {
  appc.SERVERS_STARTED = false;
  let expected = [];

  appc.getPeerCacheNames()
  .then(actual => {
    t.deepEqual(actual, expected); 
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getPeerCacheNames does not query network if no network', function(t) {
  let cacheName = { friendlyName: 'my name' };
  let getOwnCacheNameSpy = sinon.stub().returns(cacheName);

  appc.SERVERS_STARTED = true;
  appc.getOwnCacheName = getOwnCacheNameSpy;
  appc.networkIsActive = sinon.stub().returns(false);

  let expected = [cacheName];

  appc.getPeerCacheNames()
  .then(actual => {
    t.deepEqual(actual, expected); 
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getPeerCacheNames resolves if running', function(t) {
  let serviceType = '_semcache._tcp';
  let cacheNames = tutil.createCacheNames(serviceType, 6);

  let self = cacheNames[0];
  // We want to find all the other caches, in reverse order, with ourselves
  // included.
  let foundCaches = cacheNames.slice(0);
  foundCaches.reverse();

  let browseForSemCacheInstanceNamesSpy = sinon.stub().resolves(foundCaches);
  let getOwnCacheNameSpy = sinon.stub().returns(self);
  let networkIsActiveSpy = sinon.stub().returns(true);

  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstanceNames: browseForSemCacheInstanceNamesSpy
    }
  });
  appc.getOwnCacheName = getOwnCacheNameSpy;
  appc.networkIsActive = networkIsActiveSpy;
  appc.SERVERS_STARTED = true;

  appc.getPeerCacheNames()
  .then(actual => {
    t.deepEqual(actual, cacheNames);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getPeerCacheNames rejects if error', function(t) {
  let expected = { error: 'uhoh' };
  let browseForSemCacheInstanceNamesSpy = sinon.stub().rejects(expected);
  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstanceNames: browseForSemCacheInstanceNamesSpy
    }
  });
  appc.networkIsActive = sinon.stub().returns(true);
  appc.SERVERS_STARTED = true;

  appc.getPeerCacheNames()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  });
});

test('getBrowseableCaches does not query network if not started', function(t) {
  let hostName = 'myself.local';
  let serverPort = 4444;
  let instanceName = 'my cache';
  let ipAddress = '4.3.2.1';
  let listUrl = 'list url';

  let ownCache = tutil.createCacheObj(
    hostName, instanceName, ipAddress, serverPort, listUrl
  );
  let browseSpy = sinon.spy();

  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseSpy
    }
  });
  appc.getOwnCache = sinon.stub().returns(ownCache);
  appc.networkIsActive = sinon.stub().returns(false);

  let expected = [];

  appc.getBrowseableCaches()
  .then(caches => {
    t.deepEqual(caches, expected);
    t.equal(browseSpy.callCount, 0);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getBrowseableCaches dedupes and returns correct list', function(t) {
  let hostName = 'myself.local';
  let serverPort = 4444;
  let instanceName = 'my cache';
  let ipAddress = '4.3.2.1';

  let listUrl = 'list url';

  let ownCache = tutil.createCacheObj(
    hostName, instanceName, ipAddress, serverPort, listUrl
  );
  let firstCache = tutil.createCacheObj(
    'someone.local', 'aaa cache', '5.5.5.5', 1234, listUrl
  );
  let lastCache = tutil.createCacheObj(
    'elseone.local', 'zzz cache', '8.8.8.8', 9999, listUrl
  );

  // Order such that we have to sort them and most ourself to the front.
  let foundCaches = [lastCache, ownCache, firstCache];
  
  let getHttpIfaceSpy = sinon.stub().returns({ address: ipAddress });
  let getListUrlSpy = sinon.stub().returns(listUrl);
  let browseSpy = sinon.stub().resolves(foundCaches);

  let getOwnCacheSpy = sinon.stub().returns(ownCache);

  proxyquireAppc({
    './server/server-api': {
      getListPageUrlForCache: getListUrlSpy
    },
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseSpy
    }
  });
  appc.getListeningHttpInterface = getHttpIfaceSpy;
  appc.getOwnCache = getOwnCacheSpy;
  appc.networkIsActive = sinon.stub().returns(true);
  appc.SERVERS_STARTED = true;

  // We should always be first, followed by the other caches sorted by instance
  // name.
  let expected = [ownCache, firstCache, lastCache];
  appc.getBrowseableCaches()
  .then(actual => {
    t.deepEqual(actual, expected);
    t.true(getListUrlSpy.calledWith(firstCache.ipAddress, firstCache.port));
    t.true(getListUrlSpy.calledWith(lastCache.ipAddress, lastCache.port));
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('getBrowseableCaches rejects if error', function(t) {
  let expected = { error: 'uh oh' };
  let browseForSemCacheInstancesSpy = sinon.stub().rejects(expected);
  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseForSemCacheInstancesSpy
    }
  });
  appc.networkIsActive = sinon.stub().returns(true);
  appc.SERVERS_STARTED = true;
  appc.getOwnCache = sinon.stub();
  appc.getListeningHttpInterface = sinon.stub().returns({ address: '' });

  appc.getBrowseableCaches()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  });
});

test('networkIsActive true if started', function(t) {
  appc.SERVERS_STARTED = true;
  t.true(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('networkIsActive false if not started', function(t) {
  appc.SERVERS_STARTED = false;
  t.false(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('stopServers restores state', function(t) {
  let stopSpy = sinon.spy();
  let stopDnsControllerSpy = sinon.spy();
  let resetCoalStub = sinon.stub();
  let resetCxnMgrStub = sinon.stub();

  proxyquireAppc({
    './dnssd/dns-controller': {
      stop: stopDnsControllerSpy
    },
    './coalescence/manager': {
      reset: resetCoalStub
    },
    './webrtc/connection-manager': {
      reset: resetCxnMgrStub
    }
  });
  appc.getServerController = sinon.stub().returns({
    stop: stopSpy
  });
  appc.LISTENING_HTTP_INTERFACE = 'old iface';

  appc.stopServers();
  t.true(stopSpy.calledOnce);
  t.deepEqual(stopSpy.args[0], []);

  t.true(resetCoalStub.calledOnce);
  t.true(resetCxnMgrStub.calledOnce);

  t.equal(appc.LISTENING_HTTP_INTERFACE, null);

  t.true(stopDnsControllerSpy.calledOnce);
  t.deepEqual(stopDnsControllerSpy.args[0], []);

  t.false(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('resolveCache respects SELF_SERVICE_SHORTCUT', function(t) {
  let expected = tutil.genCacheInfos(1).next().value;

  appc.getOwnCache = sinon.stub().returns(expected);

  appc.resolveCache(constants.SELF_SERVICE_SHORTCUT)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('resolveCache does not use network for self', function(t) {
  let friendlyName = 'friendly name';
  let ownCache = tutil.createCacheObj(
    'me.local', friendlyName, '1.2.3.4', 7777, 'http://me.local:7777/list'
  );
  let fullName = ownCache.instanceName;

  let resolveCacheSpy = sinon.stub().resolves();
  let getOwnCacheSpy = sinon.stub().returns(ownCache);

  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      resolveCache: resolveCacheSpy
    },
  });
  appc.getOwnCache = getOwnCacheSpy;

  appc.resolveCache(fullName)
  .then(actual => {
    t.deepEqual(actual, ownCache);
    t.equal(resolveCacheSpy.callCount, 0);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('resolveCache queries network if needed and resolves', function(t) {
  let ownCache = tutil.createCacheObj(
    'me.local', 'own cache', '1.2.3.4', 7777, 'http://me.local:7777/list'
  );

  let friendlyName = 'friendly name';
  let expected = tutil.createCacheObj(
    'expected.local', friendlyName, '123.456.789.0', 9999, 'http://list.json'
  );
  let fullName = expected.instanceName;

  let resolveCacheSpy = sinon.stub();
  resolveCacheSpy.withArgs(fullName).resolves(expected);

  let getOwnCacheSpy = sinon.stub().returns(ownCache);

  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      resolveCache: resolveCacheSpy
    },
  });
  appc.getOwnCache = getOwnCacheSpy;

  appc.resolveCache(fullName)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetAppController();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetAppController();
  });
});

test('resolveCache rejects if query fails', function(t) {
  let ownCache = tutil.createCacheObj(
    'me.local', 'own cache', '1.2.3.4', 7777, 'http://me.local:7777/list'
  );
  let fullName = 'missingRecords';
  let expected = { msg: 'something went wrong '};

  let resolveCacheSpy = sinon.stub();
  resolveCacheSpy.withArgs(fullName).rejects(expected);

  let getOwnCacheSpy = sinon.stub().returns(ownCache);

  proxyquireAppc({
    './dnssd/dns-sd-semcache': {
      resolveCache: resolveCacheSpy
    },
  });
  appc.getOwnCache = getOwnCacheSpy;

  appc.resolveCache(fullName)
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetAppController();
  });
});

test('start rejects if error', function(t) {
  let expected = { error: 'setting trouble' };
  proxyquireAppc({
    './settings': {
      init: sinon.stub().rejects(expected)
    },
    './extension-bridge/messaging': {
      attachListeners: sinon.stub()
    }
  });

  appc.start()
  .then(res => {
    t.fail(res);
    t.end();
    resetAppController();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetAppController();
  });
});
