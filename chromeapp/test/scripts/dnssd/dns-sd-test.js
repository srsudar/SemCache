/*jshint esnext:true*/
'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

const dnsPacket = require('../../../app/scripts/dnssd/dns-packet');
const resRec = require('../../../app/scripts/dnssd/resource-record');
const dnsUtil = require('../../../app/scripts/dnssd/dns-util');
const dnsCodes = require('../../../app/scripts/dnssd/dns-codes');
const qSection = require('../../../app/scripts/dnssd/question-section');
const dnsController = require('../../../app/scripts/dnssd/dns-controller');

let dnssd = require('../../../app/scripts/dnssd/dns-sd');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDnsSd() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-sd')
  ];
  dnssd = require('../../../app/scripts/dnssd/dns-sd');
}

/**
 * Proxyquire the dnssd object with proxies passed as the proxied modules.
 */
function proxyquireDnsSd(proxies) {
  dnssd = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    proxies
  );
}

/**
 * Helper for asserting that getUserFriendlyName() returns the expected user
 * friendly name. Calls getUserFriendlyName() and asserts that the result is
 * equal to expected
 *
 * @param {string} instanceTypeDomain the argument that will be passed to
 * getUserFriendlyName()
 * @param {string} expected the user friendly name expected as a result
 */
function verifyUserFriendlyNameHelper(instanceTypeDomain, expected, t) {
  let actual = dnssd.getUserFriendlyName(instanceTypeDomain);
  t.equal(actual, expected);
  t.end();
}

/**
 * Helper for asserting that getUserFriendlyName() returns the expected user
 * friendly name. Calls getUserFriendlyName() and asserts that the result is
 * equal to expected
 *
 * @param {string} instanceTypeDomain the argument that will be passed to
 * getUserFriendlyName()
 * @param {string} expected the user friendly name expected as a result
 */
function verifyUserFriendlyNameHelper(instanceTypeDomain, expected, t) {
  let dnssdSem = require('../../../app/scripts/dnssd/dns-sd');

  let actual = dnssdSem.getUserFriendlyName(instanceTypeDomain);
  t.equal(actual, expected);
  t.end();
}

/**
 * Helper for asserting the queryFor* methods are invoked correctly.
 */
