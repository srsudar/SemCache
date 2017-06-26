/*jshint esnext:true*/
'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

const mutil = require('../../../../chromeapp/test/scripts/extension-bridge/test-util');

let messaging = require('../../../app/scripts/app-bridge/messaging');

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

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetMessaging();
}

test('sendMessageToApp calls chromeRuntime', function(t) {
  let sendMessageSpy = sinon.spy();
  proxyquireMessaging({
    '../chrome-apis/runtime': {
      sendMessage: sendMessageSpy
    }
  });

  let message = {hello: 'world'};
  let callback = 'much fancy';
  messaging.sendMessageToApp(message, callback);

  t.equal(sendMessageSpy.args[0][0], messaging.APP_ID);
  t.deepEqual(sendMessageSpy.args[0][1], message);
  t.deepEqual(sendMessageSpy.args[0][2], callback);
  t.end();
});

test('sendMessageForResponse resolves on success', function(t) {
  let { i: initiator, r: responder } = mutil.getOpenMsgs();
  let timeout = 100;

  let sendMessageToAppSpy = sinon.stub().callsArgWith(1, responder);
  messaging.sendMessageToApp = sendMessageToAppSpy;
  messaging.setTimeout = sinon.stub();

  messaging.sendMessageForResponse(initiator, timeout)
  .then(actual => {
    t.deepEqual(sendMessageToAppSpy.args[0][0], initiator);
    t.deepEqual(actual, responder);
    end(t);
  }).catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendMessageForResponse rejects if message is error', function(t) {
  let { i: initiator } = mutil.getOpenMsgs();
  let expected = mutil.getPageOpenError();
  let sendMessageToAppSpy = sinon.stub().callsArgWith(1, expected);

  messaging.sendMessageToApp = sendMessageToAppSpy;
  messaging.setTimeout = sinon.stub();

  messaging.sendMessageForResponse(initiator)
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendMessageForResponse rejects if timeout', function(t) {
  let expectedErr = new Error(messaging.MSG_TIMEOUT);
  let timeout = 2468;

  let setTimeoutSpy = sinon.stub().callsArg(0);
  messaging.setTimeout = setTimeoutSpy;
  // In this case we never invoke the callback.
  let sendMessageToAppSpy = sinon.stub();
  messaging.sendMessageToApp = sendMessageToAppSpy;
  let message = { msg: 'for app' };

  messaging.sendMessageForResponse(message, timeout)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actualErr => {
    t.deepEqual(actualErr, expectedErr);
    t.equal(setTimeoutSpy.args[0][1], timeout);
    t.equal(sendMessageToAppSpy.callCount, 1);
    end(t);
  });
});

test('sendMessageForResponse rejects if something goes wrong', function(t) {
  let expected = { msg: 'went wrong' };

  let sendMessageToAppSpy = sinon.stub().throws(expected);
  messaging.sendMessageToApp = sendMessageToAppSpy;

  messaging.sendMessageForResponse({ msg: 'for app' })
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.equal(sendMessageToAppSpy.callCount, 1);
    t.end();
    resetMessaging();
  });
});

test('savePage sends correct message and resolves', function(t) {
  let { i: initiator, r: responder } = mutil.getAddPageMsgs();
  let timeout = 7887;

  let sendMessageForResponseSpy = sinon.stub();
  sendMessageForResponseSpy
    .withArgs(initiator, timeout)
    .resolves(responder);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.savePage('popup', initiator.params.cachedPage, timeout)
  .then(actual => {
    t.deepEqual(actual, responder.body);
    t.end();
    resetMessaging();  
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('savePage rejects if sendMessageForResponse rejects', function(t) {
  let expected = { msg: 'we are rejecting' };

  let sendMessageForResponseSpy = sinon.stub().rejects(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.savePage('url', 'date', 'dataurl', 'so meta')
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.equal(sendMessageForResponseSpy.callCount, 1);
    end(t);
  });
});

test('savePage rejects if write fails', function(t) {
  let errFromApp = {
    type: 'write',
    result: 'error',
    err: 'something done gone wrong'
  };

  let sendMessageForResponseSpy = sinon.stub().rejects(errFromApp);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.savePage('url', 'date', 'dataurl', 'so meta')
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, errFromApp);
    t.equal(sendMessageForResponseSpy.callCount, 1);
    end(t);
  });
});

test('queryForPagesLocally resolves response from app', function(t) {
  let { i: initiator, r: responder } = mutil.getLocalQueryMsgs();
  let timeout = 7887;
  let urls = initiator.params.urls;

  let sendMessageForResponseSpy = sinon.stub();
  sendMessageForResponseSpy.withArgs(initiator, timeout).resolves(responder);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.queryForPagesLocally('popup', urls, timeout)
  .then(actual => {
    t.deepEqual(actual, responder.body);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryForPagesLocally rejects correctly', function(t) {
  let expected = { msg: 'you little devil!' };
  let sendMessageForResponseSpy = sinon.stub().rejects(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.queryForPagesLocally('popup', [])
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('openUrl calls chromeTabs correctly', function(t) {
  let updateSpy = sinon.spy();

  proxyquireMessaging({
    '../chrome-apis/tabs': {
      update: updateSpy
    }
  });

  let url = 'url to open';
  messaging.openUrl(url);

  t.equal(updateSpy.args[0][0], url);
  t.end();
  resetMessaging();
});

test('onMessageExternalCallback responds to type open', function(t) {
  let callback = sinon.spy();
  let openUrlSpy = sinon.spy();
  let messaging = require('../../../app/scripts/app-bridge/messaging');
  messaging.openUrl = openUrlSpy;

  let message = {
    type: 'open',
    params: {
      url: 'url to open'
    }
  };
  let sender = {
    id: messaging.APP_ID
  };

  messaging.onMessageExternalCallback(message, sender, callback);
  t.deepEqual(openUrlSpy.args[0][0], message.params.url);
  t.true(callback.calledOnce);
  t.end();
  resetMessaging();
});

test('queryForPagesOnNetwork resolves response from app', function(t) {
  let timeout = 100;
  let { i: initiator, r: responder } = mutil.getNetworkQueryMsgs();

  let sendMessageForResponseSpy = sinon.stub();
  sendMessageForResponseSpy.withArgs(initiator, timeout).resolves(responder);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  let urls = initiator.params.urls;
  messaging.queryForPagesOnNetwork('popup', urls, timeout)
  .then(actual => {
    t.deepEqual(actual, responder.body);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryForPagesOnNetwork rejects correctly', function(t) {
  let urls = ['oh', 'no'];

  let expected = { msg: 'dun gawn rong' };
  let sendMessageForResponseSpy = sinon.stub().rejects(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.queryForPagesOnNetwork(urls)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('sendMessageToOpenPage resolves', function(t) {
  let timeout = 100;
  let { i: initiator, r: responder } = mutil.getOpenMsgs();

  let serviceName = initiator.params.serviceName;
  let href = initiator.params.href;

  let sendMessageForResponseSpy = sinon.stub();
  sendMessageForResponseSpy.withArgs(initiator, timeout).resolves(responder);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.sendMessageToOpenPage('popup', serviceName, href, timeout)
  .then(actual => {
    t.deepEqual(actual, responder.body);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
