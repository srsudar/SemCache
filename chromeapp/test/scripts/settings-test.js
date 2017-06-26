/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

let settings = require('../../app/scripts/settings');


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetSettings() {
  delete require.cache[
    require.resolve('../../app/scripts/settings')
  ];
  settings = require('../../app/scripts/settings');
}

function proxyquireSettings(proxies, localStorageProxies, chromefsProxies) {
  proxies['./chrome-apis/chromep'] = {
    getStorageLocal: sinon.stub().returns(localStorageProxies),
    getFileSystem: sinon.stub().returns(chromefsProxies)
  };
  settings = proxyquire('../../app/scripts/settings', proxies);
}


/**
 * Asserts that the internal get machinery is called for the given key.
 *
 * @param {settings} settings the settings module
 * @param {function} getFn the getter function
 * @param {key} key the key expected to be passed to the get machinery
 * @param {Tape} t the test param
 */
function helperGetCallsInternalsForKey(settings, getFn, key, t) {
  let expected = 'value for call to get';
  let getStub = sinon.stub().returns(expected);
  settings.get = getStub;
  
  let actual = getFn();
  t.true(getStub.calledOnce);
  t.equal(actual, expected);
}

/**
 * Asserts that the internal set machinery is called for the given key.
 *
 * @param {settings} settings the settings module
 * @param {function} getFn the setter function
 * @param {key} key the key expected to be passed to the set machinery
 * @param {any} value the value to set
 * @param {Tape} t the test param
 */
function helperSetCallsInternalsForKey(settings, setFn, key, value, t) {
  let expected = {the: 'settings resolved'};
  let setStub = sinon.stub().resolves(expected);
  settings.set = setStub;

  setFn(value)
  .then(returnedObj => {
    t.deepEqual(returnedObj, expected);
    t.true(setStub.calledOnce);
    t.deepEqual(setStub.args[0], [key, value]);
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetSettings();
  });
}

test('createNameSpacedKey returns correct value', function(t) {
  let key = 'someKey';
  let expected = 'setting_someKey';
  let actual = settings.createNameSpacedKey(key);

  t.equal(actual, expected);
  t.end();
});

test('removeNameSpaceFromKey returns user-friendly key', function(t) {
  let nameSpaced = 'setting_mySpecialKey';
  let expected = 'mySpecialKey';
  let actual = settings.removeNameSpaceFromKey(nameSpaced);
  t.equal(actual, expected);
  t.end();
});

test('set calls storage.set and resolves with updated cache', function(t) {
  let key = 'myKey';
  let oldSettings = {
    bar: 'bar value',
  };
  oldSettings[key] = 'old value';

  let newValue = 'the new value';

  let expectedSettingsObj = {
    bar: 'bar value'
  };
  expectedSettingsObj[key] = newValue;

  let expectedKvPair = {};
  expectedKvPair['setting_' + key] = newValue;

  let setSpy = sinon.stub().resolves();

  proxyquireSettings({}, { set: setSpy });
  settings.SETTINGS_OBJ = oldSettings;

  settings.set(key, newValue)
  .then(actualObj => {
    t.deepEqual(actualObj, expectedSettingsObj);
    t.deepEqual(setSpy.args[0], [expectedKvPair]);
    // And finally that we've updated the cache for future callers as well.
    t.deepEqual(settings.getSettingsObj(), expectedSettingsObj);
    t.end();
    resetSettings();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetSettings();
  });
});

test('set rejects with error', function(t) {
  let expected = { error: 'much suffering' };
  proxyquireSettings({}, { set: sinon.stub().rejects(expected) });
  settings.set()
  .then(res => {
    t.fail(res);
    t.end();
    resetSettings();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetSettings();
  });
});

test('get returns cached value if present', function(t) {
  let settingsObj = {
    myKey: 'omg its real!'
  };

  settings.getSettingsObj = sinon.stub().returns(settingsObj);

  let actual = settings.get('myKey');
  t.equal(actual, settingsObj.myKey);
  t.end();
  resetSettings();
});

test('get returns null if not present', function(t) {
  let settingsObj = {
    bar: 'much bar!'
  };

  settings.getSettingsObj = sinon.stub().returns(settingsObj);

  let actual = settings.get('fakeKey');
  t.equal(actual, null);
  t.end();
  resetSettings();
});

test('getAllSettingsKeys has all keys', function(t) {
  let actual = settings.getAllSettingKeys();

  let contains = function(arr, val) {
    let index = arr.indexOf(val);
    t.notEqual(index, -1);
  };

  // For now we are manually checking each key, duplicating each key here and
  // in the original source.
  contains(actual, 'setting_absPath');
  contains(actual, 'setting_instanceName');
  contains(actual, 'setting_baseDirId');
  contains(actual, 'setting_serverPort');
  t.end();
});

