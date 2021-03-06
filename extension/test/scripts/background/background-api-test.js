/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const tutil = require('../../../../chromeapp/test/scripts/extension-bridge/test-util');

let api = require('../../../app/scripts/background/background-api');


/**
 * Proxyquire the api object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../../app/scripts/background/background-api',
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
    require.resolve('../../../app/scripts/background/background-api')
  ];
  api = require('../../../app/scripts/background/background-api');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  resetApi();
}

function createDetailsObject(frameId, transitionType) {
  return {
    frameId: frameId,
    transitionType: transitionType
  };
}

test('savePageForContentScript resolves if saveTab resolves', function(t) {
  var tab = { tabId: 1234 };

  var start = 100;
  var end = 103;
  var totalTime = end - start;

  var expected = { timeToWrite: totalTime };

  var saveTabSpy = sinon.stub().withArgs(tab).resolves();
  var getNowSpy = sinon.stub();
  getNowSpy.onCall(0).returns(start);
  getNowSpy.onCall(1).returns(end);

  proxyquireApi({
    '../popup/popup-api': {
      saveTab: saveTabSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      getNow: getNowSpy
    }
  });

  api.savePageForContentScript(tab)
    .then(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});

test('savePageForContentScript rejects if saveTab rejects', function(t) {
  var tab = { tabId: 1234 };

  var expected = { msg: 'done gone wrong' };

  var saveTabSpy = sinon.stub().withArgs(tab).rejects(expected);
  var getNowSpy = sinon.stub();

  proxyquireApi({
    '../popup/popup-api': {
      saveTab: saveTabSpy
    },
    '../../../../chromeapp/app/scripts/evaluation': {
      getNow: getNowSpy
    }
  });

  api.savePageForContentScript(tab)
    .catch(actual => {
      t.deepEqual(actual, expected);
      t.end();
      resetApi();
    });
});

test('queryForPage resolves if not present', function(t) {
  var tabId = 4;
  var url = 'www.nyt.com';

  var queryLocallySpy = sinon.stub();
  queryLocallySpy.withArgs('background', [url]).resolves({});

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: queryLocallySpy
    }
  });

  api.queryForPage(tabId, url)
  .then(actual => {
    t.equal(actual, null);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryForPage resolves if page present', function(t) {
  var tabId = 4;

  let { r: responder } = tutil.getLocalQueryMsgs();
  // Body is url: [ cpinfo ]

  let url = Object.keys(responder.body)[0];
  let appMsgResult = responder.body[url];

  let expected = responder.body[url];

  var queryLocallySpy = sinon.stub();
  queryLocallySpy.withArgs('background', [url]).resolves(appMsgResult);

  var setIconSpy = sinon.stub();
  var sendMessageSpy = sinon.stub();

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: queryLocallySpy
    },
    '../chrome-apis/tabs': {
      sendMessage: sendMessageSpy
    },
    '../chrome-apis/browser-action': {
      setIcon: setIconSpy
    }
  });

  api.queryForPage(tabId, url)
  .then(actual => {
    t.deepEqual(actual, expected);
    t.deepEqual(
      setIconSpy.args[0],
      [{
        path: 'images/cloud-off-24.png',
        tabId: tabId
      }]
    );
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('queryForPage rejects if error', function(t) {
  var tabId = 4;
  var url = 'www.nyt.com';
  var expected = { msg: 'much trouble' };

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: sinon.stub().rejects(expected)
    }
  });

  api.queryForPage(tabId, url)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('isNavOfInterest false for not main frame', function(t) {
  var details = createDetailsObject(1, '');
  t.false(api.isNavOfInterest(details));
  end(t);
});

test('isNavOfInterest false for forbidden type', function(t) {
  var details = createDetailsObject(0, 'generated');
  t.false(api.isNavOfInterest(details));
  end(t);
});

test('isNavOfInterest true for top level basic type', function(t) {
  var details = createDetailsObject(0, 'typed');
  t.true(api.isNavOfInterest(details));
  end(t);
});

test(
  'onMessageCallback responds to type savePageForContentScript',
  function(t)
{
  var expected = { totalTimeToWrite: 9987.12 };
  var savePageForContentScriptSpy = sinon.stub().resolves(expected);
  
  api.savePageForContentScript = savePageForContentScriptSpy;

  var message = {
    type: 'savePageForContentScript',
    params: {
      url: 'url to open'
    }
  };
  var sender = {
    tab: { tabId: 54321 }
  };

  var callCount = 0;
  var callback = function(response) {
    callCount += 1;
    t.deepEqual(savePageForContentScriptSpy.args[0], [sender.tab]);
    t.equal(savePageForContentScriptSpy.callCount, 1);

    t.equal(response, expected);
    t.equal(callCount, 1);
    end(t);
  };

  api.onMessageCallback(message, sender, callback);
});

test('onMessageCallback routes message for query from popup', function(t) {
  var msg = {
    from: 'popup',
    type: 'queryForPage',
    params: {
      foo: 'bar'
    }
  };
  var callback = sinon.stub();

  var queryForPageWithCallbackSpy = sinon.stub();
  api.queryForPageWithCallback = queryForPageWithCallbackSpy;

  var actual = api.onMessageCallback(msg, null, callback);

  // We should return true to inform that we are handling this asynchronously.
  t.true(actual);
  t.deepEqual(queryForPageWithCallbackSpy.args[0], [msg.params, callback]);
  end(t);
});

test('queryForPageWithCallback handles success', function(t) {
  var params = {
    url: 'http://foo.com',
    tabId: 123
  };

  var localPageInfo = { hello: 'i am the page' };
  var expected = {
    from: 'background-script',
    status: 'success',
    result: localPageInfo
  };

  api.queryForPage = sinon.stub().withArgs(params.tabId, params.url)
    .resolves(localPageInfo);

  function callback(actual) {
    t.deepEqual(actual, expected);
    end(t);
  }

  api.queryForPageWithCallback(params, callback);
});

test('queryForPageWithCallback handles failure', function(t) {
  var params = {
    url: 'http://bar.com',
    tabId: 333
  };

  var error = { msg: 'I am an error' };
  var expected = {
    from: 'background-script',
    status: 'error',
    result: error
  };

  api.queryForPage = sinon.stub().withArgs(params.tabId, params.url)
    .rejects(expected.result);

  function callback(actual) {
    t.deepEqual(actual, expected);
    end(t);
  }

  api.queryForPageWithCallback(params, callback);
});
