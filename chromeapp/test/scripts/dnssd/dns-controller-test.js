/*jshint esnext:true*/
/* globals Promise */
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var dnsController = require('../../../app/scripts/dnssd/dns-controller');
var chromeUdp = require('../../../app/scripts/dnssd/chromeUdp');
var dnsCodes = require('../../../app/scripts/dnssd/dns-codes-sem');
var dnsPacket = require('../../../app/scripts/dnssd/dns-packet-sem');
var qSection = require('../../../app/scripts/dnssd/question-section');
var byteArray = require('../../../app/scripts/dnssd/byte-array-sem');
var resRec = require('../../../app/scripts/dnssd/resource-record');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetDnsController() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-controller')
  ];
  dnsController = require('../../../app/scripts/dnssd/dns-controller');
}

/**
 * Helper function to test for multicast/unicast sending.
 */
function helperTestForSendAddress(t, isUnicast, address, port) {
  var queryPacket = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );
  // We want to include a question to make sure we don't not send a response
  // just because there are no questions rather than due to the fact that it
  // isn't a query.
  var q1name = 'domain';
  var q1type = 2;
  var q1class = 1;

  var question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  queryPacket.addQuestion(question1);

  var responsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  // We will return a response packet regardless of the other parameters.
  question1.unicastResponseRequested = () => isUnicast;
  dnsController.createResponsePacket = () => responsePacket;

  // Return a single item to indicate that we should respond to the query.
  var aRecord = new resRec.ARecord('domainname', 10, '123.42.61.123', 2);
  dnsController.getResourcesForQuery = () => [aRecord];

  var sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  dnsController.handleIncomingPacket(queryPacket, address, port);

  // We are going to ignore the first parameter, as we trust other methods to
  // test the content of the packet. We're interested only in the address and
  // port.
  t.equal(sendSpy.callCount, 1);
  t.deepEqual(sendSpy.args[0][1], address);
  t.deepEqual(sendSpy.args[0][2], port);

  resetDnsController();
  t.end();
}

test('getSocket resolves immediately if socket is present', function(t) {
  // Make the module think it has started.
  var dummySocket = {};
  dnsController.socket = dummySocket;

  var result = dnsController.getSocket();
  result.then(function success(socket) {
    // It should return null by default, as we don't have the socket set yet.
    t.equal(socket, dummySocket);
    t.end();
  }, function failure() {
    t.fail();
  });

  resetDnsController();
});

test('getSocket follows success chain and resolves with socket', function(t) {
  var chromeUdpStub = {};

  chromeUdpStub.addOnReceiveListener = function() {};

  var fakeInfo = {
    socketId: 12,
    localPort: 8887
  };
  var expected = new chromeUdp.ChromeUdpSocket(fakeInfo);

  chromeUdpStub.create = sinon.stub().resolves(fakeInfo);
  chromeUdpStub.bind = sinon.stub().resolves();
  chromeUdpStub.joinGroup = sinon.stub().resolves();

  var mockedController = proxyquire(
    '../../../app/scripts/dnssd/dns-controller.js',
    {
      './chromeUdp': chromeUdpStub
    }
  );

  var result = mockedController.getSocket();
  result.then(function success(actual) {
    t.deepEqual(actual, expected);
    t.true(mockedController.isStarted());
    t.end();
  }, function error() {
    t.fail();
    t.end();
  });

  resetDnsController();
});

test('getSocket fails if bind fails', function(t) {
  var chromeUdpStub = {};

  var fakeInfo = {
    socketId: 12,
    localPort: 8887
  };

  var closeAllSocketsSpy = sinon.spy();

  chromeUdpStub.addOnReceiveListener = function() {};
  chromeUdpStub.closeAllSockets = closeAllSocketsSpy;
  chromeUdpStub.create = sinon.stub().resolves(fakeInfo);
  chromeUdpStub.bind = sinon.stub().rejects('auto reject');

  var mockedController = proxyquire(
    '../../../app/scripts/dnssd/dns-controller.js',
    {
      './chromeUdp': chromeUdpStub
    }
  );

  var result = mockedController.getSocket();
  result.then(function success() {
    t.fail('should not succeed');
    t.end();
    resetDnsController();
  }, function error(errorObj) {
    var startsWithMessage = errorObj.message.startsWith(
      'Error when binding DNSSD port'
    );
    t.true(startsWithMessage);
    t.equal(closeAllSocketsSpy.callCount, 1);
    t.end();
  });

  resetDnsController();
});