test('init initializes cache', function(t) {
  let settingKeys = ['setting_foo', 'setting_bar'];
  let rawSettings = {
    'setting_foo': 'foo_value',
    'setting_bar': 1234
  };
  let processedSettings = {
    'foo': 'foo_value',
    'bar': 1234
  };
  let getStub = sinon.stub().resolves(rawSettings);
  let getAllKeysStub = sinon.stub().returns(settingKeys);

  proxyquireSettings({}, { get: getStub });
  settings.getAllSettingKeys = getAllKeysStub;

  settings.init()
  .then(returnedObj => {
    t.true(getStub.calledOnce);
    t.deepEqual(getStub.args[0][0], settingKeys);
    t.deepEqual(returnedObj, processedSettings);
    // We should also be returning the cache to callers now
    t.deepEqual(settings.getSettingsObj(), processedSettings);
    t.end();
    resetSettings();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetSettings();
  });
});

test('init rejects if error', function(t) {
  let expected = { error: 'strug' };
  proxyquireSettings({}, { get: sinon.stub().rejects(expected) });
  settings.init()
  .then(res => {
    t.fail(res);
    t.end();
    resetSettings();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetSettings();
  });
});

test('custom getters call internals', function(t) {
  // Using the hard-coded strings avoid initialization errors. Not ideal but
  // not terrible.
  helperGetCallsInternalsForKey(
    settings,
    settings.getAbsPath,
    'absPath',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getInstanceName,
    'instanceName',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getBaseDirId,
    'baseDirId',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getBaseDirPath,
    'baseDirPath',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getServerPort,
    'serverPort',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getHostName,
    'hostName',
    t
  );
  helperGetCallsInternalsForKey(
    settings,
    settings.getTransportMethod,
    'transportMethod',
    t
  );
  t.end();
  resetSettings();
});

test('getTransportMethod defaults to http', function(t) {
  let key = 'transportMethod';
  let getSpy = sinon.stub();
  getSpy.withArgs(key).returns(null);
  settings.get = getSpy;

  let actual = settings.getTransportMethod();
  t.equal(actual, 'http');
  t.deepEqual(getSpy.args[0], [key]);
  t.end();
  resetSettings();
});

test('custom setters call internals', function(t) {
  // Using the hard-coded strings avoid initialization errors. Not ideal but
  // not terrible.
  helperSetCallsInternalsForKey(
    settings,
    settings.setAbsPath,
    'absPath',
    'some/path',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setInstanceName,
    'instanceName',
    'my awesome cache',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setBaseDirId,
    'baseDirId',
    'abc123',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setBaseDirPath,
    'baseDirPath',
    '~/Desktop/magicfolder',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setServerPort,
    'serverPort',
    9876,
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setHostName,
    'hostName',
    'laptop.local',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setTransportHttp,
    'transportMethod',
    'http',
    t
  );
  helperSetCallsInternalsForKey(
    settings,
    settings.setTransportWebrtc,
    'transportMethod',
    'webrtc',
    t
  );
  t.end();
  resetSettings();
});

test('promptAndSetNewBaseDir calls storage APIs', function(t) {
  let chosenDir = 'chosen dir';
  let dirId = 'retained id';
  let displayPath = 'the path of the chosend dir';

  let setBaseCacheDirSpy = sinon.spy();
  let promptForDirSpy = sinon.stub().resolves(chosenDir);
  let retainEntrySpy = sinon.stub().returns(dirId);
  let getDisplayPathSpy = sinon.stub().resolves(displayPath);
  let setBaseDirIdSpy = sinon.spy();
  let setBaseDirPathSpy = sinon.spy();

  proxyquireSettings(
    {
      './persistence/file-system': {
          promptForDir: promptForDirSpy,
          setBaseCacheDir: setBaseCacheDirSpy,
      }
    },
    {}, // chrome storage
    {
      retainEntry: retainEntrySpy,
      getDisplayPath: getDisplayPathSpy
    }
  );
  settings.setBaseDirId = setBaseDirIdSpy;
  settings.setBaseDirPath = setBaseDirPathSpy;

  let expected = {
    baseDirId: dirId,
    baseDirPath: displayPath
  };

  settings.promptAndSetNewBaseDir()
  .then(returnedObj => {
    t.equal(setBaseCacheDirSpy.args[0][0], chosenDir);
    t.equal(retainEntrySpy.args[0][0], chosenDir);
    t.equal(getDisplayPathSpy.args[0][0], chosenDir);
    t.deepEqual(returnedObj, expected);
    t.equal(setBaseDirIdSpy.args[0][0], dirId);
    t.equal(setBaseDirPathSpy.args[0][0], displayPath);
    t.end();
    resetSettings();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetSettings();
  });
});

test('promptAndSetNewBaseDir rejects if error', function(t) {
  let expected = { error: 'morals arent worth what a pig would spit' };
  proxyquireSettings({
    './persistence/file-system': {
        promptForDir: sinon.stub().rejects(expected)
    }
  });
  settings.promptAndSetNewBaseDir()
  .then(res => {
    t.fail(res);
    t.end();
    resetSettings();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetSettings();
  });
});
