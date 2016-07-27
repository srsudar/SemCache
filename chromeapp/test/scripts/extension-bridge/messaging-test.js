'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

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


