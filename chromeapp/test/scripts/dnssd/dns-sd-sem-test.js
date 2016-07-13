/*jshint esnext:true*/
/* globals Promise */
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var dnsPacket = require('../../../app/scripts/dnssd/dns-packet');
var resRec = require('../../../app/scripts/dnssd/resource-record');
var dnsUtil = require('../../../app/scripts/dnssd/dns-util');
var dnsCodes = require('../../../app/scripts/dnssd/dns-codes');
var qSection = require('../../../app/scripts/dnssd/question-section');
var dnsController = require('../../../app/scripts/dnssd/dns-controller');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDnsSdSem() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-sd')
  ];
}

/**
 * Helper for asserting the queryFor* methods are invoked correctly.
 */
function callsQueryForResponsesHelper(
  dnssdSem,
  qName,
  qType,
  qClass,
  multipleResponses,
  timeout,
  packets,
  result,
  method,
  t
) {
  var qNameArg = null;
  var qTypeArg = null;
  var qClassArg = null;
  var multipleArg = null;
  var timeoutArg = null;
  var queryCallCount = 0;
  var querySpy = function(
    nameParam, typeParam, classParam, multParam, timeParam
  ) {
    queryCallCount += 1;
    qNameArg = nameParam;
    qTypeArg = typeParam;
    qClassArg = classParam;
    multipleArg = multParam;
    timeoutArg = timeParam;
    return Promise.resolve(packets);
  };
  dnssdSem.queryForResponses = querySpy;

  method(qName, timeout)
    .then(function resolved(services) {
      t.equal(queryCallCount, 1);
      t.equal(qNameArg, qName);
      t.equal(qTypeArg, qType);
      t.equal(qClassArg, qClass);
      t.equal(multipleArg, multipleResponses);
      t.equal(timeoutArg, timeout);
      t.deepEqual(services, result);
      t.end();
      resetDnsSdSem();
    });
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
    '../../../app/scripts/dnssd/dns-sd',
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
    '../../../app/scripts/dnssd/dns-sd',
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

test('packetIsForQuery true if appropriate resource', function(t) {
  var qName = 'www.example.com';
  var qClass = 2;
  var packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var aRecord = new resRec.ARecord(qName, 15, '15.14.13.12', qClass);
  packet.addAnswer(aRecord);

  var resourceArg = null;
  var qNameArg = null;
  var qTypeArg = null;
  var qClassArg = null;
  var filterSpy = function(
    resourceParam, qNameParam, qTypeParam, qClassParam
  ) {
    resourceArg = resourceParam;
    qNameArg = qNameParam;
    qTypeArg = qTypeParam;
    qClassArg = qClassParam;
    return [aRecord];
  };
  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        filterResourcesForQuery: filterSpy
      }
    }
  );

  var actual = dnssdSem.packetIsForQuery(
    packet, qName, aRecord.recordType, qClass
  );

  t.true(actual);
  t.deepEqual(resourceArg, [aRecord]);
  t.equal(qNameArg, qName);
  t.equal(qTypeArg, aRecord.recordType);
  t.equal(qClassArg, qClass);
  t.end();
});

test('packetIsForQuery false if resource does not match query', function(t) {
  var qName = 'www.example.com';
  var qClass = 2;
  var packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var aRecord = new resRec.ARecord(qName, 15, '15.14.13.12', qClass);
  packet.addAnswer(aRecord);

  var resourceArg = null;
  var qNameArg = null;
  var qTypeArg = null;
  var qClassArg = null;
  var filterSpy = function(
    resourceParam, qNameParam, qTypeParam, qClassParam
  ) {
    resourceArg = resourceParam;
    qNameArg = qNameParam;
    qTypeArg = qTypeParam;
    qClassArg = qClassParam;
    return [];
  };
  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        filterResourcesForQuery: filterSpy
      }
    }
  );

  var actual = dnssdSem.packetIsForQuery(
    packet, qName, aRecord.recordType, qClass
  );

  t.false(actual);
  t.deepEqual(resourceArg, [aRecord]);
  t.equal(qNameArg, qName);
  t.equal(qTypeArg, aRecord.recordType);
  t.equal(qClassArg, qClass);
  t.end();
});

