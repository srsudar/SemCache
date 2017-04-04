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
