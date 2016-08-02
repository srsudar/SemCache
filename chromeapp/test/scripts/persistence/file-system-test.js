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
      '../chrome-apis/file-system': {
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
      '../chrome-apis/file-system': {
        retainEntrySync: retainEntrySyncSpy
      },
      '../chrome-apis/storage': {
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
      '../chrome-apis/storage': {
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
      '../chrome-apis/storage': {
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

test('getPersistedBaseDir returns null if not set', function(t) {
  var fileSystem = require('../../../app/scripts/persistence/file-system');
  fileSystem.baseDirIsSet = sinon.stub().resolves(false);

  var expected = null;
  fileSystem.getPersistedBaseDir()
  .then(dirEntry => {
    t.equal(dirEntry, expected);
    t.end();
    resetFileSystem();
  });
});

test('getPersistedBaseDir retrieves from storage', function(t) {
  var savedId = 'persisted identifier';
  var expectedDirEntry = 'expected directory';

  var getSpy = sinon.stub().resolves({baseDir: savedId});
  var restoreEntrySpy = sinon.stub().resolves(expectedDirEntry);

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      '../chrome-apis/storage': {
        get: getSpy
      },
      '../chrome-apis/file-system': {
        restoreEntry: restoreEntrySpy
      }
    }
  );

  fileSystem.getPersistedBaseDir()
  .then(actualDir => {
    t.equal(actualDir, expectedDirEntry);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    resetFileSystem();
  });
});

test('getDirectoryForCacheEntries rejects if no base dir', function(t) {
  var errObj = {msg: 'no base dir'};
  var getPersistedBaseDirSpy = sinon.stub().rejects(errObj);

  var fileSystem = require('../../../app/scripts/persistence/file-system');
  fileSystem.getPersistedBaseDir = getPersistedBaseDirSpy;

  fileSystem.getDirectoryForCacheEntries()
  .catch(actualErr => {
    t.deepEqual(actualErr, errObj);
    t.end();
    resetFileSystem();
  });
});

test(
  'getDirectoryForCacheEntries rejects if getDirectory rejects',
  function(t) {
    var errObj = {msg: 'getDirectory failed'};
    var getPersistedBaseDirSpy = sinon.stub().resolves();
    var getDirectoryStub = sinon.stub().rejects(errObj);

    var fileSystem = proxyquire(
      '../../../app/scripts/persistence/file-system',
      {
        './file-system-util': {
          getDirectory: getDirectoryStub
        }
      }
    );
    fileSystem.getPersistedBaseDir = getPersistedBaseDirSpy;

    fileSystem.getDirectoryForCacheEntries()
      .catch(actualErr => {
        t.deepEqual(actualErr, errObj);
        t.end();
        resetFileSystem();
      });
  }
);

test('getDirectoryForCacheEntries resolves with entry', function(t) {
  var baseDir = 'base directory';
  var cacheDir = 'cache directory';

  var getPersistedBaseDirSpy = sinon.stub().resolves(baseDir);
  var getDirectoryStub = sinon.stub().resolves(cacheDir);

  var fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system',
    {
      './file-system-util': {
        getDirectory: getDirectoryStub
      }
    }
  );
  fileSystem.getPersistedBaseDir = getPersistedBaseDirSpy;

  fileSystem.getDirectoryForCacheEntries()
    .then(actualDirEntry => {
      t.deepEqual(actualDirEntry, cacheDir);
      t.true(getPersistedBaseDirSpy.calledOnce);
      t.deepEqual(getDirectoryStub.args[0],
        [
          baseDir, {create: true, exclusive: false}, fileSystem.PATH_CACHE_DIR
        ]
      );
      t.end();
      resetFileSystem();
    });
});

test('constructFileSchemeUrl creates correct scheme', function(t) {
  var absPath = '/absolute/path/to/semcachedir';
  var entryPath = '/semcachedir/cachedPages/my_fancy_page.mhtml';
  var expected =
    'file:///absolute/path/to/semcachedir/cachedPages/my_fancy_page.mhtml';

  var fileSystem = require('../../../app/scripts/persistence/file-system');
  var actual = fileSystem.constructFileSchemeUrl(absPath, entryPath);
  t.equal(actual, expected);
  t.end();
});