test('getSocket fails if join group fails', function(t) {
  var chromeUdpStub = {};

  var fakeInfo = {
    socketId: 12,
    localPort: 8887
  };
  var closeAllSocketsSpy = sinon.spy();

  chromeUdpStub.addOnReceiveListener = function() {};
  chromeUdpStub.closeAllSockets = closeAllSocketsSpy;
  chromeUdpStub.create = sinon.stub().resolves(fakeInfo);
  chromeUdpStub.bind = sinon.stub().resolves();
  chromeUdpStub.joinGroup = sinon.stub().rejects('auto reject');

  var mockedController = proxyquire(
    '../../../app/scripts/dnssd/dns-controller.js',
    {
      './chromeUdp': chromeUdpStub
    }
  );

  var result = mockedController.getSocket();
  result.then(function success() {
    t.fail('should not succeed');
    t.end();
    resetDnsController();
  }, function error(errorObj) {
    var startsWithMessage = errorObj.message.startsWith(
      'Error when joining DNSSD group'
    );
    t.true(startsWithMessage);
    t.equal(closeAllSocketsSpy.callCount, 1);
    t.end();
  });

  resetDnsController();
});

test('queryForARecord calls query with correct args', function(t) {
  var querySpy = sinon.spy();
  var mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  mockedController.getResourcesForQuery = querySpy;

  var domainName = 'www.example.com';

  mockedController.queryForARecord(domainName);

  t.equal(querySpy.firstCall.args[0], domainName);
  t.equal(querySpy.firstCall.args[1], dnsCodes.RECORD_TYPES.A);
  t.equal(querySpy.firstCall.args[2], dnsCodes.CLASS_CODES.IN);

  t.end();

  resetDnsController();
});

test('queryForPtrRecord calls query with correct args', function(t) {
  var querySpy = sinon.spy();
  var mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  mockedController.getResourcesForQuery = querySpy;

  var serviceName = '_semcache._tcp';

  mockedController.queryForPtrRecord(serviceName);

  t.equal(querySpy.firstCall.args[0], serviceName);
  t.equal(querySpy.firstCall.args[1], dnsCodes.RECORD_TYPES.PTR);
  t.equal(querySpy.firstCall.args[2], dnsCodes.CLASS_CODES.IN);

  t.end();

  resetDnsController();
});

test('queryForSrvRecord calls query with correct args', function(t) {
  var querySpy = sinon.spy();
  var mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  mockedController.getResourcesForQuery = querySpy;

  var instanceName = 'Fancy Cache._semcache._tcp';

  mockedController.queryForSrvRecord(instanceName);

  t.equal(querySpy.firstCall.args[0], instanceName);
  t.equal(querySpy.firstCall.args[1], dnsCodes.RECORD_TYPES.SRV);
  t.equal(querySpy.firstCall.args[2], dnsCodes.CLASS_CODES.IN);

  t.end();

  resetDnsController();
});

test('query calls sendPacket with correct args', function(t) {
  var mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );
  
  var qName = 'www.foo.com';
  var qType = 3;
  var qClass = 12;

  var targetPacket = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );
  var targetQuestion = new qSection.QuestionSection(qName, qType, qClass);
  targetPacket.addQuestion(targetQuestion);

  var sendPacketSpy = sinon.spy();

  mockedController.sendPacket = sendPacketSpy;
  mockedController.query(qName, qType, qClass);

  var args = sendPacketSpy.args[0];

  t.true(sendPacketSpy.calledOnce);
  t.deepEqual(args[0], targetPacket);
  t.deepEqual(args[1], mockedController.DNSSD_MULTICAST_GROUP);
  t.deepEqual(args[2], mockedController.DNSSD_PORT);
  t.end();

  resetDnsController();
});