test('receivedPacket calls packetIsForQuery on each packet', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');

  var packetIsForQuerySpy = sinon.spy();
  dnssdSem.packetIsForQuery = packetIsForQuerySpy;

  var first = 'a';
  var second = 'b';
  var third = 'c';
  var packets = [];
  packets.push(first);
  packets.push(second);
  packets.push(third);

  var qName = 'foobar';
  var qType = 1234;
  var qClass = 5432;
  dnssdSem.receivedResponsePacket(packets, qName, qType, qClass);

  t.equal(packetIsForQuerySpy.callCount, packets.length);
  t.true(packetIsForQuerySpy.calledWith(first, qName, qType, qClass));
  t.true(packetIsForQuerySpy.calledWith(second, qName, qType, qClass));
  t.true(packetIsForQuerySpy.calledWith(third, qName, qType, qClass));
  t.end();

  resetDnsSdSem();
});

test('receivedResponsePacket true based on resources', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');

  var packetArg = null;
  var qNameArg = null;
  var qTypeArg = null;
  var qClassArg = null;
  var packetIsForQuerySpy = function(
    packetParam, qNameParam, qTypeParam, qClassParam
  ) {
    packetArg = packetParam;
    qNameArg = qNameParam;
    qTypeArg = qTypeParam;
    qClassArg = qClassParam;
    return true;
  };

  dnssdSem.packetIsForQuery = packetIsForQuerySpy;

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

  var packets = [];
  packets.push(isResponsePacket);

  var qName = 'foo';
  var qType = 3;
  var qClass = 1;

  var actual = dnssdSem.receivedResponsePacket(packets, qName, qType, qClass);
  t.true(actual);
  t.deepEqual(packetArg, isResponsePacket);
  t.equal(qNameArg, qName);
  t.equal(qTypeArg, qType);
  t.equal(qClassArg, qClass);
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
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');

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
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  
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

  var createHostRecordsSpy = sinon.spy();
  var createServiceRecordsSpy = sinon.spy();
  dnssdSem.createHostRecords = createHostRecordsSpy;
  dnssdSem.createServiceRecords = createServiceRecordsSpy;

  var resultPromise = dnssdSem.register(host, instanceName, type, port);

  resultPromise.then(function succeeded() {
    // We are expecting to fail if the host is taken, so we should never
    // resolve.
    resetDnsSdSem();
    t.fail();
  }, function failed(failObj) {
    // We rejected, as expected because the host was taken.
    // Make sure we called issueProbe with the host
    t.equal(calledHost, host);
    t.equal(failObj.message, 'host taken: ' + host);
    // We should only ever issue a single probe.
    t.equal(issueProbeCallCount, 1);
    // We should not have registered any services
    t.equal(createHostRecordsSpy.callCount, 0);
    t.equal(createServiceRecordsSpy.callCount, 0);
    t.true(true);
    t.end();
    resetDnsSdSem();
  });
});

test('register rejects if instance taken', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  
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
    t.equal(calledHost, 'my instance._semcache._tcp.local');
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
    '../../../app/scripts/dnssd/dns-sd',
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

  var nameTypeDomain = [name, type, 'local'].join('.');
  var expectedSrvRecord = new resRec.SrvRecord(
    nameTypeDomain,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  var expectedPtrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    nameTypeDomain,
    dnsCodes.CLASS_CODES.IN
  );

  var targetReturn = [expectedSrvRecord, expectedPtrRecord];
  var actualReturn = dnssdSem.createServiceRecords(name, type, port, domain);
  t.deepEqual(actualReturn, targetReturn);

  t.equal(addRecordSpy.callCount, 2);

  var firstArgs = addRecordSpy.args[0];
  var secondArgs = addRecordSpy.args[1];

  t.equal(firstArgs[0], nameTypeDomain);
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
    '../../../app/scripts/dnssd/dns-sd',
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
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  
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
  var sendPacketSpy = sinon.spy();
  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        sendPacket: sendPacketSpy
      }
    }
  );

  var aRecord = new resRec.ARecord('domain', 11, '123.4.5.6', 5);
  var srvRecord = new resRec.SrvRecord(
    'service name',
    14,
    0,
    14,
    9988,
    'domain.local'
  );
  var records = [aRecord, srvRecord];

  var expectedPacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    false,
    false,
    false,
    false,
    false
  );
  records.forEach(record => {
    expectedPacket.addAnswer(record);
  });

  dnssdSem.advertiseService(records);

  var expectedArgs = [
    expectedPacket,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.DNSSD_PORT
  ];

  t.deepEqual(sendPacketSpy.args[0], expectedArgs);
  t.end();
  
  resetDnsSdSem();
});

