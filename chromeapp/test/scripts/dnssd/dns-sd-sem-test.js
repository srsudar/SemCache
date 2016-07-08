'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDnsSdSem() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-sd-sem')
  ];
}

/**
 * Helper to reject a probe promise due to receiving packets.
 *
 * returnTrueAfterCall: the call number after which receivedPacket should
 *   return true.
 */
function probeRejectsHelper(returnTrueAfterCall, t) {
  var addOnReceiveCallbackSpy = sinon.spy();
  var removeOnReceiveCallbackSpy = sinon.spy();

  var receivedPacketCallCount = 0;
  var receivedPacketSpy = function() {
    if (receivedPacketCallCount === returnTrueAfterCall) {
      receivedPacketCallCount += 1;
      return true;
    } else {
      receivedPacketCallCount += 1;
      return false;
    }
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd-sem',
    {
      './dns-controller':
      {
        addOnReceiveCallback: addOnReceiveCallbackSpy,
        removeOnReceiveCallback: removeOnReceiveCallbackSpy,
        query: function() {}
      }
    }
  );

  dnssdSem.receivedPacket = receivedPacketSpy;

  t.plan(3);

  var issuePromise = dnssdSem.issueProbe('queryname', 4, 5);
  issuePromise.then(function success() {
    // We should never succeed in this case.
    resetDnsSdSem();
    t.fail();
  })
  .catch(function failure() {
    // our promise didn't resolve, meaning we failed.
    // We should have been called one more than we were permitting (i.e. a call
    // on the 0th call leads to a single call
    console.log('return true after: ', returnTrueAfterCall);
    console.log('received packet count: ', receivedPacketCallCount);
    t.equal(returnTrueAfterCall + 1, receivedPacketCallCount);
    t.equal(addOnReceiveCallbackSpy.callCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);
    resetDnsSdSem();
  });
}

test('issueProbe succeeds correctly', function(t) {
  var addOnReceiveCallbackSpy = sinon.spy();
  var removeOnReceiveCallbackSpy = sinon.spy();

  var receivedPacketCallCount = 0;
  var receivedPacketSpy = function() {
    receivedPacketCallCount += 1;
    return false;
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd-sem',
    {
      './dns-controller':
      {
        addOnReceiveCallback: addOnReceiveCallbackSpy,
        removeOnReceiveCallback: removeOnReceiveCallbackSpy,
        query: function() {}
      }
    }
  );

  dnssdSem.receivedPacket = receivedPacketSpy;

  t.plan(3);

  var issuePromise = dnssdSem.issueProbe('queryname', 4, 5);
  issuePromise.then(function success() {
    t.equal(receivedPacketCallCount, 3);
    t.true(addOnReceiveCallbackSpy.calledOnce);
    t.true(removeOnReceiveCallbackSpy.calledOnce);
    resetDnsSdSem();
  })
  .catch(function failure() {
    // our promise didn't resolve, meaning we failed.
    resetDnsSdSem();
    t.fail();
  });
});

test('issueProbe fails if received packets on first probe', function(t) {
  probeRejectsHelper(0, t);
});

test('issueProbe fails if received packets on second probe', function(t) {
  probeRejectsHelper(1, t);
});

test('issueProbe fails if received packets on third probe', function(t) {
  probeRejectsHelper(2, t);
});
