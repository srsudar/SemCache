/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

// Get this from the app to generate objects like the app expects.
const mutil = require('../../../../chromeapp/test/scripts/extension-bridge/test-util');
const util = require('../test-util');

let api = require('../../../app/scripts/popup/popup-api');


/**
 * Proxyquire the api object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../../app/scripts/popup/popup-api',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetApi() {
  delete require.cache[
    require.resolve('../../../app/scripts/popup/popup-api')
  ];
  api = require('../../../app/scripts/popup/popup-api');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetApi();
}

test('saveCurrentPage resolves if saveTab resolves', function(t) {
  let tab = util.genTabs(1).next().value;
  let expected = 'donezo';

  let saveTabStub = sinon.stub();
  saveTabStub.withArgs('popup', tab).resolves(expected);

  proxyquireApi({
    '../util/util': {
      getActiveTab: sinon.stub().resolves(tab)
    },
    '../persistence/datastore': {
      saveTab: saveTabStub
    }
  });

  api.saveCurrentPage()
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('saveCurrentPage rejects', function(t) {
  let expected = { msg: 'went wrong as expected' };

  let getActiveTabSpy = sinon.stub().rejects(expected);
  
  proxyquireApi({
    '../util/util': {
      getActiveTab: getActiveTabSpy
    }
  });

  api.saveCurrentPage()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('waitForCurrentPageToLoad calls sendMessage and resolves', function(t) {
  let activeTab = { id: 156 };
  let getActiveTabSpy = sinon.stub().resolves(activeTab);
  let messageForContentScript = { hello: 'how long did it take you to load?' };
  let expected = { msg: 'I come from the content script' };

  let sendArgs = [];
  let sendMessageSpy = function(tabId, message, callback) {
    sendArgs.push(tabId);
    sendArgs.push(message);
    sendArgs.push(callback);
    callback(expected);
  };

  proxyquireApi({
    '../chrome-apis/tabs': {
      sendMessage: sendMessageSpy
    },
    '../util/util': {
      getActiveTab: getActiveTabSpy
    }
  });
  api.createLoadMessage = sinon.stub().returns(messageForContentScript);


  api.waitForCurrentPageToLoad()
    .then(actual => {
      t.deepEqual(actual, expected);
      t.deepEqual(sendArgs[0], activeTab.id);
      t.deepEqual(sendArgs[1], messageForContentScript);
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});

test('getLocalPageInfo resolves with single CPInfo', function(t) {
  let { i: initiator, r: responder } = mutil.getLocalQueryMsgs();
  // We only want one. Delete the extras to avoid test flakiness.
  delete responder.body[initiator.params.urls[1]];
  delete responder.body[initiator.params.urls[2]];

  let expected = responder.body[initiator.params.urls[0]];

  let tab = util.genTabs(1).next().value;

  let localQueryStub = sinon.stub();
  localQueryStub
    .withArgs('popup', [tab.url])
    .resolves(responder.body);

  proxyquireApi({
    '../util/util': {
      getActiveTab: sinon.stub().resolves(tab)
    },
    '../app-bridge/messaging': {
      queryForPagesLocally: localQueryStub
    }
  });

  api.getLocalPageInfo()
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getLocalPageInfo rejects if error', function(t) {
  let expected = { err: 'sigh.' };
  proxyquireApi({
    '../util/util': {
      getActiveTab: sinon.stub().throws(expected)
    }
  });

  api.getLocalPageInfo()
  .then(result => {
    t.fail(result);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});

test('getLocalPageInfo resolves with null if no page', function(t) {
  let { r: responder } = mutil.getLocalQueryMsgs();
  responder.body = {};

  let tab = util.genTabs(1).next().value;

  let localQueryStub = sinon.stub();
  localQueryStub
    .withArgs('popup', [tab.url])
    .resolves(responder.body);

  proxyquireApi({
    '../util/util': {
      getActiveTab: sinon.stub().resolves(tab)
    },
    '../app-bridge/messaging': {
      queryForPagesLocally: localQueryStub
    }
  });

  api.getLocalPageInfo()
  .then(actual => {
    t.equal(actual, null);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('openCachedPage calls open and resolves', function(t) {
  let serviceName = 'heyo';
  let href = 'foobar.com';

  let expected = { msg: 'hello from app' };
  let sendMessageSpy = sinon.stub();
  sendMessageSpy
    .withArgs('popup', serviceName, href)
    .resolves(expected);

  proxyquireApi({
    '../app-bridge/messaging': {
      sendMessageToOpenPage: sendMessageSpy
    }
  });

  api.openCachedPage(serviceName, href)
  .then(actual => {
    t.equal(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('openCachedPage rejects if send message rejects', function(t) {
  let cachedPage = {
    accessPath: 'getMeHere'
  };
  let expected = { msg: 'big trubs!' };
  let sendMessageSpy = sinon.stub().withArgs(cachedPage).rejects(expected);

  proxyquireApi({
    '../app-bridge/messaging': {
      sendMessageToOpenPage: sendMessageSpy
    }
  });

  api.openCachedPage(cachedPage)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
