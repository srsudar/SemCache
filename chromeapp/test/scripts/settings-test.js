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

test('init initializes cache', function(t) {
  var keyPort = 'setting_port';
  var keyPath = 'setting_absPath';
  var allKvPairs = {};
  // This mixing of [] and dot notation is to appease jslint
  allKvPairs[keyPort] = 1782;
  allKvPairs[keyPath] = '/path/to/dir';
  allKvPairs.notASetting = 'some other thing';

  var expected = {
    port: allKvPairs[keyPort],
    absPath: allKvPairs[keyPath]
  };

  var getSpy = sinon.stub().resolves(allKvPairs);

  var settings = proxyquire(
    '../../app/scripts/settings',
    {
      './chrome-apis/storage':
      {
        get: getSpy
      }
    }
  );

  settings.init()
    .then(cachedObj => {
      t.deepEqual(cachedObj, expected);
      // We should also be returning the cache to callers now
      t.deepEqual(settings.getSettingsObj(), expected);
      t.end();
      resetSettings();
    });
});
