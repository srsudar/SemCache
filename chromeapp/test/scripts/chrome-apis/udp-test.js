'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

let udp = require('../../../app/scripts/chrome-apis/udp');

function resetUdp() {
  delete require.cache[
    require.resolve('../../../app/scripts/chrome-apis/udp')
  ];
  udp = require('../../../app/scripts/chrome-apis/udp');
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t to end'); }
  t.end();
  resetUdp();
}

/**
 * Proxyquire the chrome-apis/file-system module onto the module level fs
 * variable. This is essentially equivalent to the call:
 *
 * @param {Stub} udpStub the udpStub that will be returned by
 * util.getFileSystem().
 * @param {boolean} wasError result of call to wasError
 * @param {any} error the value of chrome.runtime.lastError
 */
function proxyquireUdp(udpStub, wasError, error) {
  udp = proxyquire('../../../app/scripts/chrome-apis/udp', {
    './util': {
      getUdp: sinon.stub().returns(udpStub),
      wasError: sinon.stub().returns(wasError),
      getError: sinon.stub().returns(error)
    }
  });
}

function helperResolve(methodName, t, cbIndex) {
  if (cbIndex === undefined) {
    cbIndex = 1;
  }
  let entry = sinon.stub();
  let expected = 'expected value';
  let methodStub = sinon.stub();
  methodStub.callsArgWith(cbIndex, expected);
  let udpStub = {};
  udpStub[methodName] = methodStub;
  proxyquireUdp(udpStub, false);

  udp[methodName](entry)
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
  if (cbIndex === undefined) {
    cbIndex = 1;
  }
  let entry = sinon.stub();
  let expected = 'error message';
  let methodStub = sinon.stub();
  methodStub.callsArgWith(cbIndex, expected);
  let udpStub = {};
  udpStub[methodName] = methodStub;
  proxyquireUdp(udpStub, true, expected);

  udp[methodName](entry)
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

test('create resolves with result', function(t) {
  helperResolve('create', t);
});

test('create rejects with error', function(t) {
  helperReject('create', t);
});
