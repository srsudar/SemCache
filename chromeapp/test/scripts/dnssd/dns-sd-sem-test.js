'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var qRec = require('../../../app/scripts/dnssd/question-section');
var dnsPacket = require('../../../app/scripts/dnssd/dns-packet-sem');

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

test('packetIsForQuery true if owns question', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var qName = 'www.example.com';
  var question = new qRec.QuestionSection(qName, 4, 5);
  var packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  packet.addQuestion(question);

  var actual = dnssdSem.packetIsForQuery(packet, qName);
  t.true(actual);
  t.end();
});

test('packetIsForQuery false if doesn not own question', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var qName = 'www.example.com';
  var question = new qRec.QuestionSection('other name', 4, 5);
  var packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  packet.addQuestion(question);

  var actual = dnssdSem.packetIsForQuery(packet, qName);
  t.false(actual);
  t.end();
});

test('receivedPacket calls packetIsForQuery on each packet', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var packetIsForQuerySpy = sinon.spy();
  dnssdSem.packetIsForQuery = packetIsForQuerySpy;

  var first = 'a';
  var second = 'b';
  var third = 'c';
  var packets = [];
  packets.push(first);
  packets.push(second);
  packets.push(third);

  var queryName = 'foobar';
  dnssdSem.receivedPacket(packets, queryName);

  t.equal(packetIsForQuerySpy.callCount, packets.length);
  t.true(packetIsForQuerySpy.calledWith(first, queryName));
  t.true(packetIsForQuerySpy.calledWith(second, queryName));
  t.true(packetIsForQuerySpy.calledWith(third, queryName));
  t.end();

  resetDnsSdSem();
});

test('receivedPacket true if packetIsForQuery true', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var packetIsForQueryStub = sinon.stub().returns(true);
  dnssdSem.packetIsForQuery = packetIsForQueryStub; 

  var packets = [];
  packets.push('a');

  var actual = dnssdSem.receivedPacket(packets, 'foo');
  t.true(actual);
  t.end();

  resetDnsSdSem();
});

test('receivedPacket false if packetIsForQuery false', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var packetIsForQueryStub = sinon.stub().returns(false);
  dnssdSem.packetIsForQuery = packetIsForQueryStub; 

  var packets = [];
  packets.push('a');

  var actual = dnssdSem.receivedPacket(packets, 'foo');
  t.false(actual);
  t.end();

  resetDnsSdSem();
});

test('register rejects if host taken', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');
  
  var host = 'hostname.local';
  var instanceName = 'my instance';
  var type = '_semcache._tcp';
  var port = 1234;

  var calledHost;

  var issueProbeCallCount = 0;
  var issueProbeSpy = function(
    hostParam
  ) {
    issueProbeCallCount += 1;
    calledHost = hostParam;
    return Promise.reject('auto reject of probe');
  };
  dnssdSem.issueProbe = issueProbeSpy;

  var resultPromise = dnssdSem.register(host, instanceName, type, port);

  resultPromise.then(function succeeded() {
    // We are expecting to fail if the host is taken, so we should never
    // resolve.
    resetDnsSdSem();
    t.fail();
  }, function failed(failObj) {
    // We rejected, as expected because the host was taken.
    // Make sure we called issueProbe with the host
    // console.log(failObj);
    t.equal(calledHost, host);
    t.equal(failObj.message, 'host taken: ' + host);
    // We should only ever issue a single probe.
    t.equal(issueProbeCallCount, 1);
    t.true(true);
    t.end();
    resetDnsSdSem();
  });
});

test('register rejects if instance taken', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');
  
  var host = 'hostname.local';
  var instanceName = 'my instance';
  var type = '_semcache._tcp';
  var port = 1234;

  var calledHost;
  var calledName;

  var issueProbeCallCount = 0;
  var issueProbeSpy = function(
    hostParam
  ) {
    issueProbeCallCount += 1;
    calledHost = hostParam;
    if (issueProbeCallCount === 1 ) {
      // We want to fulfill the first call, which is for the host
      calledHost = hostParam;
      return Promise.resolve('auto resolve of probe');
    } else if (issueProbeCallCount === 2) {
      calledName = hostParam;
      return Promise.reject('auto reject of probe');
    } else {
      t.fail('called probe more than twice');
    }
  };
  dnssdSem.issueProbe = issueProbeSpy;

  var resultPromise = dnssdSem.register(host, instanceName, type, port);

  resultPromise.then(function succeeded() {
    // We are expecting to fail if the instance is taken, so we should never
    // resolve.
    resetDnsSdSem();
    t.fail();
  }, function failed(failObj) {
    // We rejected, as expected because the instance was taken.
    // Make sure we called issueProbe with the instance
    t.equal(calledHost, instanceName);
    t.equal(failObj.message, 'instance taken: ' + instanceName);
    // We should issue two probes.
    t.equal(issueProbeCallCount, 2);
    t.true(true);
    t.end();
    resetDnsSdSem();
  });
});

test('register resolves if name and host probe succeed', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');
  
  var host = 'hostname.local';
  var instanceName = 'my instance';
  var type = '_semcache._tcp';
  var port = 1234;

  var issueProbeCallCount = 0;
  var issueProbeSpy = function() {
    issueProbeCallCount += 1;
    // Make both promises succeed
    return Promise.resolve('auto succeed in spy');
  };
  dnssdSem.issueProbe = issueProbeSpy;

  var resultPromise = dnssdSem.register(host, instanceName, type, port);

  var expected = {
    serviceName: instanceName,
    type: type,
    domain: host,
    port: port
  };

  resultPromise.then(function succeeded(resolveObj) {
    // We are expecting to fail if the host is taken, so we should never
    // resolve.
    t.deepEqual(resolveObj, expected);
    // TODO: test that we added records via dns-controller
    t.fail('unimplemented verifying dns-controller');
    // We should have issued 2 probes
    t.equal(issueProbeCallCount, 2);
    resetDnsSdSem();
    t.end();
  }, function failed() {
    // We rejected, which should never happen.
    t.fail('we should not reject in this case');
    resetDnsSdSem();
  });
});
