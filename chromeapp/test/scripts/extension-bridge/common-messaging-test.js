'use strict';

const test = require('tape');

let common = require('../../../app/scripts/extension-bridge/common-messaging');


function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/extension-bridge/common-messaging')
  ];
  common = require('../../../app/scripts/extension-bridge/common-messaging');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}

test('createInitiatorMessage throws if unrecognized', function(t) {
  let willThrow = function() {
    common.createInitiatorMessage('popup', 'foo', {});
  };
  t.throws(willThrow);
  end(t);
});

test('createInitiatorMessage accepts known type', function(t) {
  let from = 'popup';
  let params = { param: 'uno' };
  let type = 'localQuery';

  let expected = { from, type, params };
  let actual = common.createInitiatorMessage(from, type, params);
  t.deepEqual(actual, expected);
  end(t);
});

test('createResponderMessage throws if unrecognized', function(t) {
  let willThrow = function() {
    common.createResponderMessage('foo');
  };
  t.throws(willThrow);
  end(t);
});

test('createResponderMessage accepts known type', function(t) {
  let type = 'localQuery-result';
  let status = 'success';
  let params = { param: 'hey' };
  let body = { time: 1234 };

  let expected = { type, status, params, body };
  let actual = common.createResponderMessage(type, status, params, body);
  t.deepEqual(actual, expected);
  end(t);
});

test('isSuccess correct', function(t) {
  t.false(common.isSuccess(common.createResponseError(
    common.responderTypes.localQuery)));
  t.true(common.isSuccess(common.createOpenResponse()));
  end(t);
});

test('isError correct', function(t) {
  t.false(common.isError(common.createOpenResponse()));
  t.true(common.isError(common.createResponseError(
    common.responderTypes.localQuery)));
  end(t);
});
