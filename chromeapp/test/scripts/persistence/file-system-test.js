/*jshint esnext:true*/
/* globals Promise */
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
function resetFileSystem() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/file-system')
  ];
}

test('promptForDir calls chrome API and returns Entry', function(t) {
  // Make the module think it has started.
  var chooseEntryArg = null;
  var expectedEntry = 'foo baz bar';
  var chooseEntrySpy = function(chooseEntryParam) {
    chooseEntryArg = chooseEntryParam;
    return Promise.resolve(expectedEntry);
  };

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      './chromeFileSystem': {
        chooseEntry: chooseEntrySpy
      }
    }
  );

  fileSystem.promptForDir()
  .then(actualEntry => {
    // we must choose a directory
    t.deepEqual(chooseEntryArg, {type: 'openDirectory'});
    t.equal(actualEntry, expectedEntry);
    t.end();
    resetFileSystem();
  })
  .catch(function(errObj) {
    t.fail('should not have reached catch');
    console.log(errObj);
    t.end();
    resetFileSystem();
  });

});

test('setBaseCacheDir calls persist functions', function(t) {
  // Make the module think it has started.
  var expectedId = 'an identifier';
  var retainEntrySyncSpy = sinon.stub().returns(expectedId);
  var setSpy = sinon.spy();

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      './chromeFileSystem': {
        retainEntrySync: retainEntrySyncSpy
      },
      './chromeStorage': {
        set: setSpy
      }
    }
  );

  var dirEntry = 'directory entry';

  fileSystem.setBaseCacheDir(dirEntry);

  t.true(retainEntrySyncSpy.calledOnce);
  t.true(retainEntrySyncSpy.calledWith(dirEntry));

  t.true(setSpy.calledOnce);
  t.true(setSpy.calledWith({baseDir: expectedId}));

  resetFileSystem();
  t.end();

});

test('baseDirIsSet true correctly', function(t) {
  // Make the module think it has started.
  var keyValue = {baseDir: 'identifier'};

  var getSpy = sinon.stub().resolves(keyValue);

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      './chromeStorage': {
        get: getSpy
      }
    }
  );

  fileSystem.baseDirIsSet()
  .then(isSet => {
    t.true(isSet);
    t.true(getSpy.calledOnce);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    resetFileSystem();
  });

});

test('baseDirIsSet true correctly', function(t) {
  // Make the module think it has started.
  var getSpy = sinon.stub().resolves({});

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      './chromeStorage': {
        get: getSpy
      }
    }
  );

  fileSystem.baseDirIsSet()
  .then(isSet => {
    t.false(isSet);
    t.true(getSpy.calledOnce);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    resetFileSystem();
  });

});
