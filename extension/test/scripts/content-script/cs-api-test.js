/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

// Cannot require this without stubbing out proxyquire, b/c it does some
// annoying auto-invoking stuff that relies on document.
let api = require('../../../app/scripts/content-script/cs-api');


/**
 * Proxyquire the datastore object with proxies passed as the proxied modules.
 */
function proxyquireApi(proxies) {
  api = proxyquire(
    '../../../app/scripts/content-script/cs-api',
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
    require.resolve('../../../app/scripts/content-script/cs-api')
  ];
  api = require('../../../app/scripts/content-script/cs-api');
}

function end(t) {
  if (!t) { throw new Error('You did not pass t'); }
  t.end();
  resetApi();
}

test('onMessageHandler returns true and calls handleLoadMessage', function(t) {
  let message = { type: 'readystateComplete' };
  let sender = 'sender';
  let callback = 'callback';
  let handleLoadMessageSpy = sinon.stub();
  api.handleLoadMessage = handleLoadMessageSpy;

  let actual = api.onMessageHandler(message, sender, callback);

  t.true(actual);  // true to say we'll handle it asynchronously
  t.deepEqual(handleLoadMessageSpy.args[0], [message, sender, callback]);
  t.end();
});

test(
  'onMessageHandler returns false and calls handleQueryResultMessage',
  function(t) {
    let message = {
      type: 'queryResult'
    };

    let sender = 'sender';
    let callback = 'callback';
    api.handleQueryResultMessage = sinon.stub();

    let actual = api.onMessageHandler(message, sender, callback);
    t.false(actual);
    t.deepEqual(
      api.handleQueryResultMessage.args[0],
      [message, sender, callback]
    );
    end(t);
  }
);

test('onMessageHandler returns true and calls handleQueryFromPopup',
  function(t) {
    let message = {
      type: 'queryForPage',
      from: 'popup'
    };

    let sender = 'sender';
    let callback = 'callback';
    api.handleQueryFromPopup = sinon.stub();

    let actual = api.onMessageHandler(message, sender, callback);
    t.true(actual);
    t.deepEqual(
      api.handleQueryFromPopup.args[0],
      [message, sender, callback]
    );
    end(t);
  }
);

test('handleQueryResultMessage caches page from query', function(t) {
  let savedPage = 'I am the saved page';
  let message = {
    type: 'queryResult',
    page: savedPage
  };

  t.equal(api.getLocalCachedPage(), null);
  api.handleQueryResultMessage(message, null, null);
  // We aren't handling a callback here, so we should return false.
  t.equal(api.getLocalCachedPage(), savedPage);
  end(t);
});

test('handleQueryResultMessage does not cache if no page', function(t) {
  let message = {
    type: 'queryResult',
  };

  t.equal(api.getLocalCachedPage(), null);
  api.handleQueryResultMessage(message, null, null);
  // We aren't handling a callback here, so we should return false.
  t.equal(api.getLocalCachedPage(), null);
  end(t);
});

test('handleQueryFromPopup invokes callback with saved page', function(t) {
  let expected = 'cashmoney page';

  api.getLocalCachedPage = sinon.stub().returns(expected);

  let message = {
    from: 'popup',
    type: 'queryForPage'
  };

  function callback(actual) {
    t.deepEqual(actual, expected);
    end(t);
  }

  api.handleQueryFromPopup(message, null, callback);
});

test('handleLoadMessage creates response and invokes callback', function(t) {
  let expected = { hello: 'from content script' };

  let getOnCompletePromiseSpy = sinon.stub().resolves();

  proxyquireApi({
    '../util/util': {
      getOnCompletePromise: getOnCompletePromiseSpy
    }
  });
  api.createLoadResponseMessage = sinon.stub().returns(expected);

  api.handleLoadMessage('message', 'sender', function(actual) {
    t.deepEqual(actual, expected);
    t.end();
    resetApi();
  });
});

test('createLoadResponseMessage gets load time' ,function(t) {
  let time = 1234.42;
  let getFullLoadTimeSpy = sinon.stub().returns(time);
  let expected = {
    type: 'readystateComplete',
    loadTime: time
  };

  api.getFullLoadTime = getFullLoadTimeSpy;

  let actual = api.createLoadResponseMessage();
  t.deepEqual(actual, expected);
  t.end();
  resetApi();
});

