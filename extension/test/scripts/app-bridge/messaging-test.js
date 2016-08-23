/*jshint esnext:true*/
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
function resetMessaging() {
  delete require.cache[
    require.resolve('../../../app/scripts/app-bridge/messaging')
  ];
}

test('sendMessageToApp calls chromeRuntime', function(t) {
  var sendMessageSpy = sinon.spy();
  var messaging = proxyquire('../../../app/scripts/app-bridge/messaging',
    {
      '../chromeRuntime': {
        sendMessage: sendMessageSpy
      }
    }
  );

  var message = {hello: 'world'};
  messaging.sendMessageToApp(message);

  t.equal(sendMessageSpy.args[0][0], messaging.APP_ID);
  t.deepEqual(sendMessageSpy.args[0][1], message);
  t.end();
});

test('savePage sends correct message', function(t) {
  var captureUrl = 'someurl';
  var captureDate = 'why-not-today';
  var dataUrl = 'data:url';
  var metadata = { hello: 'how are you doing', three: 3 };

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
  var sendMessageToAppSpy = sinon.spy();
  messaging.sendMessageToApp = sendMessageToAppSpy;

  messaging.savePage(captureUrl, captureDate, dataUrl, metadata);
  t.deepEqual(sendMessageToAppSpy.args[0][0], expectedMessage);
  t.end();
  resetMessaging();  
});

test('openUrl calls chromeTabs correctly', function(t) {
  var updateSpy = sinon.spy();

  var messaging = proxyquire('../../../app/scripts/app-bridge/messaging',
    {
      '../chromeTabs': {
        update: updateSpy
      }
    }
  );

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
