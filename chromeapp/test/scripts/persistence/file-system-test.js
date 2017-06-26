/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

let fileSystem = require('../../../app/scripts/persistence/file-system');


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
  let expectedEntry = 'foo baz bar';
  let chooseEntrySpy = sinon.stub().resolves(expectedEntry);

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
  let expected = { error: 'trouble' };
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
  let expectedId = 'an identifier';
  let retainEntrySpy = sinon.stub().returns(expectedId);
  let setSpy = sinon.spy();

  proxyquireFileSystem(
    {},
    { set: setSpy },
    { retainEntry: retainEntrySpy }
  );

  let dirEntry = 'directory entry';

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
  let keyValue = { baseDir: 'identifier' };

  let getSpy = sinon.stub().resolves(keyValue);

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
  let getSpy = sinon.stub().resolves({});

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
  let expected = { error: 'trouble' };
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
  let fileSystem = require('../../../app/scripts/persistence/file-system');
  fileSystem.baseDirIsSet = sinon.stub().resolves(false);

  let expected = null;
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
  let savedId = 'persisted identifier';
  let expectedDirEntry = 'expected directory';

  let getSpy = sinon.stub().resolves({ baseDir: savedId });
  let restoreEntrySpy = sinon.stub().resolves(expectedDirEntry);

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
  let expected = { error: 'wooeeeee' };
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
  let errObj = { msg: 'no base dir' };
  let getPersistedBaseDirSpy = sinon.stub().rejects(errObj);

  let fileSystem = require('../../../app/scripts/persistence/file-system');
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
    let errObj = { msg: 'getDirectory failed' };
    let getPersistedBaseDirSpy = sinon.stub().resolves();
    let getDirectoryStub = sinon.stub().rejects(errObj);

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
  let baseDir = 'base directory';
  let cacheDir = 'cache directory';

  let getPersistedBaseDirSpy = sinon.stub().resolves(baseDir);
  let getDirectoryStub = sinon.stub().resolves(cacheDir);

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
  let absPath = '/absolute/path/to/semcachedir';
  let entryPath = '/semcachedir/cachedPages/my_fancy_page.mhtml';
  let expected =
    'file:///absolute/path/to/semcachedir/cachedPages/my_fancy_page.mhtml';

  let fileSystem = require('../../../app/scripts/persistence/file-system');
  let actual = fileSystem.constructFileSchemeUrl(absPath, entryPath);
  t.equal(actual, expected);
  t.end();
});

test('getFileContentsFromName resolves with contents', function(t) {
  let fileName = 'such_a_fancy_name';
  let cacheDir = sinon.stub();
  let fileEntry = sinon.stub();

  let expected = Buffer.from('hello');

  let getDirectoryForCacheEntriesSpy = sinon.stub().resolves(cacheDir);

  let getFileSpy = sinon.stub().resolves(fileEntry);
  let getFileContentsSpy = sinon.stub().resolves(expected);

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
  let fileName = 'such_a_fancy_name';
  let expected = { error: 'get directory for cache entries failed' };

  let getDirectoryForCacheEntriesSpy = sinon.stub().rejects(expected);
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