function callsQueryForResponsesHelper(
  qName,
  qType,
  qClass,
  multipleResponses,
  timeout,
  numRetries,
  packets,
  result,
  methodName,
  getUserFriendlyNameSpy,
  t
) {
  dnssd = proxyquire(
    '../../../app/scripts/dnssd/dns-sd',
    {
      '../util': {
        wait: sinon.stub().resolves()
      }
    }
  );
  let queryForResponsesSpy = sinon.stub().resolves(packets);
  dnssd.queryForResponses = queryForResponsesSpy;
  if (getUserFriendlyNameSpy) {
    dnssd.getUserFriendlyName = getUserFriendlyNameSpy;
  }

  dnssd[methodName](qName, timeout, numRetries)
  .then(function resolved(services) {
    let qNameArg = queryForResponsesSpy.args[0][0];
    let qTypeArg = queryForResponsesSpy.args[0][1];
    let qClassArg = queryForResponsesSpy.args[0][2];
    let multipleArg = queryForResponsesSpy.args[0][3];
    let timeoutArg = queryForResponsesSpy.args[0][4];
    let numRetriesArg = queryForResponsesSpy.args[0][5];

    t.true(queryForResponsesSpy.calledOnce);
    t.equal(qNameArg, qName);
    t.equal(qTypeArg, qType);
    t.equal(qClassArg, qClass);
    t.equal(multipleArg, multipleResponses);
    t.equal(timeoutArg, timeout);
    t.equal(numRetriesArg, numRetries);
    t.deepEqual(services, result);
    t.end();

    resetDnsSd();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
}

/**
 * Helper for the case that no packets are returned.
 */
function queryForResponsesNoPacketsHelper(numRetries, t) {
  // we added a callback
  // we issued a query
  // we waited 2 seconds
  // we resolved with the appropriate list
  // we removed the callback

  let qName = 'hello there';
  let qType = 4;
  let qClass = 2;
  let qTime = 4000;
  // we want no packets.
  let expectedPackets = [];

  let addOnReceiveCallbackSpy = sinon.spy();
  let removeOnReceiveCallbackSpy = sinon.spy();
  let querySpy = sinon.spy();
  let packetIsForQuerySpy = sinon.stub().returns(true);
  let waitSpy = sinon.stub().resolves();

  proxyquireDnsSd({
    './dns-controller': {
      addOnReceiveCallback: addOnReceiveCallbackSpy,
      removeOnReceiveCallback: removeOnReceiveCallbackSpy,
      query: querySpy
    },
    '../util': {
      wait: waitSpy
    }
  });
  dnssd.packetIsForQuery = packetIsForQuerySpy;

  let totalQueries = numRetries + 1;
  dnssd.queryForResponses(qName, qType, qClass, true, qTime, numRetries)
  .then(function success(records) {
    // Assertions
    t.equal(addOnReceiveCallbackSpy.callCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);

    t.equal(querySpy.callCount, totalQueries);
    t.equal(waitSpy.callCount, totalQueries);

    for (let i = 0; i < totalQueries; i++) {
      t.deepEqual(querySpy.args[i], [qName, qType, qClass]);
      t.deepEqual(waitSpy.args[i], [qTime]);
    }

    t.equal(packetIsForQuerySpy.callCount, 0);
    t.deepEqual(records, expectedPackets);
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
}

/**
 * Helper function for ensuring that queryForResponses resolves after the
 * correct number of calls for a single packet.
 *
 * @param {integer} numRetries passed to queryForResponses
 * @param {integer} resolveOnNum the single packet will be passed to the
 * function via the callback on the resolveOnNum call to query
 * @param {tape} t not ended
 */
function queryForResponsesSinglePacketHelper(numRetries, resolveOnNum, t) {
  // Make sure we handle automatic retries as expected

  let qName = 'hello there';
  let qType = 4;
  let qClass = 2;
  let qTime = 4000;
  let packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  let expectedPackets = [packet1];

  let addOnReceiveCallbackCount = 0;
  let callback = null;
  let addOnReceiveCallbackSpy = function(callbackParam) {
    addOnReceiveCallbackCount += 1;
    callback = callbackParam;
  };
  let removeOnReceiveCallbackSpy = sinon.spy();

  // In this case the magic is going to happen in our spy function. We don't
  // want to invoke the callback until the last call.
  let numQueryCalls = 0;
  let querySpy = sinon.spy(function() {
    numQueryCalls += 1;
    console.log('calling query');
    console.log('numQueryCalls: ', numQueryCalls);
    if (numQueryCalls === resolveOnNum) {
      callback(packet1);
    }
  });

  let waitSpy = sinon.stub().resolves();
  let packetIsForQuerySpy = sinon.stub().returns(true);

  proxyquireDnsSd({
    './dns-controller': {
      addOnReceiveCallback: addOnReceiveCallbackSpy,
      removeOnReceiveCallback: removeOnReceiveCallbackSpy,
      query: querySpy
    },
    '../util': {
      wait: waitSpy
    }
  });
  dnssd.packetIsForQuery = packetIsForQuerySpy;

  dnssd.queryForResponses(qName, qType, qClass, false, qTime, numRetries)
  .then(function success(records) {
    // Assertions
    t.equal(addOnReceiveCallbackCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);

    // Make sure we called query and wait as many times as we're supposed to.
    t.equal(querySpy.callCount, resolveOnNum);
    for (let i = 0; i < resolveOnNum; i++) {
      t.deepEqual(querySpy.args[i], [qName, qType, qClass]);
      // We expect to wait for 2 seconds.
      t.equal(waitSpy.args[i][0], qTime);
    }

    t.equal(packetIsForQuerySpy.callCount, 1);
    t.deepEqual(records, expectedPackets);
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
}

/**
 * Helper to reject a probe promise due to receiving packets.
 *
 * returnTrueAfterCall: the call number after which receivedResponsePacket
 *   should return true.
 */
function probeRejectsHelper(returnTrueAfterCall, t) {
  let addOnReceiveCallbackSpy = sinon.spy();
  let removeOnReceiveCallbackSpy = sinon.spy();

  let receivedResponsePacketCallCount = 0;
  let receivedResponsePacketSpy = function() {
    if (receivedResponsePacketCallCount === returnTrueAfterCall) {
      receivedResponsePacketCallCount += 1;
      return true;
    } else {
      receivedResponsePacketCallCount += 1;
      return false;
    }
  };

  proxyquireDnsSd({
    './dns-controller': {
      addOnReceiveCallback: addOnReceiveCallbackSpy,
      removeOnReceiveCallback: removeOnReceiveCallbackSpy,
      query: sinon.stub()
    },
    '../util': {
      wait: sinon.stub().resolves()
    }
  });
  dnssd.receivedResponsePacket = receivedResponsePacketSpy;

  dnssd.issueProbe('queryname', 4, 5)
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(function failure() {
    // our promise didn't resolve, meaning we failed.
    // We should have been called one more than we were permitting (i.e. a call
    // on the 0th call leads to a single call
    t.equal(returnTrueAfterCall + 1, receivedResponsePacketCallCount);
    t.equal(addOnReceiveCallbackSpy.callCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);
    t.end();
    resetDnsSd();
  });
}

/**
 * Generate service records for use in testing browseServiceInstances.
 *
 * @param {string} serviceType the service type that will be browsed for
 * @param {integer} numServices the number of services to be discovered. The
 * returned array will be of this length.
 *
 * @return {Array<object>} an Array of objects like the following. The PTR,
 * SRV, and A records will be automatically generated (i.e. with names like
 * 'Cache 1' and plugged in to talk to each other.
 * {
 *   ptr: ptr info,
 *   srv: srv info,
 *   aRec: a record,
 *   friendlyName: friendlyName,
 *   expected: the expected object from a full resolution
 * }
 */
function generateFakeRecords(serviceType, numServices) {
  let result = [];
  let localSuffix = 'local';
  let startPort = 8888;

  for (let i = 0; i < numServices; i++) {
    let friendlyName = 'Cache No ' + i;
    let fullyResolvedName = [friendlyName, serviceType, localSuffix].join('.');
    let port = i + startPort;
    let ipAddress = [i, i, i, i].join('.');
    let domainName = 'domain' + i + '.' + localSuffix;

    let ptr = {
      serviceType: serviceType,
      serviceName: fullyResolvedName
    };
    let srv = {
      instanceName: fullyResolvedName,
      domain: domainName,
      port: port
    };
    let aRec = {
      domainName: domainName,
      ipAddress: ipAddress
    };

    let expected = {
      serviceType: serviceType,
      friendlyName: friendlyName,
      domainName: domainName,
      ipAddress: ipAddress,
      port: port,
      instanceName: fullyResolvedName
    };

    let element = {
      ptr: ptr,
      srv: srv,
      aRec: aRec,
      friendlyName: friendlyName,
      expected: expected
    };

    result.push(element);
  }

  return result;
}

test('issueProbe succeeds correctly', function(t) {
  let addOnReceiveCallbackSpy = sinon.spy();
  let removeOnReceiveCallbackSpy = sinon.spy();
  let receivedResponsePacketSpy = sinon.stub().returns(false);

  proxyquireDnsSd({
    './dns-controller':
    {
      addOnReceiveCallback: addOnReceiveCallbackSpy,
      removeOnReceiveCallback: removeOnReceiveCallbackSpy,
      query: sinon.stub()
    },
    '../util': {
      wait: sinon.stub().resolves()
    }
  });

  dnssd.receivedResponsePacket = receivedResponsePacketSpy;

  let issuePromise = dnssd.issueProbe('queryname', 4, 5);
  issuePromise.then(function success() {
    t.equal(receivedResponsePacketSpy.callCount, 3);
    t.true(addOnReceiveCallbackSpy.calledOnce);
    t.true(removeOnReceiveCallbackSpy.calledOnce);
    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
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
  let qName = 'www.example.com';
  let qClass = 2;
  let packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let aRecord = new resRec.ARecord(qName, 15, '15.14.13.12', qClass);
  packet.addAnswer(aRecord);


  let filterSpy = sinon.stub().returns([aRecord]);

  proxyquireDnsSd({
    './dns-controller':
    {
      filterResourcesForQuery: filterSpy
    }
  });

  let actual = dnssd.packetIsForQuery(
    packet, qName, aRecord.recordType, qClass
  );

  t.true(actual);
  t.deepEqual(filterSpy.args[0][0], [aRecord]);
  t.equal(filterSpy.args[0][1], qName);
  t.equal(filterSpy.args[0][2], aRecord.recordType);
  t.equal(filterSpy.args[0][3], qClass);
  t.end();
});

test('packetIsForQuery false if resource does not match query', function(t) {
  let qName = 'www.example.com';
  let qClass = 2;
  let packet = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let aRecord = new resRec.ARecord(qName, 15, '15.14.13.12', qClass);
  packet.addAnswer(aRecord);

  let filterSpy = sinon.stub().returns([]);

  proxyquireDnsSd({
    './dns-controller':
    {
      filterResourcesForQuery: filterSpy
    }
  });

  let actual = dnssd.packetIsForQuery(
    packet, qName, aRecord.recordType, qClass
  );

  t.false(actual);
  t.deepEqual(filterSpy.args[0][0], [aRecord]);
  t.equal(filterSpy.args[0][1], qName);
  t.equal(filterSpy.args[0][2], aRecord.recordType);
  t.equal(filterSpy.args[0][3], qClass);
  t.end();
});

test('receivedPacket calls packetIsForQuery on each packet', function(t) {
  let packetIsForQuerySpy = sinon.spy();
  dnssd.packetIsForQuery = packetIsForQuerySpy;

  let first = 'a';
  let second = 'b';
  let third = 'c';
  let packets = [];
  packets.push(first);
  packets.push(second);
  packets.push(third);

  let qName = 'foobar';
  let qType = 1234;
  let qClass = 5432;
  dnssd.receivedResponsePacket(packets, qName, qType, qClass);

  t.equal(packetIsForQuerySpy.callCount, packets.length);
  t.true(packetIsForQuerySpy.calledWith(first, qName, qType, qClass));
  t.true(packetIsForQuerySpy.calledWith(second, qName, qType, qClass));
  t.true(packetIsForQuerySpy.calledWith(third, qName, qType, qClass));
  t.end();

  resetDnsSd();
});

test('receivedResponsePacket true based on resources', function(t) {
  let packetIsForQuerySpy = sinon.stub().returns(true);

  dnssd.packetIsForQuery = packetIsForQuerySpy;

  let isResponsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    true,
    false,
    false,
    false,
    0
  );

  let packets = [];
  packets.push(isResponsePacket);

  let qName = 'foo';
  let qType = 3;
  let qClass = 1;

  let actual = dnssd.receivedResponsePacket(packets, qName, qType, qClass);
  t.true(actual);
  t.deepEqual(packetIsForQuerySpy.args[0][0], isResponsePacket);
  t.equal(packetIsForQuerySpy.args[0][1], qName);
  t.equal(packetIsForQuerySpy.args[0][2], qType);
  t.equal(packetIsForQuerySpy.args[0][3], qClass);
  t.end();

  resetDnsSd();
});

test('receivedResponsePacket false correctly', function(t) {
  // Three conditions where this is false:
  // 1) received no packets
  // 2) received a packet that is NOT for the query
  // 3) received a packet for the query that is NOT a response
  // Should be false if the packet is not for the query and it is a query
  // packet

  let packets = [];

  let queryName = 'foo';

  // 1) received no packets
  let actualForNoPackets = dnssd.receivedResponsePacket(packets, queryName);
  t.false(actualForNoPackets);

  // 2) received packet NOT for this query
  // Make a packet that is a response but is not for this query.
  let packetNotForQuery = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    true,
    false,
    false,
    false,
    0
  );
  let questionForOtherQuery = new qSection.QuestionSection(
    'other query',
    2,
    5
  );
  packetNotForQuery.addQuestion(questionForOtherQuery);
  packets = [packetNotForQuery];
  let actualForOtherQuery = dnssd.receivedResponsePacket(
    packets,
    queryName
  );
  t.false(actualForOtherQuery);

  // 3) received packet for this query that is a question
  let packetForQuery = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    true,
    false,
    false,
    false,
    0
  );
  let questionForThisQuery = new qSection.QuestionSection(
    queryName,
    2,
    5
  );
  packetForQuery.addQuestion(questionForThisQuery);
  packets = [packetForQuery];
  let actualForQuestion = dnssd.receivedResponsePacket(
    [packetForQuery],
    queryName
  );
  t.false(actualForQuestion);

  t.end();
  resetDnsSd();
});

test('register rejects if host taken', function(t) {
  let host = 'hostname.local';
  let instanceName = 'my instance';
  let type = '_semcache._tcp';
  let port = 1234;

  proxyquireDnsSd({
    '../util': {
      wait: sinon.stub().resolves()
    }
  });

  let issueProbeSpy = sinon.stub().rejects('auto reject of probe');
  dnssd.issueProbe = issueProbeSpy;

  let createHostRecordsSpy = sinon.spy();
  let createServiceRecordsSpy = sinon.spy();
  dnssd.createHostRecords = createHostRecordsSpy;
  dnssd.createServiceRecords = createServiceRecordsSpy;

  dnssd.register(host, instanceName, type, port)
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(failObj => {
    // We rejected, as expected because the host was taken.
    // Make sure we called issueProbe with the host
    t.equal(issueProbeSpy.args[0][0], host);
    t.equal(failObj.message, 'host taken: ' + host);
    // We should only ever issue a single probe.
    t.equal(issueProbeSpy.callCount, 1);
    // We should not have registered any services
    t.equal(createHostRecordsSpy.callCount, 0);
    t.equal(createServiceRecordsSpy.callCount, 0);
    t.true(true);
    t.end();
    resetDnsSd();
  });
});

test('register rejects if instance taken', function(t) {
  let host = 'hostname.local';
  let instanceName = 'my instance';
  let type = '_semcache._tcp';
  let port = 1234;

  let issueProbeSpy = sinon.stub();
  issueProbeSpy.onCall(0).resolves('auto resolve of probe');
  issueProbeSpy.onCall(1).rejects('auto reject of probe');
  dnssd.issueProbe = issueProbeSpy;

  dnssd.register(host, instanceName, type, port)
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(failObj => {
    // We rejected, as expected because the instance was taken.
    // Make sure we called issueProbe with the instance
    t.equal(issueProbeSpy.args[0][0], host);
    t.equal(issueProbeSpy.args[1][0], 'my instance._semcache._tcp.local');
    t.equal(failObj.message, 'instance taken: ' + instanceName);
    // We should issue two probes.
    t.equal(issueProbeSpy.callCount, 2);
    t.true(true);
    t.end();
    resetDnsSd();
  });
});

test('createServiceRecords creates and returns', function(t) {
  let addRecordSpy = sinon.spy();
  proxyquireDnsSd({
    './dns-controller':
    {
      addRecord: addRecordSpy
    }
  });
  
  let name = 'fancy name';
  let type = '_semcache._tcp';
  let port = 8817;
  let domain = 'computer.local';

  let nameTypeDomain = [name, type, 'local'].join('.');
  let expectedSrvRecord = new resRec.SrvRecord(
    nameTypeDomain,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  let expectedPtrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    nameTypeDomain,
    dnsCodes.CLASS_CODES.IN
  );

  let targetReturn = [expectedSrvRecord, expectedPtrRecord];
  let actualReturn = dnssd.createServiceRecords(name, type, port, domain);
  t.deepEqual(actualReturn, targetReturn);

  t.equal(addRecordSpy.callCount, 2);

  let firstArgs = addRecordSpy.args[0];
  let secondArgs = addRecordSpy.args[1];

  t.equal(firstArgs[0], nameTypeDomain);
  t.deepEqual(firstArgs[1], expectedSrvRecord);

  t.equal(secondArgs[0], type);
  t.deepEqual(secondArgs[1], expectedPtrRecord);

  t.end();
  resetDnsSd();
});

test('createHostRecords calls to create records correctly', function(t) {
  let iface = {
    name: 'eth0',
    address: '123.456.789.91',
    prefixLength: 0
  };

  let host = 'hostname.local';

  let expectedRecord = new resRec.ARecord(
    host,
    dnsUtil.DEFAULT_TTL,
    iface.address,
    dnsCodes.CLASS_CODES.IN
  );

  let addRecordSpy = function(hostParam, recordParam) {
    t.equal(hostParam, host);
    t.deepEqual(recordParam, expectedRecord);
  };

  proxyquireDnsSd({
    './dns-controller':
    {
      addRecord: addRecordSpy,
      getIPv4Interfaces: sinon.stub().returns([iface])
    }
  });

  let actualReturn = dnssd.createHostRecords(host);
  let expectedReturn = [expectedRecord];
  t.deepEqual(actualReturn, expectedReturn);
  t.end();
  resetDnsSd();
});

test('register resolves if name and host probe succeed', function(t) {
  let host = 'hostname.local';
  let instanceName = 'my instance';
  let type = '_semcache._tcp';
  let port = 1234;

  let issueProbeSpy = sinon.stub().resolves('auto succeed in spy');
  dnssd.issueProbe = issueProbeSpy;

  let hostRecord = ['a'];
  let createHostRecordsSpy = sinon.stub().returns(hostRecord);

  let serviceRecords = ['b', 'c'];
  let createServiceRecordsSpy = sinon.stub().returns(serviceRecords);

  let allRecords = hostRecord.concat(serviceRecords);

  let advertiseServiceSpy = sinon.spy();

  dnssd.createHostRecords = createHostRecordsSpy;
  dnssd.createServiceRecords = createServiceRecordsSpy;
  dnssd.advertiseService = advertiseServiceSpy;

  let resultPromise = dnssd.register(host, instanceName, type, port);

  let expected = {
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
    t.equal(issueProbeSpy.callCount, 2);

    // We should have called createServiceRecords with the correct params.
    t.equal(createServiceRecordsSpy.args[0][0], instanceName);
    t.equal(createServiceRecordsSpy.args[0][1], type);
    t.equal(createServiceRecordsSpy.args[0][2], port);
    t.equal(createServiceRecordsSpy.args[0][3], host);

    // We should have called createHostRecords with the correct params.
    t.equal(createHostRecordsSpy.args[0][0], host);
    
    // And finally, we should have called advertiseService with all the records
    // we created.
    t.true(advertiseServiceSpy.calledOnce);
    t.deepEqual(advertiseServiceSpy.args[0][0], allRecords);

    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('advertiseService advertises', function(t) {
  let sendPacketSpy = sinon.spy();
  proxyquireDnsSd({
    './dns-controller': {
      sendPacket: sendPacketSpy
    }
  });

  let aRecord = new resRec.ARecord('domain', 11, '123.4.5.6', 5);
  let srvRecord = new resRec.SrvRecord(
    'service name',
    14,
    0,
    14,
    9988,
    'domain.local'
  );
  let records = [aRecord, srvRecord];

  let expectedPacket = new dnsPacket.DnsPacket(
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

  dnssd.advertiseService(records);

  let expectedArgs = [
    expectedPacket,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.MDNS_PORT
  ];

  t.deepEqual(sendPacketSpy.args[0], expectedArgs);
  t.end();
  
  resetDnsSd();
});

test('queryForResponses times out for if no responses', function(t) {
  // no retries
  queryForResponsesNoPacketsHelper(0, t);

  // 3 retries
  queryForResponsesNoPacketsHelper(3, t);

  t.end();
  resetDnsSd();
});

test('queryForResponses handles retry attempts for single', function(t) {
  // no retries
  queryForResponsesSinglePacketHelper(0, 1, t);

  // 4 retries
  queryForResponsesSinglePacketHelper(4, 5, t);

  // Ask for 4 retries, but resolve after the 1st.
  queryForResponsesSinglePacketHelper(4, 1, t);

  t.end();
  resetDnsSd();
});

test('queryForResponses correct for multiple', function(t) {
  // we added a callback
  // we issued a query
  // we waited 2 seconds
  // we resolved with the appropriate list
  // we removed the callback

  let qName = '_test._name';
  let qType = 2;
  let qClass = 3;
  let qTime = 2000;
  let packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let packet2 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );

  let expectedPackets = [packet1, packet2];

  let addOnReceiveCallbackCount = 0;
  let addOnReceiveCallbackSpy = function(callbackParam) {
    addOnReceiveCallbackCount += 1;
    // Add both packets here when called.
    callbackParam(packet1);
    callbackParam(packet2);
  };
  let removeOnReceiveCallbackSpy = sinon.spy();
  let querySpy = sinon.spy();
  let waitSpy = sinon.stub().resolves();
  let packetIsForQuerySpy = sinon.stub().resolves(true);

  proxyquireDnsSd({
    './dns-controller': {
      addOnReceiveCallback: addOnReceiveCallbackSpy,
      removeOnReceiveCallback: removeOnReceiveCallbackSpy,
      query: querySpy
    },
    '../util': {
      wait: waitSpy
    }
  });
  dnssd.packetIsForQuery = packetIsForQuerySpy;

  dnssd.queryForResponses(qName, qType, qClass, true, qTime, 0)
  .then(function success(records) {
    // Assertions
    t.equal(addOnReceiveCallbackCount, 1);
    t.equal(removeOnReceiveCallbackSpy.callCount, 1);
    t.true(querySpy.calledWith(qName, qType, qClass));
    // We expect to wait for 2 seconds.
    t.equal(waitSpy.args[0][0], qTime);
    t.equal(packetIsForQuerySpy.callCount, 2);
    t.deepEqual(records, expectedPackets);
    t.end();
    resetDnsSd();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('queryForServiceInstances correct', function(t) {
  let serviceType = '_semcache._tcp';

  let packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let packet2 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  // Two packets, one with an A Record and both with PTR records.
  let aRecord = new resRec.ARecord(
    'www.eg.com', 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );

  let friendlyName1 = 'Sam Cache';
  let friendlyName2 = 'Felix';
  let serviceName1 = friendlyName1 + '.' + serviceType + '.local';
  let serviceName2 = friendlyName2 + '.' + serviceType + '.local';
  let ptrRecord1 = new resRec.PtrRecord(
    serviceType, 10, serviceName1, dnsCodes.CLASS_CODES.IN
  );
  let ptrRecord2 = new resRec.PtrRecord(
    serviceType, 10, serviceName2, dnsCodes.CLASS_CODES.IN
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(ptrRecord1);
  packet2.addAnswer(ptrRecord2);

  // Since we can have multiple packets, even from the same machine (e.g. if we
  // issue queries for PTR records twice), we need to ensure that we de-dupe
  // our responses. For that reason add one packet twice.
  let packets = [packet1, packet2, packet1];

  let expected = [
    {
      serviceType: serviceType,
      serviceName: ptrRecord1.instanceName,
      friendlyName: friendlyName1
    },
    {
      serviceType: serviceType,
      serviceName: ptrRecord2.instanceName,
      friendlyName: friendlyName2
    }
  ];
  let getUserFriendlyNameSpy = sinon.stub();
  getUserFriendlyNameSpy.withArgs(serviceName1).returns(friendlyName1);
  getUserFriendlyNameSpy.withArgs(serviceName2).returns(friendlyName2);

  console.log(expected);

  callsQueryForResponsesHelper(
    serviceType,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN,
    true,
    112233,
    2,
    packets,
    expected,
    'queryForServiceInstances',
    getUserFriendlyNameSpy,
    t
  );
});

test('queryForServiceInstances rejects if error', function(t) {
  let expected = { error: 'woe2me' };
  dnssd.queryForResponses = sinon.stub().rejects(expected);
  dnssd.queryForServiceInstances()
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetDnsSd();
  });
});

test('queryForIpAddress correct', function(t) {
  let domainName = 'www.example.com';

  let packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let aRecord = new resRec.ARecord(
    domainName, 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );
  let ptrRecord1 = new resRec.PtrRecord(
    '_semcache._tcp', 10, 'Sam Cache', dnsCodes.CLASS_CODES.IN
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(ptrRecord1);

  let packets = [packet1];

  let expected = [
    {
      domainName: domainName,
      ipAddress: aRecord.ipAddress
    }
  ];

  callsQueryForResponsesHelper(
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN,
    false,
    112233,
    4,
    packets,
    expected,
    'queryForIpAddress',
    null,
    t
  );
});

test('queryForIpAddress rejects if error', function(t) {
  let expected = { error: 'trouble' };
  dnssd.queryForResponses = sinon.stub().rejects(expected);
  dnssd.queryForIpAddress()
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetDnsSd();
  });
});

test('queryForInstanceInfo correct', function(t) {
  let instanceName = 'Sams Cache._semcache._tcp.local';

  let packet1 = new dnsPacket.DnsPacket(
    0, false, 0, false, false, false, false, 0
  );
  let aRecord = new resRec.ARecord(
    'www.foo.org', 100, '1.2.3.4', dnsCodes.CLASS_CODES.IN
  );
  let srvRecord = new resRec.SrvRecord(
    instanceName, 100, 0, 10, 7777, 'blackhawk.local'
  );

  packet1.addAnswer(aRecord);
  packet1.addAnswer(srvRecord);

  let packets = [packet1];

  let expected = [
    {
      instanceName: instanceName,
      domain: srvRecord.targetDomain,
      port: srvRecord.port
    }
  ];

  callsQueryForResponsesHelper(
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN,
    false,
    112233,
    12,
    packets,
    expected,
    'queryForInstanceInfo',
    null,
    t
  );
});

test('queryForInstanceInfo rejects if error', function(t) {
  let expected = { error: 'whoopsy daisy' };
  dnssd.queryForResponses = sinon.stub().rejects(expected);
  dnssd.queryForInstanceInfo()
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetDnsSd();
  });
});

test('browseServiceInstances handles dropped SRV', function(t) {
  // It might occur that we get two PTR records but from those only resolve a
  // single SRV. In this case, we should not request an A record and should
  // fail gracefully.

  let serviceType = '_semcache._tcp'; 
  let records = generateFakeRecords(serviceType, 3);

  // Return all 3 PTRs.
  let queryForServiceInstancesSpy = sinon.stub();
  queryForServiceInstancesSpy.resolves([
    records[0].ptr, records[1].ptr, records[2].ptr
  ]);

  // Return only the 1st and 3rd SRVs. We drop the 2nd, returning an empty
  // array indicating no response.
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].srv.instanceName)
    .resolves([records[0].srv]);
  queryForInstanceInfoSpy.withArgs(records[1].srv.instanceName)
    .resolves([]);
  queryForInstanceInfoSpy.withArgs(records[2].srv.instanceName)
    .resolves([records[2].srv]);

  // Return only the 1st and 3rd As.
  let queryForIpAddressSpy = sinon.stub();
  queryForIpAddressSpy.withArgs(records[0].srv.domain)
    .resolves([records[0].aRec]);
  queryForIpAddressSpy.withArgs(records[2].srv.domain)
    .resolves([records[2].aRec]);

  let getUserFriendlyNameSpy = sinon.stub();
  getUserFriendlyNameSpy.withArgs(records[0].srv.instanceName)
    .returns(records[0].friendlyName);
  getUserFriendlyNameSpy.withArgs(records[2].srv.instanceName)
    .returns(records[2].friendlyName);

  dnssd.queryForServiceInstances = queryForServiceInstancesSpy;
  dnssd.queryForIpAddress = queryForIpAddressSpy;
  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;
  dnssd.getUserFriendlyName = getUserFriendlyNameSpy;

  let resultPromise = dnssd.browseServiceInstances(serviceType);
  resultPromise.then(function gotInstances(instances) {
    // Each spy called the appropriate number of times with the appropriate
    // arguments
    // 1 call resolves all services
    t.equal(queryForServiceInstancesSpy.callCount, 1);
    // 3 PTR infos means 3 SRV requests
    t.equal(queryForInstanceInfoSpy.callCount, 3);
    // 2 SRV records, 2 A records
    t.equal(queryForIpAddressSpy.callCount, 2);

    // Called with correct args
    // PTR records
    t.deepEqual(
      queryForServiceInstancesSpy.args[0],
      [
        serviceType,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_PTR_RETRIES
      ]
    );

    // SRV records should query for 3
    for (let srvQueryIter = 0; srvQueryIter < records.length; srvQueryIter++) {
      t.deepEqual(
        queryForInstanceInfoSpy.args[srvQueryIter],
        [
          records[srvQueryIter].ptr.serviceName,
          dnssd.DEFAULT_QUERY_WAIT_TIME,
          dnssd.DEFAULT_NUM_RETRIES
        ]
      );
    }

    // A records
    t.deepEqual(
      queryForIpAddressSpy.args[0],
      [
        records[0].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );
    t.deepEqual(
      queryForIpAddressSpy.args[1],
      [
        records[2].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // Result promise resolves with the correct objects.
    t.deepEqual(instances, [records[0].expected, records[2].expected]);
    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('browseServiceInstances handles dropped A', function(t) {
  // It might occur that we get two SRV records but from those only resolve a
  // single SRV. In this case, we should not request an A record and should
  // fail gracefully.

  let serviceType = '_semcache._tcp'; 
  let records = generateFakeRecords(serviceType, 3);

  // Return all 3 PTRs.
  let queryForServiceInstancesSpy = sinon.stub();
  queryForServiceInstancesSpy.resolves([
    records[0].ptr, records[1].ptr, records[2].ptr
  ]);

  // Return all 3 SRVs.
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].srv.instanceName)
    .resolves([records[0].srv]);
  queryForInstanceInfoSpy.withArgs(records[1].srv.instanceName)
    .resolves([records[1].srv]);
  queryForInstanceInfoSpy.withArgs(records[2].srv.instanceName)
    .resolves([records[2].srv]);

  // Return only the 1st and 2nd As.
  let queryForIpAddressSpy = sinon.stub();
  queryForIpAddressSpy.withArgs(records[0].srv.domain)
    .resolves([records[0].aRec]);
  queryForIpAddressSpy.withArgs(records[1].srv.domain)
    .resolves([records[1].aRec]);
  queryForIpAddressSpy.withArgs(records[2].srv.domain)
    .resolves([]);

  let getUserFriendlyNameSpy = sinon.stub();
  getUserFriendlyNameSpy.withArgs(records[0].srv.instanceName)
    .returns(records[0].friendlyName);
  getUserFriendlyNameSpy.withArgs(records[1].srv.instanceName)
    .returns(records[1].friendlyName);

  dnssd.queryForServiceInstances = queryForServiceInstancesSpy;
  dnssd.queryForIpAddress = queryForIpAddressSpy;
  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;
  dnssd.getUserFriendlyName = getUserFriendlyNameSpy;

  let resultPromise = dnssd.browseServiceInstances(serviceType);
  resultPromise.then(function gotInstances(instances) {
    // Each spy called the appropriate number of times with the appropriate
    // arguments
    // 1 call resolves all services
    t.equal(queryForServiceInstancesSpy.callCount, 1);
    // 3 PTR infos means 3 SRV requests
    t.equal(queryForInstanceInfoSpy.callCount, 3);
    // 3 SRV records, 3 A records
    t.equal(queryForIpAddressSpy.callCount, 3);

    // Called with correct args
    // PTR records
    t.deepEqual(
      queryForServiceInstancesSpy.args[0],
      [
        serviceType,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_PTR_RETRIES
      ]
    );

    // SRV records
    for (let srvQueryIter = 0; srvQueryIter < records.length; srvQueryIter++) {
      t.deepEqual(
        queryForInstanceInfoSpy.args[srvQueryIter],
        [
          records[srvQueryIter].ptr.serviceName,
          dnssd.DEFAULT_QUERY_WAIT_TIME,
          dnssd.DEFAULT_NUM_RETRIES
        ]
      );
    }

    // A records
    t.deepEqual(
      queryForIpAddressSpy.args[0],
      [
        records[0].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );
    t.deepEqual(
      queryForIpAddressSpy.args[1],
      [
        records[1].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // Result promise resolves with the correct objects.
    t.deepEqual(instances, [records[0].expected, records[1].expected]);
    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('browseServiceInstances queries all types and returns', function(t) {
  let serviceType = '_semcache._tcp';
  let records = generateFakeRecords(serviceType, 2);

  // PTR records
  let queryForServiceInstancesSpy = sinon.stub();
  queryForServiceInstancesSpy.resolves([
    records[0].ptr, records[1].ptr
  ]);

  // SRV records
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].ptr.serviceName)
    .resolves([records[0].srv]);
  queryForInstanceInfoSpy.withArgs(records[1].ptr.serviceName)
    .resolves([records[1].srv]);

  // A records
  let queryForIpAddressSpy = sinon.stub();
  queryForIpAddressSpy.withArgs(records[0].srv.domain)
    .resolves([records[0].aRec]);
  queryForIpAddressSpy.withArgs(records[1].srv.domain)
    .resolves([records[1].aRec]);

  let getUserFriendlyNameSpy = sinon.stub();
  getUserFriendlyNameSpy.withArgs(records[0].ptr.serviceName)
    .returns(records[0].friendlyName);
  getUserFriendlyNameSpy.withArgs(records[1].ptr.serviceName)
    .returns(records[1].friendlyName);

  dnssd.queryForServiceInstances = queryForServiceInstancesSpy;
  dnssd.queryForIpAddress = queryForIpAddressSpy;
  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;
  dnssd.getUserFriendlyName = getUserFriendlyNameSpy;

  let resultPromise = dnssd.browseServiceInstances(serviceType);
  resultPromise.then(function gotInstances(instances) {
    // Each spy called the appropriate number of times with the appropriate
    // arguments
    // 1 call resolves all services
    t.equal(queryForServiceInstancesSpy.callCount, 1);
    // 2 instances, thus 2 address resolutions required
    t.equal(queryForIpAddressSpy.callCount, 2);
    t.equal(queryForInstanceInfoSpy.callCount, 2);

    // PTR records
    t.deepEqual(
      queryForServiceInstancesSpy.args[0],
      [
        serviceType,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_PTR_RETRIES  
      ]
    );

    for (let recordIter = 0; recordIter < records.length; recordIter++) {
      // SRV records
      t.deepEqual(
        queryForInstanceInfoSpy.args[recordIter],
        [
          records[recordIter].ptr.serviceName,
          dnssd.DEFAULT_QUERY_WAIT_TIME,
          dnssd.DEFAULT_NUM_RETRIES
        ]
      );

      // A records
      t.deepEqual(
        queryForIpAddressSpy.args[recordIter],
        [
          records[recordIter].srv.domain, 
          dnssd.DEFAULT_QUERY_WAIT_TIME,
          dnssd.DEFAULT_NUM_RETRIES
        ]
      );
    }

    // Result promise resolves with the correct objects.
    t.deepEqual(instances, [records[0].expected, records[1].expected]);
    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('getUserFriendlyName handles basic input', function(t) {
  // The most basic example is something like the following, no special
  // characters and only the .local suffix.
  let serviceType = '_music._tcp';
  let domain = 'local';
  let name = 'My Music Library';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  verifyUserFriendlyNameHelper(instanceTypeDomain, name, t);
});

test('getUserFriendlyName handles special characters in name', function(t) {
  // We need to be able to handle special characters in the instance name
  let serviceType = '_semcache._tcp';
  let domain = 'local';
  let name = 'Joe\'s fancy.cache_fancy!';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  verifyUserFriendlyNameHelper(instanceTypeDomain, name, t);
});

test('getUserFriendlyName handles multi-level domains', function(t) {
  // Although not relevant for multicast applications, the spec suggests we
  // should also support multi level domains.
  let serviceType = '_music._tcp';
  let domain = 'www.example.com';
  let name = 'My Music Library';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  let actual = dnssd.getUserFriendlyName(instanceTypeDomain);
  t.equal(actual, name);
  t.end();
});

test('resolveService resolves if all correct', function(t) {
  let serviceType = '_semcache._tcp';
  let records = generateFakeRecords(serviceType, 1);
  let serviceName = records[0].ptr.serviceName;

  // SRV records
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].ptr.serviceName)
    .resolves([records[0].srv]);

  // A records
  let queryForIpAddressSpy = sinon.stub();
  queryForIpAddressSpy.withArgs(records[0].srv.domain)
    .resolves([records[0].aRec]);

  let getUserFriendlyNameSpy = sinon.stub();
  getUserFriendlyNameSpy.withArgs(records[0].ptr.serviceName)
    .returns(records[0].friendlyName);

  dnssd.queryForIpAddress = queryForIpAddressSpy;
  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;
  dnssd.getUserFriendlyName = getUserFriendlyNameSpy;

  let expected = {
    friendlyName: records[0].friendlyName,
    instanceName: records[0].ptr.serviceName,
    domainName: records[0].srv.domain,
    ipAddress: records[0].aRec.ipAddress,
    port: records[0].srv.port,
    serviceType: records[0].srv.instanceTypeDomain
  };

  dnssd.resolveService(serviceName)
  .then(operationalInfo => {
    // Each spy called the appropriate number of times with the appropriate
    // arguments
    // 2 instances, thus 2 address resolutions required
    t.equal(queryForIpAddressSpy.callCount, 1);
    t.equal(queryForInstanceInfoSpy.callCount, 1);

    // SRV records
    t.deepEqual(
      queryForInstanceInfoSpy.args[0],
      [
        records[0].ptr.serviceName,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // A records
    t.deepEqual(
      queryForIpAddressSpy.args[0],
      [
        records[0].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // Result promise resolves with the correct objects.
    t.deepEqual(operationalInfo, expected);
    resetDnsSd();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetDnsSd();
  });
});

test('resolveService rejects if missing SRV', function(t) {
  let serviceType = '_semcache._tcp';
  let records = generateFakeRecords(serviceType, 1);
  let serviceName = records[0].ptr.serviceName;

  // SRV records should return nothing.
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].ptr.serviceName)
    .resolves([]);

  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;

  let expected = 'did not find SRV record for service: ' + serviceName;

  dnssd.resolveService(serviceName)
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(actual => {
    t.equal(queryForInstanceInfoSpy.callCount, 1);

    // SRV records
    t.deepEqual(
      queryForInstanceInfoSpy.args[0],
      [
        records[0].ptr.serviceName,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    t.deepEqual(actual, expected);
    console.log(actual);
    resetDnsSd();
    t.end();
  });
});

test('resolveService rejects if missing A', function(t) {
  let serviceType = '_semcache._tcp';
  let records = generateFakeRecords(serviceType, 1);
  let serviceName = records[0].ptr.serviceName;

  // SRV records
  let queryForInstanceInfoSpy = sinon.stub();
  queryForInstanceInfoSpy.withArgs(records[0].ptr.serviceName)
    .resolves([records[0].srv]);

  // A records return nothing
  let queryForIpAddressSpy = sinon.stub();
  queryForIpAddressSpy.withArgs(records[0].srv.domain)
    .resolves([]);

  dnssd.queryForIpAddress = queryForIpAddressSpy;
  dnssd.queryForInstanceInfo = queryForInstanceInfoSpy;

  let expected = 'did not find A record for SRV: ' +
    JSON.stringify(records[0].srv);

  dnssd.resolveService(serviceName)
  .then(res => {
    t.fail(res);
    t.end();
    resetDnsSd();
  })
  .catch(actual => {
    // Each spy called the appropriate number of times with the appropriate
    // arguments
    // 2 instances, thus 2 address resolutions required
    t.equal(queryForIpAddressSpy.callCount, 1);
    t.equal(queryForInstanceInfoSpy.callCount, 1);

    // SRV records
    t.deepEqual(
      queryForInstanceInfoSpy.args[0],
      [
        records[0].ptr.serviceName,
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // A records
    t.deepEqual(
      queryForIpAddressSpy.args[0],
      [
        records[0].srv.domain, 
        dnssd.DEFAULT_QUERY_WAIT_TIME,
        dnssd.DEFAULT_NUM_RETRIES
      ]
    );

    // Result promise resolves with the correct objects.
    t.deepEqual(actual, expected);
    console.log(actual);
    resetDnsSd();
    t.end();
  });
});

test('getUserFriendlyName handles basic input', function(t) {
  // The most basic example is something like the following, no special
  // characters and only the .local suffix.
  let serviceType = '_music._tcp';
  let domain = 'local';
  let name = 'My Music Library';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  verifyUserFriendlyNameHelper(instanceTypeDomain, name, t);
});

test('getUserFriendlyName handles special characters in name', function(t) {
  // We need to be able to handle special characters in the instance name
  let serviceType = '_semcache._tcp';
  let domain = 'local';
  let name = 'Joe\'s fancy.cache_fancy!';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  verifyUserFriendlyNameHelper(instanceTypeDomain, name, t);
});

test('getUserFriendlyName handles multi-level domains', function(t) {
  // Although not relevant for multicast applications, the spec suggests we
  // should also support multi level domains.
  let serviceType = '_music._tcp';
  let domain = 'www.example.com';
  let name = 'My Music Library';
  let instanceTypeDomain = [name, serviceType, domain].join('.');

  let dnssdSem = require('../../../app/scripts/dnssd/dns-sd');

  let actual = dnssdSem.getUserFriendlyName(instanceTypeDomain);
  t.equal(actual, name);
  t.end();
});
