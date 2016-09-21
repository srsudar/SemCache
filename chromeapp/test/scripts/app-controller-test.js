/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetAppController() {
  delete require.cache[
    require.resolve('../../app/scripts/app-controller')
  ];
}

/**
 * Create an object as is returned by getBrowseableCaches.
 */
function createCacheObj(domainName, friendlyName, ipAddress, port, listUrl) {
  var instanceName = friendlyName + '._semcache._tcp.local';
  var result = {
    domainName: domainName,
    friendlyName: friendlyName,
    instanceName: instanceName,
    ipAddress: ipAddress,
    port: port,
    listUrl: listUrl
  };
  return result;
}

function rejectIfMissingSettingHelper(instanceName, port, dirId, host, t) {
  var appc = proxyquire('../../app/scripts/app-controller', {
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(dirId),
      getHostName: sinon.stub().returns(host)
    }
  });

  appc.startServersAndRegister()
  .catch(err => {
    t.equal(err, 'Complete and save settings before starting');
    t.end();
    resetAppController();
  });
}

/**
 * Create service names as returned by getPeerCacheNames.
 *
 * @param {string} serviceType
 * @param {integer} numCaches the number of caches to create
 *
 * @return {Array<Object>} Array of objects as returned by getPeerCacheNames
 */
function createCacheNames(serviceType, numCaches) {
  var baseName = 'Cache No ';
  var result = [];
  for (var i = 0; i < numCaches; i++) {
    var friendlyName = baseName + i;
    var fullName = friendlyName + '.' + serviceType + '.local';
    var cacheName = {
      serviceType: serviceType,
      serviceName: fullName,
      friendlyName: friendlyName
    };
    result.push(cacheName);
  }
  return result;
}

