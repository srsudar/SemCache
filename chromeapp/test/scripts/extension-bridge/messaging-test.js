'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');
var messaging = require('../../../app/scripts/extension-bridge/messaging');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetMessaging() {
  delete require.cache[
    require.resolve('../../../app/scripts/extension-bridge/messaging')
  ];
  messaging = require('../../../app/scripts/extension-bridge/messaging');
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
  return { id: extensionId };
}

/**
 * Get a dummy value for a message to handle from the extension. Includes
 * properties such that handleExternalMessage() looks for.
 */
function getDummyWriteMessage() {
  return {
    type: 'write',
    params: {
      dataUrl: 'data url',
      captureUrl: 'capture url',
      metadata: { meta: 'data' }
    }
  };
}

function getDummyQueryMessage(url) {
  return {
    type: 'query',
    params: {
      url: url
    }
  };
}

function getDummyNetworkQueryMessage(urls) {
  return {
    type: 'network-query',
    params: {
      urls: urls
    }
  };
}

/**
 * Proxyquire the messaging module with proxies set as the proxied modules.
 */
function proxyquireMessaging(proxies, runtimeProxies) {
  proxies['../chrome-apis/chromep'] = {
    getRuntime: sinon.stub().returns(runtimeProxies),
  };
  messaging = proxyquire(
    '../../../app/scripts/extension-bridge/messaging',
    proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetMessaging();
}

test('handleExternalMessage returns false if response undefined', function(t) {
  var message = getDummyWriteMessage();
  var sender = getSender();

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: sinon.stub().resolves()
    }
  });
  messaging.getBlobFromDataUrl = sinon.stub();

  var actual = messaging.handleExternalMessage(message, sender);

  t.false(actual);
  t.end();
  resetMessaging();
});

test('handleExternalMessage invokes response on success', function(t) {
  var message = getDummyWriteMessage();
  var sender = getSender();
  var expected = { hi: 'bye' };

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: sinon.stub().resolves()
    }
  });

  var createResponseSuccessSpy = sinon.stub().withArgs(expected)
    .returns(expected);
  messaging.createResponseSuccess = createResponseSuccessSpy;
  messaging.getBlobFromDataUrl = sinon.stub();

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    t.end();
    resetMessaging();
  };

  returnValue = messaging.handleExternalMessage(
    message, sender, callbackFromExtension
  );
});

test('handleExternalMessage invokes response on error', function(t) {
  var message = getDummyWriteMessage();
  var sender = getSender();
  var expected = { hi: 'bye' };
  var errFromDatastore = { msg: 'much wrong' };

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: sinon.stub().rejects(errFromDatastore)
    }
  });

  var createResponseErrorSpy = sinon.stub().withArgs(message, errFromDatastore)
    .returns(expected);
  messaging.createResponseError = createResponseErrorSpy;
  messaging.getBlobFromDataUrl = sinon.stub();

  // This will be set below but not checked until our callback is invoked.
  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    t.end();
    resetMessaging();
  };

  returnValue = messaging.handleExternalMessage(
    message, sender, callbackFromExtension
  );
});

test('handleExternalMessage adds page to cache for write', function(t) {
  var params = {
    captureUrl: 'www.example.com',
    captureData: 'some day',
    dataUrl: 'data:base64',
    metadata: { foo: 'bar', favicon: 'ugly' }
  };
  var message = {
    type: 'write',
    params: params
  };
  var addPageToCacheSpy = sinon.stub().resolves();

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: addPageToCacheSpy
    }
  });

  var blob = {binary: '101s', type: 'mhtml'};
  var getBlobFromDataUrlSpy = sinon.stub().returns(blob);
  messaging.getBlobFromDataUrl = getBlobFromDataUrlSpy;

  var sender = getSender();
  messaging.handleExternalMessage(message, sender);

  t.deepEqual(addPageToCacheSpy.args[0],
    [
      params.captureUrl,
      params.captureDate,
      blob,
      params.metadata
    ]
  );
  t.end();
});

test('handleExternalMessage returns result of query', function(t) {
  var url = 'http://tyrion.com';
  var queryMessage = getDummyQueryMessage(url);

  var cachedPage = {
    captureUrl: url,
    accessPath: 'comeFetchMeBro'
  };
  
  var expected = {
    type: 'query',
    result: 'success',
    response: cachedPage
  };

  messaging.performQuery = sinon.stub().withArgs(url).resolves(cachedPage);

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.deepEqual(messaging.performQuery.args[0], [queryMessage]);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    queryMessage, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage returns result of network query', function(t) {
  var urls = [ 'a.com', 'b.org' ];
  var message = getDummyNetworkQueryMessage(urls);

  var queryResult = 'heyo';

  var expected = {
    type: 'network-query',
    result: 'success',
    response: queryResult
  };

  messaging.queryLocalNetworkForUrls = sinon.stub().withArgs(message)
    .resolves(queryResult);

  var returnValue = null;
  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.deepEqual(messaging.queryLocalNetworkForUrls.args[0], [message]);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    message, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage responds with error if goes wrong', function(t) {
  var urls = [ 'a.com', 'b.org' ];
  var message = getDummyNetworkQueryMessage(urls);

  var expectedErr = { msg: 'local query went wrong' };

  var expected = {
    type: 'network-query',
    result: 'error',
    err: expectedErr
  };

  messaging.queryLocalNetworkForUrls = sinon.stub().withArgs(message)
    .rejects(expectedErr);

  var returnValue = null;
  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.deepEqual(messaging.queryLocalNetworkForUrls.args[0], [message]);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    message, getSender(), callbackFromExtension
  );
});