test('getLinksOnPage correct', function(t) {
  // We want to handle duplicates as well as single URLs.
  let anchors = [
    { 
      id: 1,
      href: 'example.com',
      absoluteUrl: 'http://example.com' // this doesn't exist in the real <a>
    },
    {
      id: 2,
      href: 'bar.com',
      absoluteUrl: 'http://bar.com'
    },
    {
      id: 3,
      href: 'example.com',
      absoluteUrl: 'http://example.com'
    }
  ];

  let expected = {};
  expected[anchors[0].absoluteUrl] = [ anchors[0], anchors[2] ];
  expected[anchors[1].absoluteUrl] = [ anchors[1] ];

  api.selectAllLinksWithHrefs = sinon.stub().returns(anchors);
  api.getAbsoluteUrl = function(href) {
    return 'http://' + href;
  };

  let actual = api.getLinksOnPage();
  t.deepEqual(actual, expected);
  end(t);
});

test('annotateLocalLinks annotates on success', function(t) {
  // Ugly duplication with the network query test.
  let anchors = [
    { 
      id: 1,
      href: 'http://example.com'
    },
    {
      id: 2,
      href: 'http://bar.com'
    },
    {
      id: 3,
      href: 'http://example.com'
    },
    {
      id: 4,
      href: 'http://unvailableLocally.com'
    }
  ];

  let links = {};
  links[anchors[0].href] = [ anchors[0], anchors[2] ];
  links[anchors[1].href] = [ anchors[1] ];
  links[anchors[3].href] = [ anchors[3] ];

  let urls = Object.keys(links);

  let queryResponse = {};
  queryResponse[anchors[0].href] = 'whatever';
  queryResponse[anchors[1].href] = 'yawn';

  let annotateAnchorSpy = sinon.stub();
  let saveStateStub = sinon.stub();
  let initPopupStub = sinon.stub();

  let queryLocallyStub = sinon.stub();
  queryLocallyStub.withArgs('contentscript', urls).resolves(queryResponse);

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: queryLocallyStub
    }
  });
  api.getLinksOnPage = sinon.stub().returns(links);
  api.annotateAnchorIsLocal = annotateAnchorSpy;
  api.saveCpInfoState = saveStateStub;
  api.initPopupForAnchor = initPopupStub;

  api.annotateLocalLinks()
  .then(actual => {
    t.equal(actual, undefined);
    let matchingAnchors = [ anchors[0], anchors[1], anchors[2] ];

    matchingAnchors.forEach(anchor => {
      t.true(annotateAnchorSpy.calledWith(anchor));
      t.true(initPopupStub.calledWith(anchor));
    });

    t.deepEqual(saveStateStub.args[0], [true, queryResponse]);

    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('annotateLocalLinks does nothing on failure', function(t) {
  // Ugly duplication with the network questy
  let expectedErr = { msg: 'fail.' };
  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: sinon.stub().rejects(expectedErr)
    }
  });
  api.getLinksOnPage = sinon.stub().returns({});

  api.annotateLocalLinks()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    end(t);
  });
});

test('annotateNetworkLocalLinks annotates on success', function(t) {
  // We want to handle duplicates as well as single URLs.
  let anchors = [
    { 
      id: 1,
      href: 'http://example.com'
    },
    {
      id: 2,
      href: 'http://bar.com'
    },
    {
      id: 3,
      href: 'http://example.com'
    },
    {
      id: 4,
      href: 'http://unvailableLocally.com'
    }
  ];

  let links = {};
  links[anchors[0].href] = [ anchors[0], anchors[2] ];
  links[anchors[1].href] = [ anchors[1] ];
  links[anchors[3].href] = [ anchors[3] ];

  let urls = Object.keys(links);

  let queryResponse = {};
  queryResponse[anchors[0].href] = 'whatever';
  queryResponse[anchors[1].href] = 'yawn';

  let annotateAnchorSpy = sinon.stub();

  let queryForPagesStub = sinon.stub();
  queryForPagesStub.withArgs('contentscript', urls).resolves(queryResponse);

  let initPopupStub = sinon.stub();
  let saveStateStub = sinon.stub();

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesOnNetwork: queryForPagesStub
    }
  });
  api.getLinksOnPage = sinon.stub().returns(links);
  api.annotateAnchorIsOnNetwork = annotateAnchorSpy;
  api.saveCpInfoState = saveStateStub;
  api.initPopupForAnchor = initPopupStub;

  api.annotateNetworkLocalLinks()
  .then(actual => {
    t.equal(actual, undefined);
    let matchingAnchors = [ anchors[0], anchors[1], anchors[2] ];

    matchingAnchors.forEach(anchor => {
      t.true(annotateAnchorSpy.calledWith(anchor));
      t.true(initPopupStub.calledWith(anchor));
    });

    t.deepEqual(saveStateStub.args[0], [false, queryResponse]);

    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('annotateNetworkLocalLinks does nothing on failure', function(t) {
  let expectedErr = { msg: 'fail.' };
  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesOnNetwork: sinon.stub().rejects(expectedErr)
    }
  });
  api.getLinksOnPage = sinon.stub().returns({});

  api.annotateNetworkLocalLinks()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    end(t);
  });
});

