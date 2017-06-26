/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');
var api = require('../../../app/scripts/content-script/cs-api');

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
  var message = { type: 'readystateComplete' };
  var sender = 'sender';
  var callback = 'callback';
  var handleLoadMessageSpy = sinon.stub();
  api.handleLoadMessage = handleLoadMessageSpy;

  var actual = api.onMessageHandler(message, sender, callback);

  t.true(actual);  // true to say we'll handle it asynchronously
  t.deepEqual(handleLoadMessageSpy.args[0], [message, sender, callback]);
  t.end();
});

test(
  'onMessageHandler returns false and calls handleQueryResultMessage',
  function(t) {
    var message = {
      type: 'queryResult'
    };

    var sender = 'sender';
    var callback = 'callback';
    api.handleQueryResultMessage = sinon.stub();

    var actual = api.onMessageHandler(message, sender, callback);
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
    var message = {
      type: 'queryForPage',
      from: 'popup'
    };

    var sender = 'sender';
    var callback = 'callback';
    api.handleQueryFromPopup = sinon.stub();

    var actual = api.onMessageHandler(message, sender, callback);
    t.true(actual);
    t.deepEqual(
      api.handleQueryFromPopup.args[0],
      [message, sender, callback]
    );
    end(t);
  }
);

test('handleQueryResultMessage caches page from query', function(t) {
  var savedPage = 'I am the saved page';
  var message = {
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
  var message = {
    type: 'queryResult',
  };

  t.equal(api.getLocalCachedPage(), null);
  api.handleQueryResultMessage(message, null, null);
  // We aren't handling a callback here, so we should return false.
  t.equal(api.getLocalCachedPage(), null);
  end(t);
});

test('handleQueryFromPopup invokes callback with saved page', function(t) {
  var expected = 'cashmoney page';

  api.getLocalCachedPage = sinon.stub().returns(expected);

  var message = {
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
  var expected = { hello: 'from content script' };

  var getOnCompletePromiseSpy = sinon.stub().resolves();

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
  var time = 1234.42;
  var getFullLoadTimeSpy = sinon.stub().returns(time);
  var expected = {
    type: 'readystateComplete',
    loadTime: time
  };

  api.getFullLoadTime = getFullLoadTimeSpy;

  var actual = api.createLoadResponseMessage();
  t.deepEqual(actual, expected);
  t.end();
  resetApi();
});

test('getLinksOnPage correct', function(t) {
  // We want to handle duplicates as well as single URLs.
  var anchors = [
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

  var expected = {};
  expected[anchors[0].absoluteUrl] = [ anchors[0], anchors[2] ];
  expected[anchors[1].absoluteUrl] = [ anchors[1] ];

  api.selectAllLinksWithHrefs = sinon.stub().returns(anchors);
  api.getAbsoluteUrl = function(href) {
    return 'http://' + href;
  };

  var actual = api.getLinksOnPage();
  t.deepEqual(actual, expected);
  end(t);
});

test('annotateLocalLinks annotates on success', function(t) {
  // Ugly duplication with the network query test.
  var anchors = [
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

  var links = {};
  links[anchors[0].href] = [ anchors[0], anchors[2] ];
  links[anchors[1].href] = [ anchors[1] ];
  links[anchors[3].href] = [ anchors[3] ];

  var urls = Object.keys(links);

  var queryResponse = {};
  queryResponse[anchors[0].href] = 'whatever';
  queryResponse[anchors[1].href] = 'yawn';

  var annotateAnchorSpy = sinon.stub();

  let queryLocallyStub = sinon.stub();
  queryLocallyStub.withArgs('contentscript', urls).resolves(queryResponse);

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesLocally: queryLocallyStub
    }
  });
  api.getLinksOnPage = sinon.stub().returns(links);
  api.annotateAnchorIsLocal = annotateAnchorSpy;

  api.annotateLocalLinks()
  .then(actual => {
    t.equal(actual, undefined);
    t.true(annotateAnchorSpy.calledWith(anchors[0]));
    t.true(annotateAnchorSpy.calledWith(anchors[1]));
    t.true(annotateAnchorSpy.calledWith(anchors[2]));
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('annotateLocalLinks does nothing on failure', function(t) {
  // Ugly duplication with the network questy
  var expectedErr = { msg: 'fail.' };
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
  var anchors = [
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

  var links = {};
  links[anchors[0].href] = [ anchors[0], anchors[2] ];
  links[anchors[1].href] = [ anchors[1] ];
  links[anchors[3].href] = [ anchors[3] ];

  var urls = Object.keys(links);

  var queryResponse = {};
  queryResponse[anchors[0].href] = 'whatever';
  queryResponse[anchors[1].href] = 'yawn';
  var appMsg = {
    result: 'success',
    response: queryResponse
  };

  var annotateAnchorSpy = sinon.stub();

  proxyquireApi({
    '../app-bridge/messaging': {
      queryForPagesOnNetwork: sinon.stub().withArgs(urls).resolves(appMsg)
    }
  });
  api.getLinksOnPage = sinon.stub().returns(links);
  api.annotateAnchorIsOnNetwork = annotateAnchorSpy;

  api.annotateNetworkLocalLinks()
  .then(actual => {
    t.equal(actual, undefined);
    t.true(annotateAnchorSpy.calledWith(anchors[0]));
    t.true(annotateAnchorSpy.calledWith(anchors[1]));
    t.true(annotateAnchorSpy.calledWith(anchors[2]));
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('annotateNetworkLocalLinks does nothing on failure', function(t) {
  var expectedErr = { msg: 'fail.' };
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
