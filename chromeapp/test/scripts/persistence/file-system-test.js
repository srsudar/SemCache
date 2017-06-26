/*jshint esnext:true*/
'use strict';

var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var fileSystem = require('../../../app/scripts/persistence/file-system');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/file-system')
  ];
  fileSystem = require('../../../app/scripts/persistence/file-system');
}

function proxyquireFileSystem(proxies, localStorageProxies, chromefsProxies) {
  // Add the chrome proxies
  proxies['../chrome-apis/chromep'] = {
    getFileSystem: sinon.stub().returns(chromefsProxies),
    getStorageLocal: sinon.stub().returns(localStorageProxies)
  };
  fileSystem = proxyquire(
    '../../../app/scripts/persistence/file-system', proxies
  );
}

/**
 * Call t.end() and reset test state.
 */
function end(t) {
  if (!t) { throw new Error('You forgot to pass t to end'); }
  t.end();
  reset();
}

test('promptForDir calls chrome API and returns Entry', function(t) {
  // Make the module think it has started.
  var expectedEntry = 'foo baz bar';
  var chooseEntrySpy = sinon.stub().resolves(expectedEntry);

  proxyquireFileSystem({}, {}, { chooseEntry: chooseEntrySpy });

  fileSystem.promptForDir()
  .then(actualEntry => {
    // we must choose a directory
    t.deepEqual(chooseEntrySpy.args[0][0], { type: 'openDirectory' });
    t.equal(actualEntry, expectedEntry);
    t.end();
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });
});

test('promptForDir rejects if error', function(t) {
  var expected = { error: 'trouble' };
  proxyquireFileSystem(
    {}, {}, { chooseEntry: sinon.stub().rejects(expected) }
  );
  fileSystem.promptForDir()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('setBaseCacheDir calls persist functions', function(t) {
  // Make the module think it has started.
  var expectedId = 'an identifier';
  var retainEntrySpy = sinon.stub().returns(expectedId);
  var setSpy = sinon.spy();

  proxyquireFileSystem(
    {},
    { set: setSpy },
    { retainEntry: retainEntrySpy }
  );

  var dirEntry = 'directory entry';

  fileSystem.setBaseCacheDir(dirEntry);

  t.true(retainEntrySpy.calledOnce);
  t.true(retainEntrySpy.calledWith(dirEntry));

  t.true(setSpy.calledOnce);
  t.true(setSpy.calledWith({baseDir: expectedId}));

  reset();
  t.end();
});

test('baseDirIsSet true correctly', function(t) {
  // Make the module think it has started.
  var keyValue = { baseDir: 'identifier' };

  var getSpy = sinon.stub().resolves(keyValue);

  proxyquireFileSystem({}, { get: getSpy }, {});

  fileSystem.baseDirIsSet()
  .then(isSet => {
    t.true(isSet);
    t.true(getSpy.calledOnce);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });

});

test('baseDirIsSet true correctly', function(t) {
  // Make the module think it has started.
  var getSpy = sinon.stub().resolves({});

  proxyquireFileSystem({}, { get: getSpy }, {});

  fileSystem.baseDirIsSet()
  .then(isSet => {
    t.false(isSet);
    t.true(getSpy.calledOnce);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });
});

test('baseDirIsSet rejects if error', function(t) {
  var expected = { error: 'trouble' };
  proxyquireFileSystem(
    {},
    { get: sinon.stub().rejects(expected) },
    {}
  );

  fileSystem.baseDirIsSet()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
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
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });
});

test('getPersistedBaseDir retrieves from storage', function(t) {
  var savedId = 'persisted identifier';
  var expectedDirEntry = 'expected directory';

  var getSpy = sinon.stub().resolves({ baseDir: savedId });
  var restoreEntrySpy = sinon.stub().resolves(expectedDirEntry);

  proxyquireFileSystem({}, { get: getSpy }, { restoreEntry: restoreEntrySpy });
  fileSystem.baseDirIsSet = sinon.stub().resolves(true);

  fileSystem.getPersistedBaseDir()
  .then(actualDir => {
    t.equal(actualDir, expectedDirEntry);
    t.true(getSpy.calledWith(fileSystem.KEY_BASE_DIR));
    t.end();
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });
});

