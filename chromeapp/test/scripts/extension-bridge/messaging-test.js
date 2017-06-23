'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

let messaging = require('../../../app/scripts/extension-bridge/messaging');
const common = require('../../../app/scripts/extension-bridge/common-messaging');

let mutil = require('./test-util');
let putil = require('../persistence/persistence-util');

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
  var message = mutil.getAddPageMessage();
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

// test.only('handleExternalMessage invokes response on success', function(t) {
//   let { initiator: i, responder: r } = mutil.getAddPageMsgs();
//   let cpdisk = putil.genCPDisks(1).next().value;
//   let sender = getSender();
//
//   proxyquireMessaging({
//     '../persistence/datastore': {
//       addPageToCache: sinon.stub().resolves()
//     }
//   });
//
//   var returnValue;
//
//   var callbackFromExtension = function(actual) {
//     t.deepEqual(actual, expected);
//     t.true(returnValue);
//     t.end();
//     resetMessaging();
//   };
//
//   returnValue = messaging.handleExternalMessage(
//     message, sender, callbackFromExtension
//   );
// });
//
// test('handleExternalMessage invokes response on error', function(t) {
//   var message = getDummyWriteMessage();
//   var sender = getSender();
//   var errFromDatastore = { msg: 'much wrong' };
//
//   proxyquireMessaging({
//     '../persistence/datastore': {
//       addPageToCache: sinon.stub().rejects(errFromDatastore)
//     }
//   });
//   let expected = messaging.createResponseError(message, errFromDatastore);
//
//   // This will be set below but not checked until our callback is invoked.
//   var returnValue;
//
//   var callbackFromExtension = function(actual) {
//     t.deepEqual(actual, expected);
//     t.true(returnValue);
//     t.end();
//     resetMessaging();
//   };
//
//   returnValue = messaging.handleExternalMessage(
//     message, sender, callbackFromExtension
//   );
// });

test('handleExternalMessage adds page to cache for write', function(t) {
  let { i: initiator, r: responder } = mutil.getAddPageMsgs();
  let sender = getSender();
  let cpdisk = putil.genCPDisks(1).next().value;

  var addPageToCacheSpy = sinon.stub();
  addPageToCacheSpy.withArgs(cpdisk).resolves();

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: addPageToCacheSpy
    }
  });

  messaging.handleExternalMessage(initiator, sender, function(actual) {
    t.deepEqual(actual, responder);
    end(t);
  });
});

test('handleExternalMessage rejects with error on write', function(t) {
  let { i: initiator } = mutil.getAddPageMsgs();
  let sender = getSender();
  let error = 'went wrong';
  let expected = common.createResponseError(
    common.responderTypes.addPageToCache, {}, error
  );

  let addPageToCacheSpy = sinon.stub();
  addPageToCacheSpy.rejects(error);

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: addPageToCacheSpy
    }
  });

  messaging.handleExternalMessage(initiator, sender, function(actual) {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('handleExternalMessage returns result of local query', function(t) {
  let { i: initiator, r: responder } = mutil.getLocalQueryMsgs();
  
  let queryStub = sinon.stub();
  queryStub.withArgs(initiator).resolves(responder.body);
  messaging.queryLocalMachineForUrls = queryStub;

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, responder);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage rejects on local query error', function(t) {
  let { i: initiator } = mutil.getLocalQueryMsgs();
  let error = 'uhoh';
  let expected = common.createResponseError(
    common.responderTypes.localQuery, {}, error
  );
  
  messaging.queryLocalMachineForUrls = sinon.stub().rejects(error);

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage returns result of network query', function(t) {
  let { i: initiator, r: responder } = mutil.getNetworkQueryMsgs();
  
  let queryStub = sinon.stub();
  queryStub.withArgs(initiator).resolves(responder.body);
  messaging.queryLocalNetworkForUrls = queryStub;

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, responder);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage rejects on network query error', function(t) {
  let { i: initiator } = mutil.getNetworkQueryMsgs();
  let error = 'uhoh';
  let expected = common.createResponseError(
    common.responderTypes.networkQuery, {}, error
  );
  
  messaging.queryLocalNetworkForUrls = sinon.stub().rejects(error);

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage correct for open', function(t) {
  let { i: initiator, r: responder } = mutil.getOpenMsgs();
  
  let handleOpenStub = sinon.stub();
  handleOpenStub.withArgs(initiator).resolves(responder.body);
  messaging.handleOpenRequest = handleOpenStub;

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, responder);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleExternalMessage rejects on error for open', function(t) {
  let { i: initiator } = mutil.getOpenMsgs();
  let error = 'could not find page';
  let expected = common.createResponseError(
    common.responderTypes.openPage, {}, error
  );
  
  messaging.handleOpenRequest = sinon.stub().rejects(error);

  var returnValue;

  var callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('queryLocalNetworkForUrls returns empty if no match', function(t) {
  let cpinfos = [...putil.genCPInfos(10)];

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().resolves(cpinfos)
    }
  });

  let msg = common.createLocalQueryMessage('popup', ['nobody']);

  messaging.queryLocalMachineForUrls(msg)
  .then(actual => {
    t.deepEqual(actual, {});
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryLocalMachineForUrls returns all matches', function(t) {
  // We'll say that 5 pages are saved locally. We'll query for two of those.
  let num = 5;
  let cpinfos = [...putil.genCPInfos(num)];

  // We expect { url: [ cachedpage, ... ] } to keep the API the same with local
  // network queries.
  let foundCPInfo1 = cpinfos[0];
  let foundCPInfo2 = cpinfos[3];
  let foundUrl1 = foundCPInfo1.captureHref;
  let foundUrl2 = foundCPInfo2.captureHref;

  let expected = {
    [foundUrl1]: [foundCPInfo1],
    [foundUrl2]: [foundCPInfo2]
  };

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().resolves(cpinfos)
    }
  });

  var message = common.createLocalQueryMessage(
    'popup', [ foundUrl1, foundUrl2 ]
  );

  messaging.queryLocalMachineForUrls(message)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryLocalMachineForUrls rejects if something goes wrong', function(t) {
  var expected = { msg: 'uh oh' };

  proxyquireMessaging({
    '../persistence/datastore': {
      getAllCachedPages: sinon.stub().rejects(expected)
    }
  });
  
  let msg = common.createLocalQueryMessage('popup', ['url']);

  messaging.queryLocalMachineForUrls(msg)
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

test('queryLocalNetworkForUrls rejects on error', function(t) {
  var expectedErr = { msg: 'query failed' };
  var urls = ['a', 'b'];
  let message = common.createNetworkQueryMessage('popup', urls);
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

  var message = common.createNetworkQueryMessage('cs', urls);
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
