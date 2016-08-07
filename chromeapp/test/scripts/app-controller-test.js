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
  appc.saveMhtmlAndOpen(captureUrl, captureDate, accessPath)
    .then(() => {
      t.equal(sendMessageToOpenSpy.args[0][0], fileUrl);
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
  var expectedErr = {msg: 'reject in test plz'};
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
    }
  });

  appc.startServersAndRegister()
  .catch(actualErr => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.equal(actualErr, expectedErr);
    t.end();
    resetAppController();
  });

});

test('startServersAndRegister resolves if register resolves', function(t) {
  var expectedRegisterResult = {foo: 'foo'};
  var registerSemCacheSpy = sinon.stub().resolves(expectedRegisterResult);

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
    }
  });

  appc.startServersAndRegister()
  .then(actualResult => {
    t.deepEqual(registerSemCacheSpy.args[0], [hostName, instanceName, port]);
    t.deepEqual(actualResult, expectedRegisterResult);
    t.end();
    resetAppController();
  });

});
