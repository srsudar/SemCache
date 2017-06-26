'use strict';

const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
require('sinon-as-promised');

let messaging = require('../../../app/scripts/extension-bridge/messaging');

const common = require('../../../app/scripts/extension-bridge/common-messaging');
const constants = require('../../../app/scripts/constants');
const mutil = require('./test-util');
const putil = require('../persistence/persistence-util');

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
  let messaging = require('../../../app/scripts/extension-bridge/messaging');
  let extensionId = messaging.EXTENSION_ID;
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
  let message = mutil.getAddPageMessage();
  let sender = getSender();

  proxyquireMessaging({
    '../persistence/datastore': {
      addPageToCache: sinon.stub().resolves()
    }
  });
  messaging.getBlobFromDataUrl = sinon.stub();

  let actual = messaging.handleExternalMessage(message, sender);

  t.false(actual);
  t.end();
  resetMessaging();
});

test('handleExternalMessage adds page to cache for write', function(t) {
  let { i: initiator, r: responder } = mutil.getAddPageMsgs();
  let sender = getSender();
  let cpdisk = putil.genCPDisks(1).next().value;

  let addPageToCacheSpy = sinon.stub();
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

  let returnValue;

  let callbackFromExtension = function(actual) {
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

  let returnValue;

  let callbackFromExtension = function(actual) {
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

  let returnValue;

  let callbackFromExtension = function(actual) {
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

  let returnValue;

  let callbackFromExtension = function(actual) {
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

  let returnValue;

  let callbackFromExtension = function(actual) {
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

  let returnValue;

  let callbackFromExtension = function(actual) {
    t.deepEqual(actual, expected);
    t.true(returnValue);
    end(t);
  };

  returnValue = messaging.handleExternalMessage(
    initiator, getSender(), callbackFromExtension
  );
});

test('handleOpenRequest correct', function(t) {
  let { i: initiator } = mutil.getOpenMsgs();
  let expected = 'result from appc';

  let saveStub = sinon.stub();
  saveStub
    .withArgs(initiator.params.serviceName, initiator.params.href)
    .resolves(expected);

  proxyquireMessaging({
    '../app-controller': {
      saveMhtmlAndOpen: saveStub
    }
  });

  messaging.handleOpenRequest(initiator)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('handleOpenRequest rejects on error', function(t) {
  let { i: initiator } = mutil.getOpenMsgs();
  let expected = { err: 'trouble' };

  proxyquireMessaging({
    '../app-controller': {
      saveMhtmlAndOpen: sinon.stub().rejects(expected)
    }
  });

  messaging.handleOpenRequest(initiator)
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('queryLocalMachineForUrls returns empty if no match', function(t) {
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
  cpinfos = cpinfos.map(info => info.asJSON());

  // We expect { url: [ cachedpage, ... ] } to keep the API the same with local
  // network queries.
  let foundCPInfo1 = Object.assign({}, cpinfos[0]);
  let foundCPInfo2 = Object.assign({}, cpinfos[3]);

  // Now add our service name shortcut to each of these.
  let serviceName = constants.SELF_SERVICE_SHORTCUT;
  foundCPInfo1.serviceName = serviceName;
  foundCPInfo2.serviceName = serviceName;

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

  let message = common.createLocalQueryMessage(
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
  let expected = { msg: 'uh oh' };

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

test('sendMessageToExtension calls sendMessage', function(t) {
  let sendMessageSpy = sinon.spy();
  proxyquireMessaging({}, { sendMessage: sendMessageSpy });

  let message = {hello: 'big fella'};

  messaging.sendMessageToExtension(message);
  t.equal(sendMessageSpy.args[0][0], messaging.EXTENSION_ID);
  t.deepEqual(sendMessageSpy.args[0][1], message);
  t.end();
  resetMessaging();
});

test('sendMessageToOpenUrl sends correct message', function(t) {
  let url = 'open me plz';
  let expectedMessage = {
    type: 'open',
    params: {
      url: url
    }
  };

  let messaging = require('../../../app/scripts/extension-bridge/messaging');
  let sendMessageToExtensionSpy = sinon.spy();
  messaging.sendMessageToExtension = sendMessageToExtensionSpy;
  messaging.sendMessageToOpenUrl(url);

  t.deepEqual(sendMessageToExtensionSpy.args[0][0], expectedMessage);
  t.end();
  resetMessaging();
});

test('queryLocalNetworkForUrls rejects on error', function(t) {
  let expectedErr = { msg: 'query failed' };
  let urls = ['a', 'b'];
  let message = common.createNetworkQueryMessage('popup', urls);

  let queryForUrlsStub = sinon.stub();
  queryForUrlsStub.withArgs(urls).rejects(expectedErr);
  proxyquireMessaging({
    '../coalescence/manager': {
      queryForUrls: queryForUrlsStub
    },
    '../app-controller': {
      SERVERS_STARTED: true
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
  let urls = [ 'bar.com', 'foo.com' ];

  let message = common.createNetworkQueryMessage('cs', urls);
  let expected = [ 'hooray', 'woohoo' ];

  let queryForUrlsStub = sinon.stub();
  queryForUrlsStub.withArgs(urls).resolves(expected);
  proxyquireMessaging({
    '../coalescence/manager': {
      queryForUrls: queryForUrlsStub
    },
    '../app-controller': {
      SERVERS_STARTED: true
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

test('queryLocalNetworkForUrls no-ops if not started', function(t) {
  // We don't want to query the network if we haven't started the app.
  proxyquireMessaging({
    '../app-controller': {
      SERVERS_STARTED: false
    }
  });

  let expected = {};
  messaging.queryLocalNetworkForUrls({})
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
