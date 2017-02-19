'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var fs = require('../../../app/scripts/chrome-apis/file-system');

function resetFs() {
  delete require.cache[
    require.resolve('../../../app/scripts/chrome-apis/file-system')
  ];
  fs = require('../../../app/scripts/chrome-apis/file-system');
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t to end'); }
  t.end();
  resetFs();
}

/**
 * Proxyquire the chrome-apis/file-system module onto the module level fs
 * variable. This is essentially equivalent to the call:
 *
 * @param {Stub} fileSystemStub the fileSystemStub that will be returned by
 * util.getFileSystem().
 * @param {boolean} wasError result of call to wasError
 * @param {any} error the value of chrome.runtime.lastError
 */
function proxyquireFileSystem(fileSystemStub, wasError, error) {
  fs = proxyquire('../../../app/scripts/chrome-apis/file-system', {
    './util': {
      getFileSystem: sinon.stub().returns(fileSystemStub),
      wasError: sinon.stub().returns(wasError),
      getError: sinon.stub().returns(error)
    }
  });
}

function helperResolve(methodName, t, cbIndex) {
  var entry = 'first arg value';
  var expected = 'expected value';
  var methodStub = sinon.stub();
  methodStub.yields(expected);
  var fileSystemStub = {};
  fileSystemStub[methodName] = methodStub;
  proxyquireFileSystem(fileSystemStub, false);

  fs[methodName](entry)
  .then(actual => {
    t.equal(actual, expected);
    if (cbIndex !== 0) {
      t.equal(methodStub.args[0][0], entry);
    }
    t.equal(methodStub.callCount, 1);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
}

function helperReject(methodName, t, cbIndex) {
  var entry = 'first arg';
  var expected = 'error message';
  var methodStub = sinon.stub();
  methodStub.yields(expected);
  var fileSystemStub = {};
  fileSystemStub[methodName] = methodStub;
  proxyquireFileSystem(fileSystemStub, true, expected);

  fs[methodName](entry)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    if (cbIndex !== 0) {
      t.equal(methodStub.args[0][0], entry);
    }
    t.equal(methodStub.callCount, 1);
    end(t);
  });
}

test.only('getDisplayPath resolves with apply', function(t) {
  var expected = 'expected resolve';
  var fnToInvoke = function() { };
  var fsStub = {
    getDisplayPath: fnToInvoke
  };
  var applyArgsStub = sinon.stub().resolves(expected);
  fs = proxyquire('../../../app/scripts/chrome-apis/file-system', {
    './util': {
      applyArgsCheckLastError: applyArgsStub,
      getFileSystem: sinon.stub().returns(fsStub)
    }
  });

  var arg1 = 'foo';
  var arg2 = 'bar';
  fs.getDisplayPath(arg1, arg2)
  .then(actual => {
    t.equal(actual, expected);
    t.deepEqual(applyArgsStub.args[0][0], fnToInvoke);
    // Access the arguments parameter like this. Ugly but necessary.
    t.equal(applyArgsStub.args[0][1]['0'], arg1);
    t.equal(applyArgsStub.args[0][1]['1'], arg2);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getDisplayPath resolves with result', function(t) {
  helperResolve('getDisplayPath', t);
});

test('getDisplayPath rejects with error', function(t) {
  helperReject('getDisplayPath', t);
});

test('getWritableEntry resolves with result', function(t) {
  helperResolve('getWritableEntry', t);
});

test('getWritableEntry rejects with error', function(t) {
  helperReject('getWritableEntry', t);
});

test('isWritableEntry resolves with result', function(t) {
  helperResolve('isWritableEntry', t);
});

test('isWritableEntry rejects with error', function(t) {
  helperReject('isWritableEntry', t);
});

test('chooseEntry resolves with result', function(t) {
  helperResolve('chooseEntry', t);
});

test('chooseEntry rejects with error', function(t) {
  helperReject('chooseEntry', t);
});

test('restoreEntry resolves with result', function(t) {
  helperResolve('restoreEntry', t);
});

test('restoreEntry rejects with error', function(t) {
  helperReject('restoreEntry', t);
});

test('isRestorable resolves with result', function(t) {
  helperResolve('isRestorable', t);
});

test('isRestorable rejects with error', function(t) {
  helperReject('isRestorable', t);
});

test('retainEntry resolves with id', function(t) {
  var expected = 'entry-id';
  var entry = 'entry';
  var retainEntryStub = sinon.stub().withArgs(entry).returns(expected);
  proxyquireFileSystem({ retainEntry: retainEntryStub }, false);
  fs.retainEntry(entry)
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('retainEntrySync returns id', function(t) {
  var expected = 'entry-id';
  var entry = 'entry';
  var retainEntryStub = sinon.stub().withArgs(entry).returns(expected);
  proxyquireFileSystem({ retainEntry: retainEntryStub }, false);
  var actual = fs.retainEntrySync(entry);
  t.equal(actual, expected);
  end(t);
});

test('requestFileSystem resolves with fileSystem', function(t) {
  helperResolve('requestFileSystem', t);
});

test('requestFileSystem rejects with error', function(t) {
  helperReject('requestFileSystem', t);
});

test('getVolumeList resolves with result', function(t) {
  helperResolve('getVolumeList', t, 0);
});

test('getVolumeList rejects with error', function(t) {
  helperReject('getVolumeList', t, 0);
});