test('initPopupForAnchor correct', function(t) {
  let addEventListenerStub = sinon.stub();

  let absoluteUrl = 'absolute';
  let anchor = {
    href: 'relativel',
    addEventListener: addEventListenerStub
  };

  let getAbsoluteStub = sinon.stub();
  getAbsoluteStub.withArgs(anchor.href).returns(absoluteUrl);

  let local = [ 'fee', 'fi' ];
  let network = [ 'fo', 'fum' ];
  let html = '<body></body>';

  let savedState = {
    [absoluteUrl]: { local, network }
  };
  let swalStub = sinon.stub();
  let createHtmlStub = sinon.stub();
  createHtmlStub.withArgs(absoluteUrl, local, network).returns(html);

  api.getAbsoluteUrl = getAbsoluteStub;
  api.getSweetAlert = sinon.stub().returns(swalStub);
  api.getCpInfoState = sinon.stub().returns(savedState);
  api.createPopupHtml = createHtmlStub;

  api.initPopupForAnchor(anchor);

  t.true(addEventListenerStub.calledOnce);
  end(t);
});

test('saveCpInfoState correct', function(t) {
  // Starts empty
  t.deepEqual(api.getCpInfoState(), {});

  let url1 = 'http://foo.org';
  let url2 = 'http://nyt.com';

  let info = {
    [url1]: [ 'one', 'two' ],
    [url2]: [ 1, 2 ]
  };

  let expected = {
    [url1]: {
      local: info[url1],
    },
    [url2]: {
      local: info[url2]
    }
  };

  api.saveCpInfoState(true, info);

  t.deepEqual(api.getCpInfoState(), expected);

  expected[url1].network = info[url1];
  expected[url2].network = info[url2];

  api.saveCpInfoState(false, info);

  t.deepEqual(api.getCpInfoState(), expected);

  end(t);
});

test('getIndexFromId can reverse getNetworkButtonIdForIndex', function(t) {
  let expected = 1;
  let id = api.getNetworkButtonIdForIndex(expected);
  let actual = api.getIndexFromId(id);

  t.equal(actual, expected);
  end(t);
});

test('handleOpenButtonClick right for original', function(t) {
  let href = 'foo.com';
  let btn = {
    id: api.idOpenOriginal
  };

  let windowStub = sinon.stub();
  let toastStub = sinon.stub();

  proxyquireApi({
    '../util/util': {
      getWindow: sinon.stub().returns(windowStub)
    }
  });
  api.toastMessage = toastStub;

  api.handleOpenButtonClick(href, btn);

  t.deepEqual(windowStub.location, href);
  end(t);
});

test('handleOpenButtonClick right for local', function(t) {
  let href = 'nyt.com';
  let serviceName = 'samcache';
  let cpinfoState = {
    [href]: {
      local: [
        {
          serviceName: serviceName,
          captureHref: href
        }
      ]
    }
  };

  let btn = {
    id: api.idOpenLocal
  };

  let sendStub = sinon.stub().resolves();
  let toastMessageStub = sinon.stub();

  proxyquireApi({
    '../app-bridge/messaging': {
      sendMessageToOpenPage: sendStub
    }
  });
  api.getCpInfoState = sinon.stub().returns(cpinfoState);
  api.toastMessage = toastMessageStub;

  api.handleOpenButtonClick(href, btn);

  t.deepEqual(sendStub.args[0], ['contentscript', serviceName, href]);
  t.deepEqual(toastMessageStub.args[0], ['Opening...']);
  end(t);
});

test('handleOpenButtonClick right for network', function(t) {
  let href = 'nyt.com';
  let serviceName = 'samcache';
  let serviceName2 = 'foobar';
  let cpinfoState = {
    [href]: {
      network: [
        {
          serviceName: serviceName,
          captureHref: href
        },
        {
          serviceName: serviceName2,
          captureHref: href
        }
      ]
    }
  };

  // We want to open the 1th version
  let btn = {
    id: api.getNetworkButtonIdForIndex(1)
  };

  let sendStub = sinon.stub().resolves();
  let toastStub = sinon.stub();

  proxyquireApi({
    '../app-bridge/messaging': {
      sendMessageToOpenPage: sendStub
    }
  });
  api.getCpInfoState = sinon.stub().returns(cpinfoState);
  api.toastMessage = toastStub;

  api.handleOpenButtonClick(href, btn);

  t.deepEqual(sendStub.args[0], ['contentscript', serviceName2, href]);
  end(t);
});
