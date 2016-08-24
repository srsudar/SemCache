/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var messaging = require('../../../app/scripts/app-bridge/messaging');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetMessaging() {
  delete require.cache[
    require.resolve('../../../app/scripts/app-bridge/messaging')
  ];
  messaging = require('../../../app/scripts/app-bridge/messaging');
}

/**
 * Proxyquire messaging with the given proxies.
 */
function proxyquireMessaging(proxies) {
  messaging = proxyquire(
    '../../../app/scripts/app-bridge/messaging',
    proxies
  );
}

/**
 * Return an object that mimics a successful write from the app. This is an
 * object like the one that is passed when the callback is invoked.
 */
function getSuccessResponseFromApp() {
  return {
    type: 'write',
    result: 'success'
  };
}

test('sendMessageToApp calls chromeRuntime', function(t) {
  var sendMessageSpy = sinon.spy();
  proxyquireMessaging({
    '../chrome-apis/runtime': {
      sendMessage: sendMessageSpy
    }
  });

  var message = {hello: 'world'};
  var callback = 'much fancy';
  messaging.sendMessageToApp(message, callback);

  t.equal(sendMessageSpy.args[0][0], messaging.APP_ID);
  t.deepEqual(sendMessageSpy.args[0][1], message);
  t.deepEqual(sendMessageSpy.args[0][2], callback);
  t.end();
});

test('savePage sends correct message and resolves', function(t) {
  var captureUrl = 'someurl';
  var captureDate = 'why-not-today';
  var dataUrl = 'data:url';
  var metadata = { hello: 'how are you doing', three: 3 };

  var expectedResponseFromApp = getSuccessResponseFromApp();

  var expectedMessage = {
    type: 'write',
    params: {
      captureUrl: captureUrl,
      captureDate: captureDate,
      dataUrl: dataUrl,
      metadata: metadata
    }
  };

  var messaging = require('../../../app/scripts/app-bridge/messaging');
  var sendMessageToAppSpy = sinon.stub().callsArgWith(
    1, expectedResponseFromApp
  );
  messaging.sendMessageToApp = sendMessageToAppSpy;
  messaging.setTimeout = sinon.stub();

  messaging.savePage(captureUrl, captureDate, dataUrl, metadata)
  .then(actualResp => {
    t.deepEqual(sendMessageToAppSpy.args[0][0], expectedMessage);
    t.deepEqual(actualResp, expectedResponseFromApp);
    t.end();
    resetMessaging();  
  });
});

test('savePage rejects if times out', function(t) {
  var expectedErr = messaging.MSG_TIMEOUT;
  var timeout = 1456;

  var setTimeoutSpy = sinon.stub().callsArg(0);
  messaging.setTimeout = setTimeoutSpy;
  // In this case we never invoke the callback.
  var sendMessageToAppSpy = sinon.stub();
  messaging.sendMessageToApp = sendMessageToAppSpy;

  messaging.savePage('url', 'date', 'dataurl', 'so meta', timeout)
    .catch(actualErr => {
      t.deepEqual(actualErr, expectedErr);
      t.equal(setTimeoutSpy.args[0][1], timeout);
      t.equal(sendMessageToAppSpy.callCount, 1);
      t.end();
      resetMessaging();
    });
});

test('savePage rejects if write fails', function(t) {
  var errFromApp = {
    type: 'write',
    result: 'error',
    err: 'something done gone wrong'
  };
  var timeout = 7776;

  var setTimeoutSpy = sinon.stub();
  messaging.setTimeout = setTimeoutSpy;
  var sendMessageToAppSpy = sinon.stub().callsArgWith(1, errFromApp);
  messaging.sendMessageToApp = sendMessageToAppSpy;

  messaging.savePage('url', 'date', 'dataurl', 'so meta', timeout)
    .catch(actualErr => {
      t.deepEqual(actualErr, errFromApp);
      t.equal(setTimeoutSpy.args[0][1], timeout);
      t.equal(sendMessageToAppSpy.callCount, 1);
      t.end();
      resetMessaging();
    });
});

test('savePage resolves if callback invoked', function(t) {
  var successFromApp = {
    type: 'write',
    result: 'success',
  };
  var timeout = 8675309;

  var setTimeoutSpy = sinon.stub();
  messaging.setTimeout = setTimeoutSpy;
  var sendMessageToAppSpy = sinon.stub().callsArgWith(1, successFromApp);
  messaging.sendMessageToApp = sendMessageToAppSpy;

  messaging.savePage('url', 'date', 'dataurl', 'so meta', timeout)
    .then(resp => {
      t.deepEqual(resp, successFromApp);
      t.equal(setTimeoutSpy.args[0][1], timeout);
      t.equal(sendMessageToAppSpy.callCount, 1);
      t.end();
      resetMessaging();
    });
});

test('openUrl calls chromeTabs correctly', function(t) {
  var updateSpy = sinon.spy();

  proxyquireMessaging({
    '../chrome-apis/tabs': {
      update: updateSpy
    }
  });

  var url = 'url to open';
  messaging.openUrl(url);

  t.equal(updateSpy.args[0][0], url);
  t.end();
  resetMessaging();
});

test('onMessageExternalCallback responds to type open', function(t) {
  var callback = sinon.spy();
  var openUrlSpy = sinon.spy();
  var messaging = require('../../../app/scripts/app-bridge/messaging');
  messaging.openUrl = openUrlSpy;

  var message = {
    type: 'open',
    params: {
      url: 'url to open'
    }
  };
  var sender = {
    id: messaging.APP_ID
  };

  messaging.onMessageExternalCallback(message, sender, callback);
  t.deepEqual(openUrlSpy.args[0][0], message.params.url);
  t.true(callback.calledOnce);
  t.end();
  resetMessaging();
});
