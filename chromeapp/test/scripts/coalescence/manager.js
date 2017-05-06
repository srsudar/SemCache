'use strict';

var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var mgr = require('../../../app/scripts/coalescence/manager');
var stratDig = require('../../../app/scripts/coalescence/digest-strategy');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/manager')
  ];
  mgr = require('../../../app/scripts/coalescence/manager');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  reset();
  t.end();
}

test('getStrategy returns digest strategy', function(t) {
  let actual = mgr.getStrategy();
  let expected = new stratDig.DigestStrategy();

  t.deepEqual(actual, expected);
  end(t);
});

test('queryForUrls rejects on error', function(t) {
  var expectedErr = { msg: 'initialize went wrong' };
  var strategy = {
    initialize: sinon.stub().rejects(expectedErr)
  };

  mgr.getStrategy = sinon.stub().returns(strategy);

  mgr.queryForUrls([])
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expectedErr);
    end(t);
  });
});

test('queryForUrls resolves with information', function(t) {
  let urls = [ 'hi.com', 'bye.com' ];
  let expected = {
    wut: 'ohai'
  };

  let strategy = {
    initialize: sinon.stub().resolves(),
    performQuery: sinon.stub().withArgs(urls).resolves(expected)
  };

  mgr.getStrategy = sinon.stub().returns(strategy);

  mgr.queryForUrls(urls)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

