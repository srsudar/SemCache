/*jshint esnext:true*/
'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const chromeUdp = require('../../../app/scripts/chrome-apis/udp');
const dnsCodes = require('../../../app/scripts/dnssd/dns-codes');
const dnsPacket = require('../../../app/scripts/dnssd/dns-packet');
const qSection = require('../../../app/scripts/dnssd/question-section');
const resRec = require('../../../app/scripts/dnssd/resource-record');

let dnsController = require('../../../app/scripts/dnssd/dns-controller');

dnsController.DEBUG = false;


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/dnssd/dns-controller')
  ];
  dnsController = require('../../../app/scripts/dnssd/dns-controller');
  dnsController.DEBUG = false;
}

function proxyquireDnsController(proxies) {
  dnsController = proxyquire(
    '../../../app/scripts/dnssd/dns-controller', proxies
  );
  dnsController.DEBUG = false;
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}

/**
 * Helper function to test for multicast/unicast sending.
 */
function helperTestForSendAddress(t, isUnicast, address, port) {
  let queryPacket = new dnsPacket.DnsPacket(
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
  let q1name = 'domain';
  let q1type = 2;
  let q1class = 1;

  let question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  queryPacket.addQuestion(question1);

  let responsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );

  let waitInRangeSpy = sinon.stub().resolves();
  proxyquireDnsController({
    '../util': {
      waitInRange: waitInRangeSpy
    }
  });

  // We will return a response packet regardless of the other parameters.
  question1.unicastResponseRequested = sinon.stub().returns(isUnicast);
  dnsController.createResponsePacket = sinon.stub().returns(responsePacket);

  // Return a single item to indicate that we should respond to the query.
  let aRecord = new resRec.ARecord('domainname', 10, '123.42.61.123', 2);
  dnsController.getResourcesForQuery = sinon.stub().returns([aRecord]);

  dnsController.sendPacket = function(packetArg, addrArg, portArg) {
    // We are going to ignore the first parameter, as we trust other methods to
    // test the content of the packet. We're interested only in the address and
    // port.
    t.notEqual(packetArg, null);
    t.deepEqual(addrArg, address);
    t.deepEqual(portArg, port);
  };

  dnsController.handleIncomingPacket(queryPacket, address, port);

  t.deepEqual(
    waitInRangeSpy.args[0],
    [dnsController.RESPONSE_WAIT_MIN, dnsController.RESPONSE_WAIT_MAX]
  );

  end(t);
}

function helperQueryForType(t, name, type, clazz, controller, fn, argsArray) {
  let returnArg = 'foo';
  let querySpy = sinon.stub().returns(returnArg);

  controller.getResourcesForQuery = querySpy;

  let actual = fn.apply(null, argsArray);

  t.deepEqual(querySpy.args[0], [name, type, clazz]);
  t.equal(actual, returnArg);

  end(t);
}

test('getSocket resolves immediately if socket is present', function(t) {
  // Make the module think it has started.
  let dummySocket = {};
  dnsController.socket = dummySocket;

  let result = dnsController.getSocket();
  result.then(function success(socket) {
    // It should return null by default, as we don't have the socket set yet.
    t.equal(socket, dummySocket);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getSocket follows success chain and resolves with socket', function(t) {
  let fakeInfo = {
    socketId: 12,
    localPort: 8887
  };
  let expected = new chromeUdp.ChromeUdpSocket(fakeInfo);

  proxyquireDnsController({
    '../chrome-apis/udp': {
      addOnReceiveListener: sinon.stub(),
      create: sinon.stub().resolves(fakeInfo),
      bind: sinon.stub().resolves(),
      joinGroup: sinon.stub().resolves()
    }
  });

  dnsController.getSocket()
  .then(function success(actual) {
    t.deepEqual(actual, expected);
    t.true(dnsController.isStarted());
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getSocket fails if bind fails', function(t) {
  let chromeUdpStub = {};

  let fakeInfo = {
    socketId: 12,
    localPort: 8887
  };

  let closeAllSocketsSpy = sinon.spy();

  let expected = { msg: 'went wrong during bind' };

  chromeUdpStub.addOnReceiveListener = sinon.stub();
  chromeUdpStub.closeAllSockets = closeAllSocketsSpy;
  chromeUdpStub.create = sinon.stub().resolves(fakeInfo);
  chromeUdpStub.bind = sinon.stub().rejects(expected);

  proxyquireDnsController({
    '../chrome-apis/udp': chromeUdpStub
  });

  let result = dnsController.getSocket();
  result.then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.equal(dnsController.socket, null);
    t.equal(closeAllSocketsSpy.callCount, 1);
    end(t);
  });
});

test('getSocket fails if join group fails', function(t) {
  let fakeInfo = {
    socketId: 12,
    localPort: 8887
  };
  let closeAllSocketsSpy = sinon.spy();

  let expected = { msg: 'error doing joinGroup' };

  proxyquireDnsController({
    '../chrome-apis/udp': {
      addOnReceiveListener: sinon.stub(),
      closeAllSockets: closeAllSocketsSpy,
      create: sinon.stub().resolves(fakeInfo),
      bind: sinon.stub().resolves(),
      joinGroup: sinon.stub().rejects(expected)
    }
  });

  dnsController.getSocket()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.equal(dnsController.socket, null);
    t.equal(closeAllSocketsSpy.callCount, 1);
    end(t);
  });
});

