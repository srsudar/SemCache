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
function resetSettings() {
  delete require.cache[
    require.resolve('../../app/scripts/settings')
  ];
}

/**
 * Asserts that the internal get machinery is called for the given key.
 *
 * @param {settings} settings the settings module
 * @param {function} getFn the getter function
 * @param {key} key the key expected to be passed to the get machinery
 * @param {t} t the test param
 */
function helperGetCallsInternalsForKey(settings, getFn, key, t) {
  var expected = 'value for call to get';
  var getStub = sinon.stub().returns(expected);
  settings.get = getStub;
  
  var actual = getFn();
  t.true(getStub.calledOnce);
  t.equal(actual, expected);
}

/**
 * Asserts that the internal set machinery is called for the given key.
 *
 * @param {settings} settings the settings module
 * @param {function} getFn the setter function
 * @param {key} key the key expected to be passed to the get machinery
 * @param {any} value the value to set
 * @param {t} t the test param
 */
function helperSetCallsInternalsForKey(settings, setFn, key, value, t) {
  var expected = {the: 'settings resolved'};
  var setStub = sinon.stub().resolves(expected);
  settings.set = setStub;

  setFn(value)
  .then(returnedObj => {
    t.deepEqual(returnedObj, expected);
    t.true(setStub.calledOnce);
    t.deepEqual(setStub.args[0], [key, value]);
  });
}

test('createNameSpacedKey returns correct value', function(t) {
  var settings = require('../../app/scripts/settings');
  var key = 'someKey';
  var expected = 'setting_someKey';
  var actual = settings.createNameSpacedKey(key);

  t.equal(actual, expected);
  t.end();
});

test('removeNameSpaceFromKey returns user-friendly key', function(t) {
  var settings = require('../../app/scripts/settings');
  var nameSpaced = 'setting_mySpecialKey';
  var expected = 'mySpecialKey';
  var actual = settings.removeNameSpaceFromKey(nameSpaced);
  t.equal(actual, expected);
  t.end();
});

test('set calls storage.set and resolves with updated cache', function(t) {
  var key = 'myKey';
  var oldSettings = {
    bar: 'bar value',
  };
  oldSettings[key] = 'old value';

  var newValue = 'the new value';

  var expectedSettingsObj = {
    bar: 'bar value'
  };
  expectedSettingsObj[key] = newValue;

  var expectedKvPair = {};
  expectedKvPair['setting_' + key] = newValue;

  var setSpy = sinon.stub().resolves();

  var settings = proxyquire(
    '../../app/scripts/settings',
    {
      './chrome-apis/storage':
      {
        set: setSpy
      }
    }
  );
  settings.SETTINGS_OBJ = oldSettings;

  settings.set(key, newValue)
    .then(actualObj => {
      t.deepEqual(actualObj, expectedSettingsObj);
      t.deepEqual(setSpy.args[0], [expectedKvPair, false]);
      // And finally that we've updated the cache for future callers as well.
      t.deepEqual(settings.getSettingsObj(), expectedSettingsObj);
      t.end();
      resetSettings();
    });

});

test('get returns cached value if present', function(t) {
  var settingsObj = {
    myKey: 'omg its real!'
  };

  var settings = require('../../app/scripts/settings');
  settings.getSettingsObj = sinon.stub().returns(settingsObj);

  var actual = settings.get('myKey');
  t.equal(actual, settingsObj.myKey);
  t.end();
  resetSettings();
});

test('get returns null if not present', function(t) {
  var settingsObj = {
    bar: 'much bar!'
  };

  var settings = require('../../app/scripts/settings');
  settings.getSettingsObj = sinon.stub().returns(settingsObj);

  var actual = settings.get('fakeKey');
  t.equal(actual, null);
  t.end();
  resetSettings();
});

test('getAllSettingsKeys has all keys', function(t) {
  var settings = require('../../app/scripts/settings');
  var actual = settings.getAllSettingKeys();

  var contains = function(arr, val) {
    var index = arr.indexOf(val);
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
  var settingKeys = ['setting_foo', 'setting_bar'];
  var rawSettings = {
    'setting_foo': 'foo_value',
    'setting_bar': 1234
  };
  var processedSettings = {
    'foo': 'foo_value',
    'bar': 1234
  };
  var getStub = sinon.stub().resolves(rawSettings);
  var getAllKeysStub = sinon.stub().returns(settingKeys);

  var settings = proxyquire(
    '../../app/scripts/settings',
    {
      './chrome-apis/storage':
      {
        get: getStub
      }
    }
  );
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
    });
});

test('custom getters call internals', function(t) {
  var settings = require('../../app/scripts/settings');
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
  t.end();
  resetSettings();
});

test('custom setters call internals', function(t) {
  var settings = require('../../app/scripts/settings');
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
  t.end();
  resetSettings();
});

test('promptAndSetNewBaseDir calls storage APIs', function(t) {
  var chosenDir = 'chosen dir';
  var dirId = 'retained id';
  var displayPath = 'the path of the chosend dir';

  var setBaseCacheDirSpy = sinon.spy();
  var promptForDirSpy = sinon.stub().resolves(chosenDir);
  var retainEntrySyncSpy = sinon.stub().returns(dirId);
  var getDisplayPathSpy = sinon.stub().resolves(displayPath);
  var setBaseDirIdSpy = sinon.spy();
  var setBaseDirPathSpy = sinon.spy();

  var settings = proxyquire(
    '../../app/scripts/settings', {
      './chrome-apis/file-system':
        {
          retainEntrySync: retainEntrySyncSpy,
          getDisplayPath: getDisplayPathSpy
        },
        './persistence/file-system':
          {
            promptForDir: promptForDirSpy,
            setBaseCacheDir: setBaseCacheDirSpy,
          }
        }
  );
  settings.setBaseDirId = setBaseDirIdSpy;
  settings.setBaseDirPath = setBaseDirPathSpy;

  var expected = {
    baseDirId: dirId,
    baseDirPath: displayPath
  };

  settings.promptAndSetNewBaseDir()
  .then(returnedObj => {
    t.equal(setBaseCacheDirSpy.args[0][0], chosenDir);
    t.equal(retainEntrySyncSpy.args[0][0], chosenDir);
    t.equal(getDisplayPathSpy.args[0][0], chosenDir);
    t.deepEqual(returnedObj, expected);
    t.equal(setBaseDirIdSpy.args[0][0], dirId);
    t.equal(setBaseDirPathSpy.args[0][0], displayPath);
    t.end();
    resetSettings();
  });


});