test('queryForResponses times out for if no responses', function(t) {
  // we added a callback
  // we issued a query
  // we waited 2 seconds
  // we resolved with the appropriate list
  // we removed the callback

  var qName = 'hello there';
  var qType = 4;
  var qClass = 2;
  var qTime = 4000;
  // we want no packets.

  var expectedPackets = [];

  var addOnReceiveCallbackSpy = sinon.spy();
  var removeOnReceiveCallbackSpy = sinon.spy();
  var querySpy = sinon.spy();
  var waitArg = null;
  var waitSpy = function(waitParam) {
    waitArg = waitParam;
    // Don't actually wait during tests.
    return Promise.resolve();
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        addOnReceiveCallback: addOnReceiveCallbackSpy,
        removeOnReceiveCallback: removeOnReceiveCallbackSpy,
        query: querySpy
      }
    }
  );
  dnssdSem.wait = waitSpy;
  var packetIsForQueryCallCount = 0;
  dnssdSem.packetIsForQuery = function() {
    packetIsForQueryCallCount += 1;
    return true;
  };

  dnssdSem.queryForResponses(qName, qType, qClass, true, qTime)
    .then(function success(records) {
        // Assertions
        t.equal(addOnReceiveCallbackSpy.callCount, 1);
        t.equal(removeOnReceiveCallbackSpy.callCount, 1);
        // We expect to wait for 2 seconds.
        t.equal(waitArg, qTime);
        t.equal(packetIsForQueryCallCount, 0);
        t.deepEqual(records, expectedPackets);
        t.end();
        resetDnsSdSem();
    })
    .catch(function failed(err) {
      t.fail('should not have caught error: ' + err);
      t.end();
    });
});

test('queryForResponses returns immediately for single response', function(t) {
  // we added a callback
  // we issued a query
  // we waited 2 seconds
  // we resolved with the appropriate list
  // we removed the callback

  var qName = 'hello there';
  var qType = 4;
  var qClass = 2;
  var qTime = 4000;
  // Add two packets. One will have an A record and a PTR, the other will have
  // just a PTR.
  var packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  var expectedPackets = [packet1];

  var addOnReceiveCallbackCount = 0;
  var callback = null;
  var addOnReceiveCallbackSpy = function(callbackParam) {
    addOnReceiveCallbackCount += 1;
    callback = callbackParam;
    callbackParam(packet1);
  };
  var removeOnReceiveCallbackSpy = sinon.spy();
  var querySpy = sinon.spy();
  var waitArg = null;
  var waitSpy = function(waitParam) {
    waitArg = waitParam;
    // Don't actually wait during tests.
    return Promise.resolve();
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        addOnReceiveCallback: addOnReceiveCallbackSpy,
        removeOnReceiveCallback: removeOnReceiveCallbackSpy,
        query: querySpy
      }
    }
  );
  dnssdSem.wait = waitSpy;
  var packetIsForQueryCallCount = 0;
  dnssdSem.packetIsForQuery = function() {
    packetIsForQueryCallCount += 1;
    return true;
  };

  dnssdSem.queryForResponses(qName, qType, qClass, false, qTime)
    .then(function success(records) {
        // Assertions
        t.equal(addOnReceiveCallbackCount, 1);
        t.equal(removeOnReceiveCallbackSpy.callCount, 1);
        // We expect to wait for 2 seconds.
        t.equal(waitArg, qTime);
        t.equal(packetIsForQueryCallCount, 1);
        t.deepEqual(records, expectedPackets);
        t.end();
        resetDnsSdSem();
    })
    .catch(function failed(err) {
      t.fail('should not have caught error: ' + err);
      t.end();
    });
});