test('addRecord updates data structures', function(t) {
  var aName = 'www.example.com';
  var aRecord1 = new resRec.ARecord(aName, 10, '123.42.61.123', 2);
  var aRecord2 = new resRec.ARecord(aName, 10, '124.42.61.123', 2);

  var ptrName = '_print._tcp';
  var ptrRecord1 = new resRec.PtrRecord(ptrName, 108, 'PrintsALot', 4);

  var srvName = 'Sam Cache._semcache._tcp';
  var srvRecord1 = new resRec.SrvRecord(srvName, 99, 0, 10, 8888, 'sam.local');

  // We should start with an empty object.
  var expectedRecords = {};
  t.deepEqual(dnsController.getRecords(), expectedRecords);

  expectedRecords[aName] = [aRecord1];
  dnsController.addRecord(aName, aRecord1);
  t.deepEqual(dnsController.getRecords(), expectedRecords);

  expectedRecords[ptrName] = [ptrRecord1];
  dnsController.addRecord(ptrName, ptrRecord1);
  t.deepEqual(dnsController.getRecords(), expectedRecords);

  expectedRecords[srvName] = [srvRecord1];
  dnsController.addRecord(srvName, srvRecord1);
  t.deepEqual(dnsController.getRecords(), expectedRecords);

  expectedRecords[aName].push(aRecord2);
  dnsController.addRecord(aName, aRecord2);
  t.deepEqual(dnsController.getRecords(), expectedRecords);

  t.end();

  resetDnsController();
});

test('addOnReceiveCallback adds function', function(t) {
  var fn1 = function() {};
  var fn2 = function() {};
  var startingCallbacks = dnsController.getOnReceiveCallbacks();

  t.deepEqual(startingCallbacks, []);

  dnsController.addOnReceiveCallback(fn1);
  t.deepEqual([fn1], dnsController.getOnReceiveCallbacks());

  dnsController.addOnReceiveCallback(fn2);
  t.deepEqual([fn1, fn2], dnsController.getOnReceiveCallbacks());

  t.end();

  resetDnsController();
});

test('removeOnReceiveCallback removes function', function(t) {
  var fn1 = function() {};
  var fn2 = function() {};
  var fn3 = function() {};

  t.deepEqual(dnsController.getOnReceiveCallbacks(), []);

  // Does not error with zero functions
  dnsController.removeOnReceiveCallback(fn1);

  // Succeeds with only one function
  dnsController.addOnReceiveCallback(fn1);
  dnsController.removeOnReceiveCallback(fn1);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), []);

  // Succeeds with 3 and removing last function
  dnsController.addOnReceiveCallback(fn1);
  dnsController.addOnReceiveCallback(fn2);
  dnsController.addOnReceiveCallback(fn3);
  dnsController.removeOnReceiveCallback(fn3);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), [fn1, fn2]);

  // Add it back to make sure we can remove from the middle.
  dnsController.addOnReceiveCallback(fn3);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), [fn1, fn2, fn3]);
  dnsController.removeOnReceiveCallback(fn2);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), [fn1, fn3]);

  t.end();
});

test('sendPacket gets socket and sends', function(t) {
  var packet = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );

  var byteArr = packet.convertToByteArray();
  var expectedBuffer = byteArray.getByteArrayAsUint8Array(byteArr).buffer;
  var address = 'hello';
  var port = '6789';

  // getSocket() should resolve with an object that exposes the 'send'
  // function.
  var sendSpy = {
    send: function(bufferParam, addressParam, portParam) {
      t.deepEqual(bufferParam, expectedBuffer);
      t.deepEqual(addressParam, address);
      t.deepEqual(portParam, port);
      resetDnsController();
      t.end();
    }
  };
  var getSocketSpy = sinon.stub().resolves(sendSpy);
  dnsController.getSocket = getSocketSpy;

  dnsController.sendPacket(packet, address, port);
});

test('start initializes correctly', function(t) {
  // getSocket() should resolve and initializeNetworkInetfaceCache() should
  // resolve
  var calledGetSocket = false;
  var calledInitializeCaches = false;

  var getSocketStub = function() {
    calledGetSocket = true;
    return Promise.resolve();
  };

  var initializeCacheStub = function() {
    calledInitializeCaches = true;
    return new Promise(function tests() {
      t.true(calledGetSocket);
      t.true(calledInitializeCaches);
      resetDnsController();
      t.end();
    });
  };

  dnsController.getSocket = getSocketStub;
  dnsController.initializeNetworkInterfaceCache = initializeCacheStub;
  
  dnsController.start();
});

test('initializeNetworkInterfaceCache initializes cache', function(t) {
  // We should initialize the interfaces and call getSocket() the first time to
  // make sure all is well.
  var iface = {
    name: 'eth0',
    address: '123.456.789.91',
    prefixLength: 0
  };
  var ifaces = [iface];

  var getInterfacesStub = sinon.stub().resolves(ifaces);

  var mockedController = proxyquire(
    '../../../app/scripts/dnssd/dns-controller.js',
    {
      './chromeUdp': {
        getNetworkInterfaces: getInterfacesStub
      }
    }
  );
  
  t.deepEqual(mockedController.getIPv4Interfaces(), []);

  mockedController.initializeNetworkInterfaceCache()
  .then(function addedInterfaces() {
    var expectedInterfaces = [iface];
    t.deepEqual(mockedController.getIPv4Interfaces(), expectedInterfaces);
    t.end();
    resetDnsController();
  });
});