test('performQuery returns null if no match', function(t) {
  var cachedPages = [
    {
      captureUrl: 'foo',
      metadata: { fullUrl: 'foo' }
    },
    {
      captureUrl: 'bar',
      metadata: { fullUrl: 'bar' }
    }
  ];

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().resolves(cachedPages)
    }
  });

  messaging.performQuery(getDummyQueryMessage('url'))
  .then(actual => {
    t.equal(actual, null);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('performQuery returns CachedPage if matches', function(t) {
  var expected = {
    captureUrl: 'www.nytimes.com',
    accessPath: 'fetchmehere',
    metadata: {
      fullUrl: 'http://www.nytimes.com/story'
    }
  };

  var cachedPages = [
    {
      captureUrl: 'foo',
      metadata: { fullUrl: 'foo' }
    },
    {
      captureUrl: 'bar',
      metadata: { fullUrl: 'bar' }
    },
    expected
  ];

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().resolves(cachedPages)
    }
  });

  messaging.performQuery(getDummyQueryMessage('http://www.nytimes.com/story'))
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('performQuery rejects if something goes wrong', function(t) {
  var expected = { msg: 'uh oh' };

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().rejects(expected)
    }
  });

  messaging.performQuery(getDummyQueryMessage('url'))
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('urlsMatch returns true if same lacking scheme', function(t) {
  var actual = messaging.urlsMatch(
    'http://www.nytimes.com/story',
    'www.nytimes.com/story'
  );
  t.true(actual);
  end(t);
});

test('urlsMatch true for http vs https', function(t) {
  var actual = messaging.urlsMatch(
    'http://www.nytimes.com/story',
    'https://www.nytimes.com/story'
  );
  t.true(actual);
  end(t);
});

test('urlsMatch returns false if different resource', function(t) {
  var actual = messaging.urlsMatch(
    'www.nytimes.com/foo',
    'www.nytimes.com/bar'
  );
  t.false(actual);
  end(t);
});

test('urlsMatch return false for different domains', function(t) {
  var actual = messaging.urlsMatch('foo.com', 'bar.com');
  t.false(actual);
  end(t);
});

test('urlsMatch ignores trailing slash on a', function(t) {
  var a = 'www.tyrion.com/';
  var b = 'www.tyrion.com';
  t.true(messaging.urlsMatch(a, b));
  end(t);
});

test('urlsMatch ignores trailing slash on b', function(t) {
  var a = 'www.tyrion.com';
  var b = 'www.tyrion.com/';
  t.true(messaging.urlsMatch(a, b));
  end(t);
});

test('sendMessageToExtension calls sendMessage', function(t) {
  var sendMessageSpy = sinon.spy();
  proxyquireMessaging({}, { sendMessage: sendMessageSpy });

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

test('createResponseSuccess correct', function(t) {
  var message = {
    type: 'write',
  };
  var expected = {
    type: 'write',
    result: 'success'
  };

  var actual = messaging.createResponseSuccess(message);
  t.deepEqual(actual, expected);
  t.end();
});

test('createResponseError correct', function(t) {
  var message = { type: 'write' };
  var err = 'disk too fragmented--things are ruhl crazy over here';

  var expected = {
    type: 'write',
    result: 'error',
    err: err
  };

  var actual = messaging.createResponseError(message, err);
  t.deepEqual(actual, expected);
  t.end();
});

test('queryLocalNetworkForUrls rejects on error', function(t) {
  var expectedErr = { msg: 'query failed' };
  var urls = ['a', 'b'];
  var message = getDummyNetworkQueryMessage(urls);
  proxyquireMessaging({
    '../coalescence/manager': {
      queryForUrls: sinon.stub().withArgs(urls).rejects(expectedErr)
    }
  });

  messaging.queryLocalNetworkForUrls(message)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    end(t);
  });
});

test('queryLocalNetworkForUrls resolves with result', function(t) {
  var urls = [ 'bar.com', 'foo.com' ];

  var message = getDummyNetworkQueryMessage(urls);
  var expected = [ 'hooray', 'woohoo' ];
  proxyquireMessaging({
    '../coalescence/manager': {
      queryForUrls: sinon.stub().withArgs(urls).resolves(expected)
    }
  });

  messaging.queryLocalNetworkForUrls(message)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(actual => {
    t.fail(actual);
    end(t);
  });
});
