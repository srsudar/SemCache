'use strict';

const test = require('tape');
const sinon = require('sinon');
require('sinon-as-promised');

let mgr = require('../../../app/scripts/coalescence/manager');
const stratDig = require('../../../app/scripts/coalescence/digest-strategy');
const stratBloom = require('../../../app/scripts/coalescence/bloom-strategy');

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
  mgr.CURRENT_STRATEGY = mgr.STRATEGIES.digest;
  let actual = mgr.getStrategy();
  let expected = new stratDig.DigestStrategy();

  t.deepEqual(actual, expected);
  end(t);
});

test('getStrategy returns bloom strategy', function(t) {
  mgr.CURRENT_STRATEGY = mgr.STRATEGIES.bloom;
  let actual = mgr.getStrategy();
  let expected = new stratBloom.BloomStrategy();

  t.deepEqual(actual, expected);
  end(t);
});

test('getStrategy returns existing object if active', function(t) {
  let stratStub = sinon.stub();
  mgr.ACTIVE_SRAT_OBJECT = stratStub;

  let actual = mgr.getStrategy();
  t.equal(actual, stratStub);
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

  let performQueryStub = sinon.stub();
  performQueryStub.withArgs(urls).resolves(expected);

  let strategy = {
    initialize: sinon.stub().resolves(),
    performQuery: performQueryStub
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

test('reset calls reset on device', function(t) {
  let resetStub = sinon.stub();
  let strategyStub = {
    reset: resetStub
  };

  mgr.ACTIVE_SRAT_OBJECT = strategyStub;

  mgr.reset();
  t.equal(mgr.ACTIVE_SRAT_OBJECT, null);
  end(t);
});
