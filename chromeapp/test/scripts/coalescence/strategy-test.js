'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const tutil = require('../test-util');

let coalescenceStrategy = require('../../../app/scripts/coalescence/strategy');

let CoalescenceStrategy = coalescenceStrategy.CoalescenceStrategy;


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetstrategy() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/strategy')
  ];
  coalescenceStrategy = require('../../../app/scripts/coalescence/strategy');
  CoalescenceStrategy = coalescenceStrategy.CoalescenceStrategy;
}

function proxyquireStrategy(proxies) {
  coalescenceStrategy = proxyquire(
    '../../../app/scripts/coalescence/strategy', proxies
  );
  CoalescenceStrategy = coalescenceStrategy.CoalescenceStrategy;
}

function createPeerInfos() {
  return [...tutil.genCacheInfos(2)];
}

function createResources() {
  return [
    { res: 'resource 1' },
    { res: 'resource 2' }
  ];
}

function helperAssertGetAndProcess(
  peerInfos, paResolve1, paResolve2, paReject1, paReject2
) {
  let pa1 = 'peer accessor 1';
  let pa2 = 'peer accessor 2';

  let pi1 = peerInfos[0];
  let pi2 = peerInfos[1];

  let getResourceStub = sinon.stub();

  if (paResolve1) {
    getResourceStub.withArgs(pa1, pi1).resolves(paResolve1);

  }
  if (paReject1) {
    getResourceStub.withArgs(pa1, pi1).rejects(paReject1);
  }

  if (paResolve2) {
    getResourceStub.withArgs(pa2, pi2).resolves(paResolve2);
  }
  if (paReject2) {
    getResourceStub.withArgs(pa2, pi2).rejects(paReject2);
  }

  let getPaStub = sinon.stub();

  if (peerInfos[0]) {
    getPaStub
      .withArgs({
        ipAddress: peerInfos[0].ipAddress,
        port: peerInfos[0].port 
      })
      .returns(pa1);
  }

  if (peerInfos[1]) {
    getPaStub 
      .withArgs({
        ipAddress: peerInfos[1].ipAddress,
        port: peerInfos[1].port 
      })
      .returns(pa2);
  }
  
  proxyquireStrategy({
    '../peer-interface/manager': {
      getPeerAccessor: getPaStub
    }
  });

  let digest = new CoalescenceStrategy();
  digest.getResourceFromPeer = getResourceStub;

  return digest;
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  resetstrategy();
  t.end();
}

test('initialize rejects if something goes wrong', function(t) {
  let expectedErr = { msg: 'browse rejected' };
  proxyquireStrategy({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().rejects(expectedErr)
    }
  });

  let strategy = new CoalescenceStrategy();

  t.false(strategy.isInitializing());
  t.false(strategy.isInitialized());

  strategy.initialize()
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expectedErr);
    t.false(strategy.isInitializing());
    t.false(strategy.isInitialized());
    end(t);
  });
});

test('initialize resolves on success', function(t) {
  let peerInfos = [...tutil.genCacheInfos(3)];
  let resources = createResources();

  let browseStub = sinon.stub();
  browseStub.withArgs(true).resolves(peerInfos);

  proxyquireStrategy({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseStub
    },
  });

  let strategy = new CoalescenceStrategy();


  let getAndProcessStub = sinon.stub();
  getAndProcessStub
    .withArgs(peerInfos)
    .resolves(resources);

  strategy.getAndProcessResources = getAndProcessStub;
  // Rather than use a stub to monitor whether or not the strategys have been
  // set, we're going to use a function so that we can also assert that the
  // isInitializing() function is set correctly.
  let resourceParam = null;
  strategy.setResources = function(passedResource) {
    resourceParam = passedResource;
    t.true(strategy.isInitializing());
  };

  t.false(strategy.isInitializing());
  t.false(strategy.isInitialized());

  strategy.initialize()
  .then(actual => {
    t.deepEqual(actual, undefined);
    t.false(strategy.isInitializing());
    t.true(strategy.isInitialized());
    // And the strategys should have been set
    t.equal(resourceParam, resources);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('initialize does not get resources if canceled', function(t) {
  let strategy = null;

  let browseStub = function() {
    strategy.reset();
    return Promise.resolve();
  };
  let getResourcesStub = sinon.stub();

  proxyquireStrategy({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseStub
    },
  });

  strategy = new CoalescenceStrategy();
  strategy.getResources = getResourcesStub;

  strategy.initialize()
  .then(actual => {
    t.deepEqual(actual, undefined);
    // And we should never have called getResources
    t.equal(getResourcesStub.callCount, 0);
    t.false(strategy.isInitialized());
    t.false(strategy.isInitializing());
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('initialize does not set resources if canceled', function(t) {
  let browseStub = sinon.stub().resolves();

  proxyquireStrategy({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: browseStub
    },
  });

  let strategy = new CoalescenceStrategy();

  let getResourcesStub = function() {
    strategy.reset();
    return Promise.resolve([ 'res1', 'res1' ]);
  };
  let setResourcesStub = sinon.stub();
  strategy.getAndProcessResources = getResourcesStub;
  strategy.setResources = setResourcesStub;

  strategy.initialize()
  .then(actual => {
    t.deepEqual(actual, undefined);
    // We should have called setResources only once, when we reset.
    t.equal(setResourcesStub.callCount, 1);
    t.false(strategy.isInitialized());
    t.false(strategy.isInitializing());
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('reset restores state', function(t) {
  proxyquireStrategy({
    '../dnssd/dns-sd-semcache': {
      browseForSemCacheInstances: sinon.stub().resolves()
    },
    './util': {
      removeOwnInfo: sinon.stub().resolves()
    }
  });
  let strategy = new CoalescenceStrategy();
  strategy.getAndProcessResources = sinon.stub().resolves(['a']);
  strategy.setResources = sinon.stub();

  strategy.initialize()
  .then(() => {
    t.false(strategy.isInitializing());
    t.true(strategy.isInitialized());

    strategy.reset();
    t.false(strategy.isInitializing());
    t.false(strategy.isInitialized());
    // The second call will have been the reset one
    t.deepEqual(strategy.setResources.args[1][0], []);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('refresh correct', function(t) {
  // We expect calls to reset() and initialize().
  let resetStub = sinon.stub();
  let initStub = sinon.stub();

  let strategy = new CoalescenceStrategy();
  strategy.reset = resetStub;
  strategy.initialize = initStub;

  strategy.refresh();
  
  t.equal(resetStub.callCount, 1);
  t.equal(initStub.callCount, 1);

  end(t);
});

test('getAndProcessResources resolves all success', function(t) {
  let expected = createResources();
  let peerInfos = createPeerInfos();

  let digest = helperAssertGetAndProcess(peerInfos, expected[0], expected[1]);

  digest.getAndProcessResources(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessResources returns empty array if no peers', function(t) {
  let expected = [];
  let peerInfos = [];

  let digest = helperAssertGetAndProcess(peerInfos);

  digest.getAndProcessResources(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessResources resolves last rejects', function(t) {
  let resources = createResources();
  let peerInfos = createPeerInfos();
  let expected = [resources[0]];

  let digest = helperAssertGetAndProcess(
    peerInfos, expected[0], null, null, { msg: 'swallow me' }
  );

  digest.getAndProcessResources(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getAndProcessResources resolves all reject', function(t) {
  let peerInfos = createPeerInfos();
  let expected = [];

  let digest = helperAssertGetAndProcess(
    peerInfos, null, null, { msg: 'swallow me 1' }, { msg: 'swallow me 2' }
  );

  digest.getAndProcessResources(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});
