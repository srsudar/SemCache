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

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetMessaging();
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

test('sendMessageForResponse resolves on success', function(t) {
  var expected = { msg: 'I am from app' };
  var message = { msg: 'I am for app' };

  var sendMessageToAppSpy = sinon.stub().callsArgWith(
    1, expected
  );
  messaging.sendMessageToApp = sendMessageToAppSpy;
  messaging.setTimeout = sinon.stub();

  messaging.sendMessageForResponse(message, 100)
  .then(actual => {
    t.deepEqual(sendMessageToAppSpy.args[0][0], message);
    t.deepEqual(actual, expected);
    end(t);
  }).catch(err => {
    t.fail(err);
    end(t);
  });
});

test('sendMessageForResponse rejects if timeout', function(t) {
  var expectedErr = new Error(messaging.MSG_TIMEOUT);
  var timeout = 2468;

  var setTimeoutSpy = sinon.stub().callsArg(0);
  messaging.setTimeout = setTimeoutSpy;
  // In this case we never invoke the callback.
  var sendMessageToAppSpy = sinon.stub();
  messaging.sendMessageToApp = sendMessageToAppSpy;
  var message = { msg: 'for app' };

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
  var expected = { msg: 'went wrong' };

  var sendMessageToAppSpy = sinon.stub().throws(expected);
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
  var timeout = 5555;
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

  var sendMessageForResponseSpy = sinon.stub()
    .resolves(expectedResponseFromApp);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.savePage(captureUrl, captureDate, dataUrl, metadata, timeout)
  .then(actual => {
    t.deepEqual(sendMessageForResponseSpy.args[0], [expectedMessage, timeout]);
    t.deepEqual(actual, expectedResponseFromApp);
    t.end();
    resetMessaging();  
  });
});

test('savePage rejects if sendMessageForResponse rejects', function(t) {
  var expected = { msg: 'we are rejecting' };

  var sendMessageForResponseSpy = sinon.stub().rejects(expected);
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
  var errFromApp = {
    type: 'write',
    result: 'error',
    err: 'something done gone wrong'
  };

  var sendMessageForResponseSpy = sinon.stub().resolves(errFromApp);
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

test('isPageSaved resolves response from app', function(t) {
  var timeout = 7887;
  var url = 'www.nytimes.com';
  var options = { localhost: true };
  var message = {
    type: 'query',
    params: {
      url: url,
      options: options 
    }
  };

  var expected = { msg: 'why yes! it is available' };
  var sendMessageForResponseSpy = sinon.stub().resolves(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.isPageSaved(url, options, timeout)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(sendMessageForResponseSpy.args[0], [message, timeout]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('isPageSaved rejects if sendMessageForResponse rejects', function(t) {
  var url = 'carefullycraftedtobreak.com';
  var options = { localhost: false };

  var expected = { msg: 'you little devil!' };
  var sendMessageForResponseSpy = sinon.stub().rejects(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.isPageSaved(url, options)
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

test('queryForPagesOnNetwork resolves response from app', function(t) {
  var timeout = 4444;
  var urls = ['a', 'b'];
  var message = {
    type: 'network-query',
    params: {
      urls: urls
    }
  };

  var expected = { msg: 'all are ready' };
  var sendMessageForResponseSpy = sinon.stub().resolves(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.queryForPagesOnNetwork(urls, timeout)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(sendMessageForResponseSpy.args[0], [message, timeout]);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryForPagesOnNetwork rejects correctly', function(t) {
  var urls = ['oh', 'no'];

  var expected = { msg: 'dun gawn rong' };
  var sendMessageForResponseSpy = sinon.stub().rejects(expected);
  messaging.sendMessageForResponse = sendMessageForResponseSpy;

  messaging.isPageSaved(urls)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