test('queryForResponses correct for multiple', function(t) {
  // we added a callback
  // we issued a query
  // we waited 2 seconds
  // we resolved with the appropriate list
  // we removed the callback

  var qName = '_test._name';
  var qType = 2;
  var qClass = 3;
  var qTime = 2000;
  var packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var packet2 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  var expectedPackets = [packet1, packet2];

  var addOnReceiveCallbackCount = 0;
  var addOnReceiveCallbackSpy = function(callbackParam) {
    addOnReceiveCallbackCount += 1;
    // Add both packets here when called.
    callbackParam(packet1);
    callbackParam(packet2);
  };
  var removeOnReceiveCallbackSpy = sinon.spy();
  var querySpy = sinon.spy();
  var waitArg = null;
  var waitSpy = function(waitParam) {
    waitArg = waitParam;
    // Don't actually wait during tests.
    return Promise.resolve();
  };

  var dnssdSem = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      './dns-controller':
      {
        addOnReceiveCallback: addOnReceiveCallbackSpy,
        removeOnReceiveCallback: removeOnReceiveCallbackSpy,
        query: querySpy
      }
    }
  );
  dnssdSem.wait = waitSpy;
  var packetIsForQueryCallCount = 0;
  dnssdSem.packetIsForQuery = function() {
    packetIsForQueryCallCount += 1;
    return true;
  };

  dnssdSem.queryForResponses(qName, qType, qClass, true, qTime)
    .then(function success(records) {
        // Assertions
        t.equal(addOnReceiveCallbackCount, 1);
        t.equal(removeOnReceiveCallbackSpy.callCount, 1);
        // We expect to wait for 2 seconds.
        t.equal(waitArg, qTime);
        t.equal(packetIsForQueryCallCount, 2);
        t.deepEqual(records, expectedPackets);
        t.end();
        resetDnsSdSem();
    })
    .catch(function failed(err) {
      t.fail('should not have caught error: ' + err);
      t.end();
    });
});

test('queryForServiceInstances correct', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  var serviceType = '_semcache._tcp';

  var packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var packet2 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  // Two packets, one with an A Record and both with PTR records.
  var aRecord = new resRec.ARecord(
    'www.eg.com', 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );
  var ptrRecord1 = new resRec.PtrRecord(
    serviceType, 10, 'Sam Cache', dnsCodes.CLASS_CODES.IN
  );
  var ptrRecord2 = new resRec.PtrRecord(
    serviceType, 10, 'Felix', dnsCodes.CLASS_CODES.IN
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(ptrRecord1);
  packet2.addAnswer(ptrRecord2);

  var packets = [packet1, packet2];

  var expected = [
    {
      serviceType: serviceType,
      serviceName: ptrRecord1.instanceName
    },
    {
      serviceType: serviceType,
      serviceName: ptrRecord2.instanceName
    }
  ];

  callsQueryForResponsesHelper(
    dnssdSem,
    serviceType,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN,
    true,
    112233,
    packets,
    expected,
    dnssdSem.queryForServiceInstances,
    t
  );
});


test('queryForIpAddress correct', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  var domainName = 'www.example.com';

  var packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var aRecord = new resRec.ARecord(
    domainName, 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );
  var ptrRecord1 = new resRec.PtrRecord(
    '_semcache._tcp', 10, 'Sam Cache', dnsCodes.CLASS_CODES.IN
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(ptrRecord1);

  var packets = [packet1];

  var expected = [
    {
      domainName: domainName,
      ipAddress: aRecord.ipAddress
    }
  ];

  callsQueryForResponsesHelper(
    dnssdSem,
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN,
    false,
    112233,
    packets,
    expected,
    dnssdSem.queryForIpAddress,
    t
  );
});

test('queryForInstanceInfo correct', function(t) {
  var dnssdSem = require('../../../app/scripts/dnssd/dns-sd');
  var instanceName = 'Sams Cache._semcache._tcp.local';

  var packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  var aRecord = new resRec.ARecord(
    'www.foo.org', 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );
  var srvRecord = new resRec.SrvRecord(
    instanceName, 100, 0, 10, 7777, 'blackhawk.local'
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(srvRecord);

  var packets = [packet1];

  var expected = [
    {
      instanceName: instanceName,
      domain: srvRecord.targetDomain,
      port: srvRecord.port
    }
  ];

  callsQueryForResponsesHelper(
    dnssdSem,
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN,
    false,
    112233,
    packets,
    expected,
    dnssdSem.queryForInstanceInfo,
    t
  );
});