test('handleIncomingPacket invokes all callbacks', function(t) {
  // All the registered callbacks should be given a chance at the packets
  var responsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  
  var callback1 = sinon.spy();
  var callback2 = sinon.spy();
  dnsController.addOnReceiveCallback(callback1);
  dnsController.addOnReceiveCallback(callback2);

  dnsController.handleIncomingPacket(responsePacket, '123.4.5.6', 7777);

  t.true(callback1.calledOnce);
  t.true(callback2.calledOnce);
  t.deepEqual(callback1.args[0], [responsePacket]);
  t.deepEqual(callback2.args[0], [responsePacket]);

  resetDnsController();
  t.end();
});

test('handleIncomingPacket does not send packets if not query', function(t) {
  var responsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  // We want to include a question to make sure we don't not send a response
  // just because there are no questions rather than due to the fact that it
  // isn't a query.
  var question = new qSection.QuestionSection('hiname', 'hitype', 'hiclass');
  responsePacket.addQuestion(question);

  var sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  dnsController.handleIncomingPacket(responsePacket, 'addr', 4444);

  t.equal(sendSpy.callCount, 0);
  t.end();

  resetDnsController();
});

test('handleIncomingPacket sends packet for each question', function(t) {
  var queryPacket = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );
  // We want to include a question to make sure we don't not send a response
  // just because there are no questions rather than due to the fact that it
  // isn't a query.
  var q1name = 'domain';
  var q1type = 2;
  var q1class = 1;
  var q2name = 'domain2';
  var q2type = 3;
  var q2class = 2;

  var question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  var question2 = new qSection.QuestionSection(q2name, q2type, q2class);
  queryPacket.addQuestion(question1);
  queryPacket.addQuestion(question2);

  // The response packets we are going to generate. Note that we should NOT
  // include questions in these responses, as according to section 6 of the RFC
  // we don't put questions in responses.
  var responsePacket1 = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  var responsePacket2 = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );

  // The arguments passed to our createResponsePacket spy.
  var responsePacketArgs = [];
  var responsePacketCallCount = 0;
  var createResponsePacketSpy = function(packetArg) {
    responsePacketArgs.push(packetArg);
    if (responsePacketCallCount === 0) {
      responsePacketCallCount += 1;
      return responsePacket1;
    } else {
      responsePacketCallCount += 1;
      return responsePacket2;
    }
  };
  dnsController.createResponsePacket = createResponsePacketSpy;

  // Now we need to make sure we add the correct records to the response.
  var q1record1 = new resRec.ARecord('domain', 1, '1.1.1.1', 2);
  var q2record1 = new resRec.ARecord('domain2', 4, '1.1.1.1', 2);
  var q2record2 = new resRec.PtrRecord('service', 5, 'instance', 1);

  // We will maintain the arguments we expect.
  var getResourcesArgs = [];
  var getResourcesCallCount = 0;
  var getResourcesForQuerySpy = function(qName, qClass, qType) {
    var args = [qName, qClass, qType];
    getResourcesArgs.push(args);
    if (getResourcesCallCount === 0) {
      getResourcesCallCount += 1;
      return [q1record1];
    } else {
      getResourcesCallCount += 1;
      return [q2record1, q2record2];
    }
    getResourcesCallCount += 1;
  };
  dnsController.getResourcesForQuery = getResourcesForQuerySpy;

  var sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  // After all this setup, make the call we're actually testing.
  var address = '9.8.7.6';
  var port = 1111;
  dnsController.handleIncomingPacket(queryPacket, address, port);

  // And now for the asserstions.
  // Create response packet should have been called twice--once for each
  // question.
  t.deepEqual(responsePacketArgs, [queryPacket, queryPacket]);

  // Send should have been called with two packets--both to the multicast
  var sendArgs1 = sendSpy.args[0];
  var sendArgs2 = sendSpy.args[1];

  // First call
  t.deepEqual(sendArgs1[0], responsePacket1);
  t.deepEqual(sendArgs1[1], address);
  t.deepEqual(sendArgs1[2], port);

  // Second call
  t.deepEqual(sendArgs2[0], responsePacket2);
  t.deepEqual(sendArgs2[1], address);
  t.deepEqual(sendArgs2[2], port);

  t.end();
  resetDnsController();
});

