'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var runtime = require('../../../app/scripts/chrome-apis/runtime');

function resetRuntime() {
  delete require.cache[
    require.resolve('../../../app/scripts/chrome-apis/runtime')
  ];
  runtime = require('../../../app/scripts/chrome-apis/runtime');
}

function end(t) {
  if (!t) { throw new Error('you forgot to pass t to end'); }
  t.end();
  resetRuntime();
}

/**
 * Proxyquire the chrome-apis/runtime module onto the module level runtime
 * variable. This is essentially equivalent to the call:
 *
 * @param {Stub} runtimeStub the fileSystemStub that will be returned by
 * util.getFileSystem().
 * @param {boolean} wasError result of call to wasError
 * @param {any} error the value of chrome.runtime.lastError
 */
function proxyquireRuntime(runtimeStub, wasError, error) {
  runtime = proxyquire('../../../app/scripts/chrome-apis/runtime', {
    './util': {
      getRuntime: sinon.stub().returns(runtimeStub),
      wasError: sinon.stub().returns(wasError),
      getError: sinon.stub().returns(error)
    }
  });
}

test('sendMessage calls with args and resolves', function(t) {
  var id = 'stringid';
  var msg = { message: 'hello' };
  var options = { option: 'uno' };
  var expected = 'expectedResponse';

  var sendMessageStub = sinon.stub();
  sendMessageStub.callsArgWith(3, expected);
  proxyquireRuntime({ sendMessage: sendMessageStub }, false);

  runtime.sendMessage(id, msg, options)
  .then(actual => {
    t.equal(actual, expected);
    // We can ignore the callback parameter in these assertions, since we
    // aren't passing that in.
    t.deepEqual(sendMessageStub.args[0].slice(0, 3), [id, msg, options]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendMessage rejects with error', function(t) {
  var expected = 'this was the error';
  var sendMessageStub = sinon.stub();
  sendMessageStub.callsArgWith(0, expected);
  proxyquireRuntime({ sendMessage: sendMessageStub }, true, expected);

  runtime.sendMessage()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('addOnMessageExternalListener adds function', function(t) {
  var addListenerStub = sinon.stub();
  proxyquireRuntime({
    onMessageExternal: {
      addListener: addListenerStub 
    }
  }, false);

  var callback = function() { };
  runtime.addOnMessageExternalListener(callback);
  t.deepEqual(addListenerStub.args[0], [callback]);
  end(t);
});