test('getPersistedBaseDir rejects if error', function(t) {
  var expected = { error: 'wooeeeee' };
  fileSystem.baseDirIsSet = sinon.stub().rejects(expected);
  fileSystem.getPersistedBaseDir()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('getDirectoryForCacheEntries rejects if no base dir', function(t) {
  var errObj = { msg: 'no base dir' };
  var getPersistedBaseDirSpy = sinon.stub().rejects(errObj);

  var fileSystem = require('../../../app/scripts/persistence/file-system');
  fileSystem.getPersistedBaseDir = getPersistedBaseDirSpy;

  fileSystem.getDirectoryForCacheEntries()
  .then(res => {
    t.fail(res);
    t.end();
    reset();
  })
  .catch(actualErr => {
    t.deepEqual(actualErr, errObj);
    t.end();
    reset();
  });
});

test(
  'getDirectoryForCacheEntries rejects if getDirectory rejects',
  function(t) {
    var errObj = { msg: 'getDirectory failed' };
    var getPersistedBaseDirSpy = sinon.stub().resolves();
    var getDirectoryStub = sinon.stub().rejects(errObj);

    proxyquireFileSystem({
      './file-system-util': {
        getDirectory: getDirectoryStub
      }
    });
    fileSystem.getPersistedBaseDir = getPersistedBaseDirSpy;

    fileSystem.getDirectoryForCacheEntries()
    .then(res => {
      t.fail(res);
      t.end();
      reset();
    })
    .catch(actualErr => {
      t.deepEqual(actualErr, errObj);
      t.end();
      reset();
    });
  }
);

test('getDirectoryForCacheEntries resolves with entry', function(t) {
  var baseDir = 'base directory';
  var cacheDir = 'cache directory';

  var getPersistedBaseDirSpy = sinon.stub().resolves(baseDir);
  var getDirectoryStub = sinon.stub().resolves(cacheDir);

  proxyquireFileSystem({
    './file-system-util': {
      getDirectory: getDirectoryStub
    }
  });
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
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
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

test('getFileContentsFromName resolves with contents', function(t) {
  var fileName = 'such_a_fancy_name';
  var cacheDir = sinon.stub();
  var fileEntry = sinon.stub();

  var expected = Buffer.from('hello');

  var getDirectoryForCacheEntriesSpy = sinon.stub().resolves(cacheDir);

  var getFileSpy = sinon.stub().resolves(fileEntry);
  var getFileContentsSpy = sinon.stub().resolves(expected);

  proxyquireFileSystem({
    './file-system-util': {
      getFile: getFileSpy,
      getFileContents: getFileContentsSpy
    }
  });
  fileSystem.getDirectoryForCacheEntries = getDirectoryForCacheEntriesSpy;

  fileSystem.getFileContentsFromName(fileName)
  .then(actual => {
    // We called getFile with the file name and cache dir
    t.equal(getFileSpy.args[0][0], cacheDir);
    t.equal(getFileSpy.args[0][2], fileName);

    t.deepEqual(actual, expected);
    t.end();
    reset();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    reset();
  });
});

test('getFileContentsFromName rejects with error', function(t) {
  var fileName = 'such_a_fancy_name';
  var expected = { error: 'get directory for cache entries failed' };

  var getDirectoryForCacheEntriesSpy = sinon.stub().rejects(expected);
  fileSystem.getDirectoryForCacheEntries = getDirectoryForCacheEntriesSpy;

  fileSystem.getFileContentsFromName(fileName)
  .then(res => {
    t.fail(res);
    t.end();
    reset();
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.end();
    reset();
  });
});

test('getFileForWritingCachedPage resolves on success', function(t) {
  const filePath = 'hello.mhtml';
  const dirEntry = { name: 'directory entry' };

  const expected = { hello: 'I am the file entry' };
  const getFileStub = sinon.stub();
  getFileStub.withArgs(
    dirEntry,
    { create: true, exclusive: false },
    filePath
  )
  .resolves(expected);

  proxyquireFileSystem({
    './file-system-util': {
      getFile: getFileStub
    }
  });

  const getDirectoryForCacheEntriesStub = sinon.stub().resolves(dirEntry);
  fileSystem.getDirectoryForCacheEntries = getDirectoryForCacheEntriesStub;


  fileSystem.getFileForWritingCachedPage(filePath)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getFileForWritingCachedPage rejects on error', function(t) {
  const filePath = 'hello.mhtml';

  const expected = { err: 'went wrong' };
  const getFileStub = sinon.stub().rejects(expected);
  fileSystem.getFile = getFileStub;

  proxyquireFileSystem({
    './file-system-util': {
      getFile: getFileStub
    }
  });

  const getDirectoryForCacheEntriesStub = sinon.stub().resolves();
  fileSystem.getDirectoryForCacheEntries = getDirectoryForCacheEntriesStub;

  fileSystem.getFileForWritingCachedPage(filePath)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
