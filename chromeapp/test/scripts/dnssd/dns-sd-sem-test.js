/*jshint esnext:true*/
/* globals Promise */
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var qRec = require('../../../app/scripts/dnssd/question-section');
var dnsPacket = require('../../../app/scripts/dnssd/dns-packet-sem');
var resRec = require('../../../app/scripts/dnssd/resource-record');
var dnsUtil = require('../../../app/scripts/dnssd/dns-util');
var dnsCodes = require('../../../app/scripts/dnssd/dns-codes-sem');
var qSection = require('../../../app/scripts/dnssd/question-section');

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
 * returnTrueAfterCall: the call number after which receivedResponsePacket
 *   should return true.
 */
function probeRejectsHelper(returnTrueAfterCall, t) {
  var addOnReceiveCallbackSpy = sinon.spy();
  var removeOnReceiveCallbackSpy = sinon.spy();

  var receivedResponsePacketCallCount = 0;
  var receivedResponsePacketSpy = function() {
    if (receivedResponsePacketCallCount === returnTrueAfterCall) {
      receivedResponsePacketCallCount += 1;
      return true;
    } else {
      receivedResponsePacketCallCount += 1;
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

  dnssdSem.receivedResponsePacket = receivedResponsePacketSpy;
  dnssdSem.wait = () => Promise.resolve();

  var issuePromise = dnssdSem.issueProbe('queryname', 4, 5);
  issuePromise.then(function success() {
    // We should never succeed in this case.
    resetDnsSdSem();
    t.fail();
    t.end();
  })
  .catch(function failure() {
    // our promise didn't resolve, meaning we failed.
    // We should have been called one more than we were permitting (i.e. a call
    // on the 0th call leads to a single call
    t.equal(returnTrueAfterCall + 1, receivedResponsePacketCallCount);
    t.equal(addOnReceiveCallbackSpy.callCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);
    t.end();
    resetDnsSdSem();
  });
}

test('issueProbe succeeds correctly', function(t) {
  var addOnReceiveCallbackSpy = sinon.spy();
  var removeOnReceiveCallbackSpy = sinon.spy();

  var receivedResponsePacketCallCount = 0;
  var receivedResponsePacketSpy = function() {
    receivedResponsePacketCallCount += 1;
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

  dnssdSem.receivedResponsePacket = receivedResponsePacketSpy;
  dnssdSem.wait = () => Promise.resolve();

  var issuePromise = dnssdSem.issueProbe('queryname', 4, 5);
  issuePromise.then(function success() {
    t.equal(receivedResponsePacketCallCount, 3);
    t.true(addOnReceiveCallbackSpy.calledOnce);
    t.true(removeOnReceiveCallbackSpy.calledOnce);
    resetDnsSdSem();
    t.end();
  })
  .catch(function failure() {
    // our promise didn't resolve, meaning we failed.
    resetDnsSdSem();
    t.fail();
    t.end();
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
  dnssdSem.receivedResponsePacket(packets, queryName);

  t.equal(packetIsForQuerySpy.callCount, packets.length);
  t.true(packetIsForQuerySpy.calledWith(first, queryName));
  t.true(packetIsForQuerySpy.calledWith(second, queryName));
  t.true(packetIsForQuerySpy.calledWith(third, queryName));
  t.end();

  resetDnsSdSem();
});

test('receivedResponsePacket true correctly', function(t) {
  // Should be true if the packet is for the query and it is a response
  // TODO: above
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  var packetIsForQueryStub = sinon.stub().returns(true);
  dnssdSem.packetIsForQuery = packetIsForQueryStub;

  var isResponsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    true,
    false,
    false,
    false,
    0
  );
  // var question = qS

  var packets = [];
  packets.push(isResponsePacket);

  var actual = dnssdSem.receivedResponsePacket(packets, 'foo');
  t.true(actual);
  t.end();

  resetDnsSdSem();
});

test('receivedResponsePacket false correctly', function(t) {
  // Three conditions where this is false:
  // 1) received no packets
  // 2) received a packet that is NOT for the query
  // 3) received a packet for the query that is NOT a response
  // Should be false if the packet is not for the query and it is a query
  // packet
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd-sem');

  // var packetIsForQueryStub = sinon.stub().returns(false);
  // dnssdSem.packetIsForQuery = packetIsForQueryStub;

  var packets = [];

  var queryName = 'foo';

  // 1) received no packets
  var actualForNoPackets = dnssdSem.receivedResponsePacket(packets, queryName);
  t.false(actualForNoPackets);

  // 2) received packet NOT for this query
  // Make a packet that is a response but is not for this query.
  var packetNotForQuery = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    true,
    false,
    false,
    false,
    0
  );
  var questionForOtherQuery = new qSection.QuestionSection(
    'other query',
    2,
    5
  );
  packetNotForQuery.addQuestion(questionForOtherQuery);
  packets = [packetNotForQuery];
  var actualForOtherQuery = dnssdSem.receivedResponsePacket(
    packets,
    queryName
  );
  t.false(actualForOtherQuery);

  // 3) received packet for this query that is a question
  var packetForQuery = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    true,
    false,
    false,
    false,
    0
  );
  var questionForThisQuery = new qSection.QuestionSection(
    queryName,
    2,
    5
  );
  packetForQuery.addQuestion(questionForThisQuery);
  packets = [packetForQuery];
  var actualForQuestion = dnssdSem.receivedResponsePacket(
    [packetForQuery],
    queryName
  );
  t.false(actualForQuestion);

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
  dnssdSem.wait = () => Promise.resolve();

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

test('createServiceRecords creates and returns', function(t) {
  var addRecordSpy = sinon.spy();
  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd-sem',
    {
      './dns-controller':
      {
        addRecord: addRecordSpy
      }
    }
  );
  
  var name = 'fancy name';
  var type = '_semcache._tcp';
  var port = 8817;
  var domain = 'computer.local';

  var expectedSrvRecord = new resRec.SrvRecord(
    name,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  var expectedPtrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    name,
    dnsCodes.CLASS_CODES.IN
  );

  var targetReturn = [expectedSrvRecord, expectedPtrRecord];
  var actualReturn = dnssdSem.createServiceRecords(name, type, port, domain);
  t.deepEqual(actualReturn, targetReturn);

  t.equal(addRecordSpy.callCount, 2);

  var firstArgs = addRecordSpy.args[0];
  var secondArgs = addRecordSpy.args[1];

  t.equal(firstArgs[0], name);
  t.deepEqual(firstArgs[1], expectedSrvRecord);

  t.equal(secondArgs[0], type);
  t.deepEqual(secondArgs[1], expectedPtrRecord);

  t.end();
  resetDnsSdSem();
});

test('createHostRecords calls to create records correctly', function(t) {
  var iface = {
    name: 'eth0',
    address: '123.456.789.91',
    prefixLength: 0
  };

  var host = 'hostname.local';

  var expectedRecord = new resRec.ARecord(
    host,
    dnsUtil.DEFAULT_TTL,
    iface.address,
    dnsCodes.CLASS_CODES.IN
  );

  var addRecordSpy = function(hostParam, recordParam) {
    t.equal(hostParam, host);
    t.deepEqual(recordParam, expectedRecord);
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd-sem',
    {
      './dns-controller':
      {
        addRecord: addRecordSpy,
        getIPv4Interfaces: () => [iface]
      }
    }
  );

  var actualReturn = dnssdSem.createHostRecords(host);
  var expectedReturn = [expectedRecord];
  t.deepEqual(actualReturn, expectedReturn);
  t.end();
  resetDnsSdSem();
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

  // Create host record should have been called with the correct host, and it
  // should have return some known records.
  var calledHostForCreateHost;
  var hostRecord = ['a'];
  var createHostRecordsSpy = function(hostParam) {
    calledHostForCreateHost = hostParam;
    return hostRecord;
  };

  var calledName;
  var calledType;
  var calledPort;
  var calledHostForCreateService;
  var serviceRecords = ['b', 'c'];
  var createServiceRecordsSpy = function(
    nameParam,
    typeParam,
    portParam,
    hostParam
  ) {
    calledName = nameParam;
    calledType = typeParam;
    calledPort = portParam;
    calledHostForCreateService = hostParam;
    return serviceRecords;
  };

  var allRecords = hostRecord.concat(serviceRecords);

  var advertiseServiceSpy = sinon.spy();

  dnssdSem.createHostRecords = createHostRecordsSpy;
  dnssdSem.createServiceRecords = createServiceRecordsSpy;
  dnssdSem.advertiseService = advertiseServiceSpy;

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

    // We should have issued 2 probes
    t.equal(issueProbeCallCount, 2);

    // We should have called createServiceRecords with the correct params.
    t.equal(calledName, instanceName);
    t.equal(calledType, type);
    t.equal(calledPort, port);
    t.equal(calledHostForCreateService, host);

    // We should have called createHostRecords with the correct params.
    t.equal(calledHostForCreateHost, host);
    
    // And finally, we should have called advertiseService with all the records
    // we created.
    t.true(advertiseServiceSpy.calledOnce);
    t.deepEqual(advertiseServiceSpy.args[0][0], allRecords);

    resetDnsSdSem();
    t.end();
  }, function failed() {
    // We rejected, which should never happen.
    t.fail('we should not reject in this case');
    resetDnsSdSem();
  });
});

test('advertiseService advertises', function(t) {
  t.fail('unimplemented');
  t.end();
});
