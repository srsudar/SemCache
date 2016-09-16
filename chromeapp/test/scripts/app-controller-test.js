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
function createCacheObj(domainName, instanceName, ipAddress, port, listUrl) {
  var result = {
    domainName: domainName,
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
      start: sinon.stub().resolves()
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

test('startServersAndRegister resolves if register resolves', function(t) {
  var expectedRegisterResult = {foo: 'foo'};
  var registerSemCacheSpy = sinon.stub().resolves(expectedRegisterResult);
  var httpStartSpy = sinon.spy();
  var dnsControllerStartSpy = sinon.stub().resolves();

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
      start: dnsControllerStartSpy
    }
  });
  appc.getServerController = sinon.stub().returns({
    start: httpStartSpy
  });
  appc.updateCachesForSettings = sinon.stub();

  appc.startServersAndRegister()
  .then(actualResult => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.deepEqual(actualResult, expectedRegisterResult);
    t.deepEqual(httpStartSpy.args[0], ['0.0.0.0', port]);
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
  var instanceName = 'My Cache';
  var ipAddress = '4.3.2.1';

  var listUrl = 'list url';
  
  var getInstanceNameSpy = sinon.stub().returns(instanceName);
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
    hostName, instanceName, ipAddress, serverPort, listUrl
  );
  var actual = appc.getOwnCache();

  t.deepEqual(actual, expected);
  t.end();
  resetAppController();
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

  var expected = [ownCache];

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

  appc.stopServers();
  t.true(stopSpy.calledOnce);
  t.deepEqual(stopSpy.args[0], []);

  t.true(stopDnsControllerSpy.calledOnce);
  t.deepEqual(stopDnsControllerSpy.args[0], []);

  t.false(appc.networkIsActive());
  t.end();
  resetAppController();
});