test('handleIncomingPacket does not send if no records found', function(t) {
  var queryPacket = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );
  // We want to include a question to make sure we don't not send a response
  // just because there are no questions rather than due to the fact that it
  // isn't a query.
  var q1name = 'domain';
  var q1type = 2;
  var q1class = 1;

  var question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  queryPacket.addQuestion(question1);

  // Return an empty array to indicate no records found.
  dnsController.getResourcesForQuery = () => [];

  var sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  dnsController.handleIncomingPacket(queryPacket);

  // Make sure we never sent something.
  t.equal(sendSpy.callCount, 0);

  resetDnsController();
  t.end();
});

test('handleIncomingPacket sends to multicast address', function(t) {
  helperTestForSendAddress(
    t,
    false,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.DNSSD_PORT
  );
});

test('handleIncomingPacket sends to unicast address', function(t) {
  helperTestForSendAddress(t, true, '123.9.8.7', 5555);
});

test('createResponsePacket correct', function(t) {
  // We should create a response that is not a query.
  var expected = new dnsPacket.DnsPacket(
    0,
    false,  // not a query.
    0,
    true,
    0,
    0,
    0,
    0
  );
  var actual = dnsController.createResponsePacket(expected);
  t.deepEqual(actual, expected);
  t.end();
});

test('getResourcesForQuery respects ANY in type', function(t) {
  var qName = 'www.example.com';
  var qType = dnsCodes.RECORD_TYPES.ANY;
  var qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  var aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  var aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  var srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');

  dnsController.addRecord(qName, aRecord1);
  dnsController.addRecord(qName, aRecord2);
  dnsController.addRecord(qName, srvRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  var expected = [aRecord1, aRecord2, srvRecord];
  var actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  t.end();
  resetDnsController();
});

test('getResourcesForQuery respects class', function(t) {
  var qName = 'www.example.com';
  var qType = dnsCodes.RECORD_TYPES.A;
  var qClass = dnsCodes.CLASS_CODES.IN;

  var unwantedClass = dnsCodes.CLASS_CODES.CS;

  // First make some records for this class with a matching name.
  var unwantedRecord = new resRec.ARecord(qName, 10, '1.2.3.4', unwantedClass);
  var wantedRecord = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);

  dnsController.addRecord(qName, unwantedRecord);
  dnsController.addRecord(qName, wantedRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  var expected = [wantedRecord];
  var actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  t.end();
  resetDnsController();
});

test('getResourcesForQuery respects type', function(t) {
  var qName = 'www.example.com';
  // We'll query for a SRV record
  var qType = dnsCodes.RECORD_TYPES.SRV;
  var qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  var aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  var aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  var srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');

  dnsController.addRecord(qName, aRecord1);
  dnsController.addRecord(qName, aRecord2);
  dnsController.addRecord(qName, srvRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  var expected = [srvRecord];
  var actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  t.end();
  resetDnsController();
});

test('getResourcesForQuery returns empty array if no records', function(t) {
  var qName = 'www.example.com';
  // We'll query for a SRV record
  var qType = dnsCodes.RECORD_TYPES.SRV;
  var qClass = dnsCodes.CLASS_CODES.IN;

  var expected = [];
  var actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  t.end();
  resetDnsController();
});

test('getResourcesForQuery performs service type enumeration', function(t) {
  // This is a special case for the enumeration of services, as specified in
  // RFC 6763, section 9. We should return ALL ptr records.

  // Create PTR records across multiple names.
  var name1 = 'name1';
  var name2 = 'name2';
  var record1 = new resRec.PtrRecord(
    name1,
    10,
    'instance1',
    dnsCodes.CLASS_CODES.IN
  );
  var record1Srv = new resRec.SrvRecord(name1, 10, 0, 0, 8866, 'me.local');
  var record2 = new resRec.PtrRecord(
    name2,
    10,
    'instance2',
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(name1, record1);
  dnsController.addRecord(name1, record1Srv);
  dnsController.addRecord(name2, record2);

  // We can't assume anything about order here.
  var actual = dnsController.getResourcesForQuery(
    dnsController.DNSSD_SERVICE_NAME,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );

  t.equal(actual.length, 2);
  var record1Index = actual.indexOf(record1);
  var record2Index = actual.indexOf(record2);
  t.deepEqual(actual[record1Index], record1);
  t.deepEqual(actual[record2Index], record2);
  t.end();
  resetDnsController();
});
