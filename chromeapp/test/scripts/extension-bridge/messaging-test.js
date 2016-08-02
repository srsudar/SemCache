'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetMessaging() {
  delete require.cache[
    require.resolve('../../../app/scripts/extension-bridge/messaging')
  ];
}

/**
 * Return a MessageSender object from our extension.
 */
function getSender() {
  var messaging = require('../../../app/scripts/extension-bridge/messaging');
  var extensionId = messaging.EXTENSION_ID;
  delete require.cache[
    require.resolve('../../../app/scripts/extension-bridge/messaging')
  ];
  return {id: extensionId};

}

test('handleExternalMessage adds page to cache for write', function(t) {
  var params = {
    captureUrl: 'www.example.com',
    captureData: 'some day',
    dataUrl: 'data:base64'
  };
  var message = {
    type: 'write',
    params: params
  };
  var addPageToCacheSpy = sinon.spy();

  var messaging = proxyquire(
    '../../../app/scripts/extension-bridge/messaging',
    {
      '../persistence/datastore': {
        addPageToCache: addPageToCacheSpy
      }
    }
  );
  var blob = {binary: '101s', type: 'mhtml'};
  var getBlobFromDataUrlSpy = sinon.stub().returns(blob);
  messaging.getBlobFromDataUrl = getBlobFromDataUrlSpy;

  var sender = getSender();
  messaging.handleExternalMessage(message, sender);

  t.deepEqual(addPageToCacheSpy.args[0],
    [
      params.captureUrl,
      params.captureDate,
      blob
    ]
  );
  t.end();
});

test('sendMessageToExtension calls sendMessage', function(t) {
  var sendMessageSpy = sinon.spy();
  var messaging = proxyquire('../../../app/scripts/extension-bridge/messaging',
    {
      '../chrome-apis/runtime': {
        sendMessage: sendMessageSpy
      }
    }
  );

  var message = {hello: 'big fella'};

  messaging.sendMessageToExtension(message);
  t.equal(sendMessageSpy.args[0][0], messaging.EXTENSION_ID);
  t.deepEqual(sendMessageSpy.args[0][1], message);
  t.end();
  resetMessaging();
});

test('sendMessageToOpenUrl sends correct message', function(t) {
  var url = 'open me plz';
  var expectedMessage = {
    type: 'open',
    params: {
      url: url
    }
  };

  var messaging = require('../../../app/scripts/extension-bridge/messaging');
  var sendMessageToExtensionSpy = sinon.spy();
  messaging.sendMessageToExtension = sendMessageToExtensionSpy;
  messaging.sendMessageToOpenUrl(url);

  t.deepEqual(sendMessageToExtensionSpy.args[0][0], expectedMessage);
  t.end();
  resetMessaging();
});
