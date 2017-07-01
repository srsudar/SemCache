'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const stratBloom = require('../../../app/scripts/coalescence/bloom-strategy');
const stratDig = require('../../../app/scripts/coalescence/digest-strategy');

let mgr = require('../../../app/scripts/coalescence/manager');


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

function proxyquireManager(proxies) {
  mgr = proxyquire('../../../app/scripts/coalescence/manager', proxies);
}

test('getStrategy returns digest strategy', function(t) {
  proxyquireManager({
    '../settings': {
      getCoalescenceStrategy: sinon.stub().returns('digest')
    }
  });

  let actual = mgr.getStrategy();
  let expected = new stratDig.DigestStrategy();

  t.deepEqual(actual, expected);
  end(t);
});

test('getStrategy returns bloom strategy', function(t) {
  proxyquireManager({
    '../settings': {
      getCoalescenceStrategy: sinon.stub().returns('bloom')
    }
  });

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
  let expectedErr = { msg: 'initialize went wrong' };
  let strategy = {
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
  t.equal(resetStub.callCount, 1);
  end(t);
});

test('enqueueRefresh calls a timeout and refreshes', function(t) {
  let actualMillis = null;
  let waitStub = function(millisParam) {
    actualMillis = millisParam;
    return Promise.resolve();
  };

  let refreshStub = sinon.stub();
  let stratStub = {
    refresh: refreshStub
  };

  proxyquireManager({
    '../util': {
      wait: waitStub
    }
  });
  mgr.ACTIVE_SRAT_OBJECT = stratStub;

  // This is a bit tricky because we expect our function to invoke ourselves,
  // creating cycles during testing. To get around this we are going to save a
  // reference to the function and then replace the function on a module with
  // the stub.

  let originalEnqueueRefresh = mgr.enqueueRefresh;

  let enqueueRefreshStub = sinon.stub();
  // We want to do the real thing the first time, acting like an original
  // invocation.
  enqueueRefreshStub
    .onCall(0)
    .returns(originalEnqueueRefresh());

  mgr.enqueueRefresh = enqueueRefreshStub;

  mgr.enqueueRefresh()
  .then(actual => {
    t.equal(actual, undefined);
    t.equal(actualMillis, mgr.REFRESH_CYCLE_MILLIS);
    // We should have called enqueueRefresh twice--once ourselves, once after
    // the wait resolved.
    t.equal(enqueueRefreshStub.callCount, 2);
    t.equal(refreshStub.callCount, 1);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('enqueueRefresh does not enqueueRefresh if no strategy', function(t) {
  proxyquireManager({
    '../util': {
      wait: sinon.stub().resolves()
    }
  });

  let enqueueRefreshSpy = sinon.spy(mgr.enqueueRefresh);

  enqueueRefreshSpy()
  .then(actual => {
    t.equal(actual, undefined);
    t.equal(enqueueRefreshSpy.callCount, 1);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('initialize gets strategy and initializes', function(t) {
  let enqueueRefreshStub = sinon.stub();
  let initStub = sinon.stub().resolves();
  let stratStub = {
    initialize: initStub
  };

  mgr.getStrategy = sinon.stub().returns(stratStub);
  mgr.enqueueRefresh = enqueueRefreshStub;

  mgr.initialize();

  t.equal(initStub.callCount, 1);
  t.equal(enqueueRefreshStub.callCount, 1);
  end(t);
});