test('saveMhtmlAndOpen persists and opens', function(t) {
  var fakeEntry = {
    fullPath: 'a full path'
  };
  var addPageStub = sinon.stub().resolves(fakeEntry);
  var sendMessageToOpenSpy = sinon.spy();

  var absPathToBaseDir = '/some/absolute/path/semcachedir';

  var fileUrl = 'file:///some path to the dir';
  var constructFileSchemeUrlSpy = sinon.stub().returns(fileUrl);

  var getNowStub = sinon.stub().returns(1);
  var logTimeStub = sinon.stub();

  // ADD THE ABSOLUTE PATH TO THE BASE DIRECTORY
  var appc = proxyquire(
    '../../app/scripts/app-controller',
    {
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
      }
    }
  );
  
  var blob = 'the fake blob';
  var responseStub = sinon.stub();
  responseStub.blob = sinon.stub().resolves(blob);
  
  var fetchStub = sinon.stub().resolves(responseStub);
  appc.fetch = fetchStub;
  appc.getAbsPathToBaseDir = sinon.stub().returns(absPathToBaseDir);

  var captureUrl = 'the capture url';
  var captureDate = 'the date it was captured';
  var accessPath = 'the url to download the mhtml';
  var mdata = { muchMeta: 'so data' };
  appc.saveMhtmlAndOpen(captureUrl, captureDate, accessPath, mdata)
    .then(() => {
      t.equal(sendMessageToOpenSpy.args[0][0], fileUrl);
      t.deepEqual(
        addPageStub.args[0],
        [captureUrl, captureDate, blob, mdata]
      );
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
  var expectedErr = {message: 'reject in test plz'};
  var registerSemCacheSpy = sinon.stub().rejects(expectedErr);
  var iface = {
    address: '4.4.4.4',
    port: 8888
  };

  var instanceName = 'my instance';
  var port = '1234';
  var baseDirId = 'zyx';
  var hostName = 'laptop.local';

  var appc = proxyquire('../../app/scripts/app-controller', {
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
  .catch(actualErr => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.equal(actualErr, expectedErr);
    t.false(appc.networkIsActive());
    t.end();
    resetAppController();
  });
});

test('startServersAndRegister rejects if no ifaces', function(t) {
  var expectedErr = 'No network interfaces in dns-controller';

  var instanceName = 'my instance';
  var port = '1234';
  var baseDirId = 'zyx';
  var hostName = 'laptop.local';

  var appc = proxyquire('../../app/scripts/app-controller', {
    './settings': {
      getInstanceName: sinon.stub().returns(instanceName),
      getServerPort: sinon.stub().returns(port),
      getBaseDirId: sinon.stub().returns(baseDirId),
      getHostName: sinon.stub().returns(hostName)
    },
    './dnssd/dns-controller': {
      start: sinon.stub().resolves()
    }
  });
  appc.updateCachesForSettings = sinon.stub();

  appc.startServersAndRegister()
  .catch(actualErr => {
    t.equal(actualErr.message, expectedErr);
    t.false(appc.networkIsActive());
    t.end();
    resetAppController();
  });

});

test('startServersAndRegister resolves if register resolves', function(t) {
  var expectedRegisterResult = {foo: 'foo'};
  var instanceName = 'my instance';
  var port = '1234';
  var baseDirId = 'zyx';
  var hostName = 'laptop.local';

  var iface = {
    address: '1.2.3.fromDnsController',
    port: port
  };

  var registerSemCacheSpy = sinon.stub().resolves(expectedRegisterResult);
  var httpStartSpy = sinon.spy();
  var dnsControllerStartSpy = sinon.stub().resolves();
  var getIPv4InterfacesSpy = sinon.stub().returns([iface]);
  var updateCachesForSettingsSpy = sinon.stub();

  var appc = proxyquire('../../app/scripts/app-controller', {
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
    }
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
    
    t.true(updateCachesForSettingsSpy.calledOnce);
    t.true(dnsControllerStartSpy.calledOnce);
    t.true(appc.networkIsActive());
    
    t.end();
    resetAppController();
  });

});

test('getListUrlForSelf is sensible', function(t) {
  var iface = {
    address: '123.4.5.67',
    port: 7161
  };
  
  var appc = require('../../app/scripts/app-controller');
  appc.getListeningHttpInterface = sinon.stub().returns(iface);

  var expected = 'http://123.4.5.67:7161/list_pages';
  var actual = appc.getListUrlForSelf();
  t.equal(actual, expected);
  t.end();
  resetAppController();
});

test('getOwnCache returns correct info', function(t) {
  var hostName = 'myself.local';
  var serverPort = 4444;
  var friendlyName = 'My Cache';
  var ipAddress = '4.3.2.1';

  var listUrl = 'list url';
  
  var getInstanceNameSpy = sinon.stub().returns(friendlyName);
  var getServerPortSpy = sinon.stub().returns(serverPort);
  var getHostNameSpy = sinon.stub().returns(hostName);
  var getHttpIfaceSpy = sinon.stub().returns({ address: ipAddress });
  var getListUrlSpy = sinon.stub().returns(listUrl);

  var appc = proxyquire('../../app/scripts/app-controller', {
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

  var expected = createCacheObj(
    hostName, friendlyName, ipAddress, serverPort, listUrl
  );
  var actual = appc.getOwnCache();

  t.deepEqual(actual, expected);
  t.end();
  resetAppController();
});

test('getOwnCacheName correct', function(t) {
  var friendlyName = 'Sam Cache';
  var fullName = 'Sam Cache._semcache._tcp.local';
  var serviceType = '_semcache._tcp';

  var expected = {
    serviceType: serviceType,
    friendlyName: friendlyName,
    serviceName: fullName
  };

  var getInstanceNameSpy = sinon.stub().returns(friendlyName);
  var appc = proxyquire('../../app/scripts/app-controller', {
    './settings': {
      getInstanceName: getInstanceNameSpy,
    }
  });

  var actual = appc.getOwnCacheName();
  t.deepEqual(expected, actual);
  t.end();
});

test('getPeerCacheNames does not query network if not started', function(t) {
  var appc = require('../../app/scripts/app-controller');
  appc.SERVERS_STARTED = false;
  var expected = [];

  appc.getPeerCacheNames()
    .then(actual => {
      t.deepEqual(actual, expected); 
      t.end();
      resetAppController();
    });
});

test('getPeerCacheNames does not query network if no network', function(t) {
  var cacheName = { friendlyName: 'my name' };
  var getOwnCacheNameSpy = sinon.stub().returns(cacheName);

  var appc = require('../../app/scripts/app-controller');
  appc.SERVERS_STARTED = true;
  appc.getOwnCacheName = getOwnCacheNameSpy;
  appc.networkIsActive = sinon.stub().returns(false);

  var expected = [cacheName];

  appc.getPeerCacheNames()
    .then(actual => {
      t.deepEqual(actual, expected); 
      t.end();
      resetAppController();
    });
});

test('getPeerCacheNames resolves if running', function(t) {
  var serviceType = '_semcache._tcp';
  var cacheNames = createCacheNames(serviceType, 6);

  var self = cacheNames[0];
  // We want to find all the other caches, in reverse order, with ourselves
  // included.
  var foundCaches = cacheNames.slice(0);
  foundCaches.reverse();

  var browseForSemCacheInstanceNamesSpy = sinon.stub().resolves(foundCaches);
  var getOwnCacheNameSpy = sinon.stub().returns(self);
  var networkIsActiveSpy = sinon.stub().returns(true);

  var appc = proxyquire('../../app/scripts/app-controller', {
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
    });
});

test('getBrowseableCaches does not query network if not started', function(t) {
  var hostName = 'myself.local';
  var serverPort = 4444;
  var instanceName = 'my cache';
  var ipAddress = '4.3.2.1';
  var listUrl = 'list url';

  var ownCache = createCacheObj(
    hostName, instanceName, ipAddress, serverPort, listUrl
  );
  var browseSpy = sinon.spy();

  var appc = proxyquire('../../app/scripts/app-controller', {
    './dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseSpy
    }
  });
  appc.getOwnCache = sinon.stub().returns(ownCache);
  appc.networkIsActive = sinon.stub().returns(false);

  var expected = [];

  appc.getBrowseableCaches()
    .then(caches => {
      t.deepEqual(caches, expected);
      t.equal(browseSpy.callCount, 0);
      t.end();
      resetAppController();
    });
});

test('getBrowseableCaches dedupes and returns correct list', function(t) {
  var hostName = 'myself.local';
  var serverPort = 4444;
  var instanceName = 'my cache';
  var ipAddress = '4.3.2.1';

  var listUrl = 'list url';

  var ownCache = createCacheObj(
    hostName, instanceName, ipAddress, serverPort, listUrl
  );
  var firstCache = createCacheObj(
    'someone.local', 'aaa cache', '5.5.5.5', 1234, listUrl
  );
  var lastCache = createCacheObj(
    'elseone.local', 'zzz cache', '8.8.8.8', 9999, listUrl
  );

  // Order such that we have to sort them and most ourself to the front.
  var foundCaches = [lastCache, ownCache, firstCache];
  
  var getHttpIfaceSpy = sinon.stub().returns({ address: ipAddress });
  var getListUrlSpy = sinon.stub().returns(listUrl);
  var browseSpy = sinon.stub().resolves(foundCaches);

  var getOwnCacheSpy = sinon.stub().returns(ownCache);

  var appc = proxyquire('../../app/scripts/app-controller', {
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
  var expected = [ownCache, firstCache, lastCache];
  appc.getBrowseableCaches()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.true(getListUrlSpy.calledWith(firstCache.ipAddress, firstCache.port));
      t.true(getListUrlSpy.calledWith(lastCache.ipAddress, lastCache.port));
      t.end();
      resetAppController();
    });
});

test('networkIsActive true if started', function(t) {
  var appc = require('../../app/scripts/app-controller');
  appc.SERVERS_STARTED = true;
  t.true(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('networkIsActive false if not started', function(t) {
  var appc = require('../../app/scripts/app-controller');
  appc.SERVERS_STARTED = false;
  t.false(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('stopServers restores state', function(t) {
  var stopSpy = sinon.spy();
  var stopDnsControllerSpy = sinon.spy();

  var appc = proxyquire('../../app/scripts/app-controller', {
    './dnssd/dns-controller': {
      stop: stopDnsControllerSpy
    }
  });
  appc.getServerController = sinon.stub().returns({
    stop: stopSpy
  });
  appc.LISTENING_HTTP_INTERFACE = 'old iface';

  appc.stopServers();
  t.true(stopSpy.calledOnce);
  t.deepEqual(stopSpy.args[0], []);

  t.equal(appc.LISTENING_HTTP_INTERFACE, null);

  t.true(stopDnsControllerSpy.calledOnce);
  t.deepEqual(stopDnsControllerSpy.args[0], []);

  t.false(appc.networkIsActive());
  t.end();
  resetAppController();
});

test('resolveCache does not use network for self', function(t) {
  var friendlyName = 'friendly name';
  var ownCache = createCacheObj(
    'me.local', friendlyName, '1.2.3.4', 7777, 'http://me.local:7777/list'
  );
  var fullName = ownCache.instanceName;

  var resolveCacheSpy = sinon.stub().resolves();
  var getOwnCacheSpy = sinon.stub().returns(ownCache);

  var appc = proxyquire('../../app/scripts/app-controller', {
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
    });
});

test('resolveCache queries network if needed and resolves', function(t) {
  var ownCache = createCacheObj(
    'me.local', 'own cache', '1.2.3.4', 7777, 'http://me.local:7777/list'
  );

  var friendlyName = 'friendly name';
  var expected = createCacheObj(
    'expected.local', friendlyName, '123.456.789.0', 9999, 'http://list.json'
  );
  var fullName = expected.instanceName;

  var resolveCacheSpy = sinon.stub().withArgs(fullName).resolves(expected);
  var getOwnCacheSpy = sinon.stub().returns(ownCache);

  var appc = proxyquire('../../app/scripts/app-controller', {
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
    });
});

test('resolveCache rejects if query fails', function(t) {
  var ownCache = createCacheObj(
    'me.local', 'own cache', '1.2.3.4', 7777, 'http://me.local:7777/list'
  );
  var fullName = 'missingRecords';
  var expected = { msg: 'something went wrong '};

  var resolveCacheSpy = sinon.stub().withArgs(fullName).rejects(expected);
  var getOwnCacheSpy = sinon.stub().returns(ownCache);

  var appc = proxyquire('../../app/scripts/app-controller', {
    './dnssd/dns-sd-semcache': {
      resolveCache: resolveCacheSpy
    },
  });
  appc.getOwnCache = getOwnCacheSpy;

  appc.resolveCache(fullName)
    .catch(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetAppController();
    });
});
