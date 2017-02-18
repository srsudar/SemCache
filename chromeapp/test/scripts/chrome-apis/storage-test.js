'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var storage = require('../../../app/scripts/chrome-apis/storage');

function resetStorage() {
  delete require.cache[
    require.resolve('../../../app/scripts/chrome-apis/storage')
  ];
  storage = require('../../../app/scripts/chrome-apis/storage');
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t to end'); }
  t.end();
  resetStorage();
}

/**
 * Proxyquire the chrome-apis/file-system module onto the module level fs
 * variable. This is essentially equivalent to the call:
 *
 * @param {Stub} storageStub the storageStub that will be returned by
 * util.getStorageLocal().
 * @param {boolean} wasError result of call to wasError
 * @param {any} error the value of chrome.runtime.lastError
 */
function proxyquireStorage(storageStub, wasError, error) {
  storage = proxyquire('../../../app/scripts/chrome-apis/storage', {
    './util': {
      getStorageLocal: sinon.stub().returns(storageStub),
      wasError: sinon.stub().returns(wasError),
      getError: sinon.stub().returns(error)
    }
  });
}

function helperResolve(methodName, t, cbIndex, cbHasArg) {
  if (cbIndex === undefined) {
    cbIndex = 1;
  }
  var entry = sinon.stub();
  var expected = 'expected value';
  var methodStub = sinon.stub();
  methodStub.callsArgWith(cbIndex, expected);
  var storageStub = {};
  storageStub[methodName] = methodStub;
  proxyquireStorage(storageStub, false);

  storage[methodName](entry)
  .then(actual => {
    if (cbHasArg) {
      t.equal(actual, expected);
    }
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
  if (cbIndex === undefined) {
    cbIndex = 1;
  }
  var entry = sinon.stub();
  var expected = 'error message';
  var methodStub = sinon.stub();
  methodStub.callsArgWith(cbIndex, expected);
  var storageStub = {};
  storageStub[methodName] = methodStub;
  proxyquireStorage(storageStub, true, expected);

  storage[methodName](entry)
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

test('get resolves with result', function(t) {
  helperResolve('get', t);
});

test('get rejects with error', function(t) {
  helperReject('get', t);
});

test('getBytesInUse resolves with result', function(t) {
  helperResolve('getBytesInUse', t);
});

test('getBytesInUse rejects with error', function(t) {
  helperReject('getBytesInUse', t);
});

test('set resolves with result', function(t) {
  helperResolve('set', t, undefined, false);
});

test('set rejects with error', function(t) {
  helperReject('set', t);
});

test('remove resolves with result', function(t) {
  helperResolve('remove', t, undefined, false);
});

test('remove rejects with error', function(t) {
  helperReject('remove', t);
});

test('clear resolves with result', function(t) {
  helperResolve('clear', t, 0, false);
});

test('clear rejects with error', function(t) {
  helperReject('clear', t, 0);
});