test('queryForARecord calls query with correct args', function(t) {
  let controller = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  let domainName = 'www.example.com';
  helperQueryForType(
    t,
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN,
    controller,
    controller.queryForARecord,
    [domainName]
  );
});

test('queryForPtrRecord calls query with correct args', function(t) {
  let controller = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  let serviceName = '_semcache._tcp';
  helperQueryForType(
    t,
    serviceName,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN,
    controller,
    controller.queryForPtrRecord,
    [serviceName]
  );
});

test('queryForSrvRecord calls query with correct args', function(t) {
  let controller = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  let instanceName = 'Fancy Cache._semcache._tcp';

  helperQueryForType(
    t,
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN,
    controller,
    controller.queryForSrvRecord,
    [instanceName]
  );
});

test('query calls sendPacket with correct args', function(t) {
  let mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );
  
  let qName = 'www.foo.com';
  let qType = 3;
  let qClass = 12;

  let targetPacket = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );
  let targetQuestion = new qSection.QuestionSection(qName, qType, qClass);
  targetPacket.addQuestion(targetQuestion);

  let sendPacketSpy = sinon.spy();

  mockedController.sendPacket = sendPacketSpy;
  mockedController.query(qName, qType, qClass);

  let args = sendPacketSpy.args[0];

  t.true(sendPacketSpy.calledOnce);
  t.deepEqual(args[0], targetPacket);
  t.deepEqual(args[1], mockedController.DNSSD_MULTICAST_GROUP);
  t.deepEqual(args[2], mockedController.MDNS_PORT);

  end(t);
});

test('addRecord updates data structures', function(t) {
  let aName = 'www.example.com';
  let aRecord1 = new resRec.ARecord(aName, 10, '123.42.61.123', 2);
  let aRecord2 = new resRec.ARecord(aName, 10, '124.42.61.123', 2);

  let ptrName = '_print._tcp';
  let ptrRecord1 = new resRec.PtrRecord(ptrName, 108, 'PrintsALot', 4);

  let srvName = 'Sam Cache._semcache._tcp';
  let srvRecord1 = new resRec.SrvRecord(srvName, 99, 0, 10, 8888, 'sam.local');

  // We should start with an empty object.
  let expectedRecords = {};
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

  end(t);
});

test('addOnReceiveCallback adds function', function(t) {
  let fn1 = function() {};
  let fn2 = function() {};
  let startingCallbacks = dnsController.getOnReceiveCallbacks();
  let expected = null;

  expected = new Set();
  t.deepEqual(startingCallbacks, expected);

  expected.add(fn1);
  dnsController.addOnReceiveCallback(fn1);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  expected.add(fn2);
  dnsController.addOnReceiveCallback(fn2);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  end(t);
});

test('removeOnReceiveCallback removes function', function(t) {
  let fn1 = function() {};
  let fn2 = function() {};
  let fn3 = function() {};

  let expected = new Set();
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  // Does not error with zero functions
  dnsController.removeOnReceiveCallback(fn1);

  // Succeeds with only one function
  dnsController.addOnReceiveCallback(fn1);
  dnsController.removeOnReceiveCallback(fn1);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  // Succeeds with 3 and removing last function
  dnsController.addOnReceiveCallback(fn1);
  dnsController.addOnReceiveCallback(fn2);
  dnsController.addOnReceiveCallback(fn3);
  dnsController.removeOnReceiveCallback(fn3);
  expected.add(fn1);
  expected.add(fn2);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  // Add it back to make sure we can remove from the middle.
  dnsController.addOnReceiveCallback(fn3);
  expected.add(fn3);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);
  dnsController.removeOnReceiveCallback(fn2);
  expected = new Set();
  expected.add(fn1);
  expected.add(fn3);
  t.deepEqual(dnsController.getOnReceiveCallbacks(), expected);

  end(t);
});

