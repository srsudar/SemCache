'use strict';

const test = require('tape');
const sinon = require('sinon');
require('sinon-as-promised');

let util = require('../../../app/scripts/chrome-apis/util');

function resetUtil() {
  delete require.cache[
    require.resolve('../../../app/scripts/chrome-apis/util')
  ];
  util = require('../../../app/scripts/chrome-apis/util');
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t to end'); }
  t.end();
  resetUtil();
}

/**
 * @param {boolean} wasError result of call to wasError
 * @param {any} error the value of chrome.runtime.lastError
 */
function stubErrorMethods(wasError, error) {
  util.wasError = sinon.stub().returns(wasError);
  util.getError = sinon.stub().returns(error);
}

test('applyArgsCheckLastError resolves no args', function(t) {
  let expected = 'expected value';
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(false);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(actual => {
      t.equal(actual, expected);
      // We should invoke with only a callback parameter
      t.equal(fn.args[0].length, 1);
      end(t);
    })
    .catch(err => {
      t.fail(err);
      end(t);
    });
  };

  argGenerator();
});

test('applyArgsCheckLastError resolves one arg', function(t) {
  let expected = 'expected value';
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(false);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(actual => {
      t.equal(actual, expected);
      // 2, because param and callback
      t.equal(fn.args[0].length, 2);
      end(t);
    })
    .catch(err => {
      t.fail(err);
      end(t);
    });
  };

  argGenerator('param1');
});

test('applyArgsCheckLastError resolves four args', function(t) {
  let expected = 'expected value';
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(false);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(actual => {
      t.equal(actual, expected);
      // 5, because 4 plus the callback
      t.equal(fn.args[0].length, 5);
      end(t);
    })
    .catch(err => {
      t.fail(err);
      end(t);
    });
  };

  argGenerator('param1', 2, 'param 3', null);
});

test('applyArgsCheckLastError rejects no args', function(t) {
  let expected = { error: 'expected err' };
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(true, expected);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(res => {
      t.fail(res);
      end(t);
    })
    .catch(actual => {
      t.equal(actual, expected);
      // We should invoke with only a callback parameter
      t.equal(fn.args[0].length, 1);
      end(t);
    });
  };

  argGenerator();
});

test('applyArgsCheckLastError rejects one arg', function(t) {
  let expected = { error: 'expected err' };
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(true, expected);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(res => {
      t.fail(res);
      end(t);
    })
    .catch(actual => {
      t.equal(actual, expected);
      // We should invoke with a callback and a parameter
      t.equal(fn.args[0].length, 2);
      end(t);
    });
  };

  argGenerator('param');
});

test('applyArgsCheckLastError rejects four args', function(t) {
  let expected = { error: 'expected err' };
  let fn = sinon.stub();
  fn.yields(expected);
  stubErrorMethods(true, expected);

  // Ugly to duplicate this method, but I don't know of any other way to
  // reliably create an arguments object.
  let argGenerator = function() {
    util.applyArgsCheckLastError(fn, arguments)
    .then(res => {
      t.fail(res);
      end(t);
    })
    .catch(actual => {
      t.equal(actual, expected);
      // We should invoke with 4 params and a callback
      t.equal(fn.args[0].length, 5);
      end(t);
    });
  };

  argGenerator(1, 2, null, 'param');
});