test('sendPacket gets socket and sends', function(t) {
  let packet = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );

  // We're using a stub, not serializing it in the test, because we are
  // modifying the packet number in the send to benefit debugging. Until we
  // stop doing this, it is simplest to just stub this out.
  let buff = Buffer.from('i am standing in as a packet');
  packet.toBuffer = sinon.stub().returns(buff);

  let address = 'hello';
  let port = '6789';

  // getSocket() should resolve with an object that exposes the 'send'
  // function.
  let sendSpy = {
    send: function(abParam, addressParam, portParam) {
      t.deepEqual(abParam, buff.buffer);
      t.deepEqual(addressParam, address);
      t.deepEqual(portParam, port);
      end(t);
    }
  };
  let getSocketSpy = sinon.stub().resolves(sendSpy);
  dnsController.getSocket = getSocketSpy;

  dnsController.sendPacket(packet, address, port);
});

test('start initializes correctly', function(t) {
  // getSocket() should resolve and initializeNetworkInetfaceCache() should
  // resolve
  let getSocketStub = sinon.stub().resolves();
  let initializeCacheStub = sinon.stub().resolves();

  dnsController.getSocket = getSocketStub;
  dnsController.initializeNetworkInterfaceCache = initializeCacheStub;
  
  dnsController.start()
  .then(() => {
    t.true(getSocketStub.calledOnce);
    t.true(initializeCacheStub.calledOnce);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('getIPv4Interfaces throws if not started', function(t) {
  let controller = require('../../../app/scripts/dnssd/dns-controller.js');
  controller.isStarted = sinon.stub().returns(false);

  t.throws(controller.getIPv4Interfaces, Error);
  end(t);
});

test('initializeNetworkInterfaceCache initializes cache', function(t) {
  // We should initialize the interfaces and call getSocket() the first time to
  // make sure all is well.

  // We want the br0 interface to be returned first, because we expect it to be
  // moved to the back of the list.
  let brIface = {
    name: 'br0',
    address: '9.8.7.6',
    prefixLength: 0
  };

  let wantedIface = {
    name: 'eth0',
    address: '123.456.789.91',
    prefixLength: 0
  };

  let ipv6iface = {
    name: 'ignoreMe',
    address: 'a:b:c:d:e:f',
    prefixLength: 0
  };

  let ifaces = [brIface, wantedIface, ipv6iface];

  let getInterfacesStub = sinon.stub().resolves(ifaces);

  proxyquireDnsController({
    '../chrome-apis/udp': {
      getNetworkInterfaces: getInterfacesStub
    }
  });
  dnsController.isStarted = sinon.stub().returns(true);
  
  t.deepEqual(dnsController.getIPv4Interfaces(), []);

  dnsController.initializeNetworkInterfaceCache()
  .then(function addedInterfaces() {
    let expectedInterfaces = [wantedIface];
    t.deepEqual(dnsController.getIPv4Interfaces(), expectedInterfaces);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('initializeNetworkInterfaceCache rejects if error', function(t) {
  let expected = { error: 'trouble town' };
  proxyquireDnsController({
    '../chrome-apis/udp': {
      getNetworkInterfaces: sinon.stub().rejects(expected)
    }
  });

  dnsController.initializeNetworkInterfaceCache()
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, expected);
    end(t);
  });
});

test('handleIncomingPacket invokes all callbacks', function(t) {
  // All the registered callbacks should be given a chance at the packets
  let responsePacket = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  
  let callback1 = sinon.spy();
  let callback2 = sinon.spy();
  dnsController.addOnReceiveCallback(callback1);
  dnsController.addOnReceiveCallback(callback2);

  dnsController.handleIncomingPacket(responsePacket, '123.4.5.6', 7777);

  t.true(callback1.calledOnce);
  t.true(callback2.calledOnce);
  t.deepEqual(callback1.args[0], [responsePacket]);
  t.deepEqual(callback2.args[0], [responsePacket]);

  end(t);
});

test('handleIncomingPacket does not send packets if not query', function(t) {
  let responsePacket = new dnsPacket.DnsPacket(
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
  let question = new qSection.QuestionSection('hiname', 'hitype', 'hiclass');
  responsePacket.addQuestion(question);

  let sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  dnsController.handleIncomingPacket(responsePacket, 'addr', 4444);

  t.equal(sendSpy.callCount, 0);

  end(t);
});

test('handleIncomingPacket sends packet for each question', function(t) {
  let queryPacket = new dnsPacket.DnsPacket(
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
  let q1name = 'domain';
  let q1type = 2;
  let q1class = 1;
  let q2name = 'domain2';
  let q2type = 3;
  let q2class = 2;

  let question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  let question2 = new qSection.QuestionSection(q2name, q2type, q2class);
  queryPacket.addQuestion(question1);
  queryPacket.addQuestion(question2);

  // The response packets we are going to generate. Note that we should NOT
  // include questions in these responses, as according to section 6 of the RFC
  // we don't put questions in responses.
  let responsePacket1 = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );
  let responsePacket2 = new dnsPacket.DnsPacket(
    0,
    false,
    0,
    0,
    0,
    0,
    0,
    0
  );

  let address = '9.8.7.6';
  let port = 1111;

  let callCount = 0;
  let sendPacketSpy = function(packetArg, addrArg, portArg) {
    if (callCount === 0) {
      t.deepEqual(packetArg, responsePacket1);
      t.deepEqual(addrArg, address);
      t.deepEqual(portArg, port);
    } else if (callCount === 1) {
      t.deepEqual(packetArg, responsePacket2);
      t.deepEqual(addrArg, address);
      t.deepEqual(portArg, port);
    } else {
      t.fail('called sendPacket more times than expected');
    }
    callCount += 1;
  };
  let waitInRangeSpy = sinon.stub().resolves();

  proxyquireDnsController({
    '../util': {
      waitInRange: waitInRangeSpy
    }
  });
  dnsController.sendPacket = sendPacketSpy;

  let createResponsePacketSpy = sinon.stub();
  createResponsePacketSpy.onCall(0).returns(responsePacket1);
  createResponsePacketSpy.onCall(1).returns(responsePacket2);
  dnsController.createResponsePacket = createResponsePacketSpy;

  // Now we need to make sure we add the correct records to the response.
  let q1record1 = new resRec.ARecord('domain', 1, '1.1.1.1', 2);
  let q2record1 = new resRec.ARecord('domain2', 4, '1.1.1.1', 2);
  let q2record2 = new resRec.PtrRecord('service', 5, 'instance', 1);

  // We will maintain the arguments we expect.
  let getResourcesForQuerySpy = sinon.stub();
  getResourcesForQuerySpy.onCall(0).returns([q1record1]);
  getResourcesForQuerySpy.onCall(1).returns([q2record1, q2record2]);
  dnsController.getResourcesForQuery = getResourcesForQuerySpy;

  // After all this setup, make the call we're actually testing.
  dnsController.handleIncomingPacket(queryPacket, address, port);

  // And now for the asserstions.
  // Create response packet should have been called twice--once for each
  // question.
  t.deepEqual(createResponsePacketSpy.args[0], [queryPacket]);
  t.deepEqual(createResponsePacketSpy.args[1], [queryPacket]);

  t.equal(waitInRangeSpy.callCount, 2);
  t.deepEqual(
    waitInRangeSpy.args[0],
    [dnsController.RESPONSE_WAIT_MIN, dnsController.RESPONSE_WAIT_MAX]
  );
  t.deepEqual(
    waitInRangeSpy.args[1],
    [dnsController.RESPONSE_WAIT_MIN, dnsController.RESPONSE_WAIT_MAX]
  );

  end(t);
});

test('handleIncomingPacket does not send if no records found', function(t) {
  let queryPacket = new dnsPacket.DnsPacket(
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
  let q1name = 'domain';
  let q1type = 2;
  let q1class = 1;

  let question1 = new qSection.QuestionSection(q1name, q1type, q1class);
  queryPacket.addQuestion(question1);

  // Return an empty array to indicate no records found.
  dnsController.getResourcesForQuery = () => [];

  let sendSpy = sinon.spy();
  dnsController.sendPacket = sendSpy;

  dnsController.handleIncomingPacket(queryPacket);

  // Make sure we never sent something.
  t.equal(sendSpy.callCount, 0);

  end(t);
});

test('handleIncomingPacket sends to multicast address', function(t) {
  helperTestForSendAddress(
    t,
    false,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.MDNS_PORT
  );
});

test('handleIncomingPacket sends to unicast address', function(t) {
  helperTestForSendAddress(t, true, '123.9.8.7', 5555);
});

test('createResponsePacket correct', function(t) {
  // We should create a response that is not a query.
  let expected = new dnsPacket.DnsPacket(
    0,
    false,  // not a query.
    0,
    true,
    0,
    0,
    0,
    0
  );
  let actual = dnsController.createResponsePacket(expected);
  t.deepEqual(actual, expected);

  end(t);
});

test('getResourcesForQuery respects ANY in type', function(t) {
  let qName = 'www.example.com';
  let qType = dnsCodes.RECORD_TYPES.ANY;
  let qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  let aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  let aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  let srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');

  dnsController.addRecord(qName, aRecord1);
  dnsController.addRecord(qName, aRecord2);
  dnsController.addRecord(qName, srvRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [aRecord1, aRecord2, srvRecord];
  let actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  
  end(t);
});

test('getResourcesForQuery respects class', function(t) {
  let qName = 'www.example.com';
  let qType = dnsCodes.RECORD_TYPES.A;
  let qClass = dnsCodes.CLASS_CODES.IN;

  let unwantedClass = dnsCodes.CLASS_CODES.CS;

  // First make some records for this class with a matching name.
  let unwantedRecord = new resRec.ARecord(qName, 10, '1.2.3.4', unwantedClass);
  let wantedRecord = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);

  dnsController.addRecord(qName, unwantedRecord);
  dnsController.addRecord(qName, wantedRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [wantedRecord];
  let actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);
  
  end(t);
});

test('getResourcesForQuery respects type', function(t) {
  let qName = 'www.example.com';
  // We'll query for a SRV record
  let qType = dnsCodes.RECORD_TYPES.SRV;
  let qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  let aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  let aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  let srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');

  dnsController.addRecord(qName, aRecord1);
  dnsController.addRecord(qName, aRecord2);
  dnsController.addRecord(qName, srvRecord);

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [srvRecord];
  let actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);

  end(t);
});

test('getResourcesForQuery returns empty array if no records', function(t) {
  let qName = 'www.example.com';
  // We'll query for a SRV record
  let qType = dnsCodes.RECORD_TYPES.SRV;
  let qClass = dnsCodes.CLASS_CODES.IN;

  let expected = [];
  let actual = dnsController.getResourcesForQuery(qName, qType, qClass);

  t.deepEqual(actual, expected);

  end(t);
});

test('getResourcesForQuery performs service type enumeration', function(t) {
  // This is a special case for the enumeration of services, as specified in
  // RFC 6763, section 9. We should return ALL ptr records.

  // Create PTR records across multiple names.
  let name1 = 'name1';
  let name2 = 'name2';
  let record1 = new resRec.PtrRecord(
    name1,
    10,
    'instance1',
    dnsCodes.CLASS_CODES.IN
  );
  let record1Srv = new resRec.SrvRecord(name1, 10, 0, 0, 8866, 'me.local');
  let record2 = new resRec.PtrRecord(
    name2,
    10,
    'instance2',
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(name1, record1);
  dnsController.addRecord(name1, record1Srv);
  dnsController.addRecord(name2, record2);

  // We can't assume anything about order here.
  let actual = dnsController.getResourcesForQuery(
    dnsController.DNSSD_SERVICE_NAME,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );

  t.equal(actual.length, 2);
  let record1Index = actual.indexOf(record1);
  let record2Index = actual.indexOf(record2);
  t.deepEqual(actual[record1Index], record1);
  t.deepEqual(actual[record2Index], record2);

  end(t);
});

test('onReceiveListener calls to send', function(t) {
  let data = Buffer.from('yo');
  let handleIncomingPacketSpy = sinon.spy();
  let packetMock = 'fake packet';
  let fromStub = sinon.stub();
  fromStub.withArgs(data).returns(packetMock);

  proxyquireDnsController({
    './dns-packet': {
      fromBuffer: fromStub
    }
  });

  let incomingInfo = {
    data: data,
    remoteAddress: 'remote addr',
    remotePort: 4433
  };

  dnsController.socket = {};
  dnsController.handleIncomingPacket = handleIncomingPacketSpy;
  dnsController.onReceiveListener(incomingInfo);

  // We should parse the packet and call handleIncomingPacket with the address
  // and port.
  t.true(handleIncomingPacketSpy.calledOnce, 'called handle packet once');
  t.equal(handleIncomingPacketSpy.args[0][0], packetMock);
  t.equal(handleIncomingPacketSpy.args[0][1], incomingInfo.remoteAddress);
  t.equal(handleIncomingPacketSpy.args[0][2], incomingInfo.remotePort);
  
  end(t);
});

test('filterResourcesForQuery respects ANY in type', function(t) {
  let qName = 'www.example.com';
  let qType = dnsCodes.RECORD_TYPES.ANY;
  let qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  let aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  let aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  let srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');
  let resources = [aRecord1, aRecord2, srvRecord];

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [aRecord1, aRecord2, srvRecord];
  let actual = dnsController.filterResourcesForQuery(
    resources, qName, qType, qClass
  );

  t.deepEqual(actual, expected);
  
  end(t);
});

test('filterResourcesForQuery respects class', function(t) {
  let qName = 'www.example.com';
  let qType = dnsCodes.RECORD_TYPES.A;
  let qClass = dnsCodes.CLASS_CODES.IN;

  let unwantedClass = dnsCodes.CLASS_CODES.CS;

  // First make some records for this class with a matching name.
  let unwantedRecord = new resRec.ARecord(qName, 10, '1.2.3.4', unwantedClass);
  let wantedRecord = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  let resources = [unwantedRecord, wantedRecord];

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [wantedRecord];
  let actual = dnsController.filterResourcesForQuery(
    resources, qName, qType, qClass
  );

  t.deepEqual(actual, expected);
  
  end(t);
});

test('filterResourcesForQuery respects type', function(t) {
  let qName = 'www.example.com';
  // We'll query for a SRV record
  let qType = dnsCodes.RECORD_TYPES.SRV;
  let qClass = dnsCodes.CLASS_CODES.IN;

  // First make some records for this class with a matching name.
  let aRecord1 = new resRec.ARecord(qName, 10, '1.2.3.4', qClass);
  let aRecord2 = new resRec.ARecord(qName, 10, '9.8.7.6', qClass);
  let srvRecord = new resRec.SrvRecord(qName, 11, 0, 0, 8888, 'domain.local');
  let resources = [aRecord1, aRecord2, srvRecord];

  // We don't strictly care about the order of returned responses, but we'll
  // expect the order we put them in just to use deepEqual as a single
  // assertion.
  let expected = [srvRecord];
  let actual = dnsController.filterResourcesForQuery(
    resources, qName, qType, qClass
  );

  t.deepEqual(actual, expected);
  
  end(t);
});

test('filterResourcesForQuery returns empty array if no records', function(t) {
  let qName = 'www.example.com';
  // We'll query for a SRV record
  let qType = dnsCodes.RECORD_TYPES.SRV;
  let qClass = dnsCodes.CLASS_CODES.IN;

  let expected = [];
  let actual = dnsController.filterResourcesForQuery([], qName, qType, qClass);

  t.deepEqual(actual, expected);
  
  end(t);
});

test('clearAllRecords removes all records', function(t) {
  t.deepEqual(dnsController.getRecords(), {});

  let aName = 'www.example.com';
  let aRecord1 = new resRec.ARecord(aName, 10, '123.42.61.123', 2);

  let expectedRecords = {};
  expectedRecords[aName] = [aRecord1];
  dnsController.addRecord(aName, aRecord1);

  t.deepEqual(dnsController.getRecords(), expectedRecords);

  dnsController.clearAllRecords();

  t.deepEqual(dnsController.getRecords(), {});
  
  end(t);
});

test('stop clears state', function(t) {
  let closeAllSocketsSpy = sinon.stub();
  let clearAllRecordsSpy = sinon.stub();

  proxyquireDnsController({
    '../chrome-apis/udp': {
      closeAllSockets: closeAllSocketsSpy
    }
  });

  dnsController.isStarted = sinon.stub().returns(true);
  dnsController.socket = 'foo';
  dnsController.getIPv4Interfaces().push('old interface');
  dnsController.clearAllRecords = clearAllRecordsSpy;

  dnsController.stop();

  // We should delete the existing interfaces.
  t.deepEqual(dnsController.getIPv4Interfaces(), []);

  t.true(closeAllSocketsSpy.calledOnce);
  t.deepEqual(closeAllSocketsSpy.args[0], []);

  t.true(clearAllRecordsSpy.calledOnce);
  t.deepEqual(clearAllRecordsSpy.args[0], []);

  t.equal(dnsController.socket, null);

  end(t);
});
