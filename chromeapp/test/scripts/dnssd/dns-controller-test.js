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

test('getSocket resolves immediately if is already started', function(t) {
  // Make the module think it has started.
  dnsController.isStarted = () => true;

  var result = dnsController.getSocket();
  result.then(function success(socket) {
    // It should return null by default, as we don't have the socket set yet.
    t.equal(socket, null);
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
  });

  resetDnsController();
});

test('queryForARecord calls query with correct args', function(t) {
  var querySpy = sinon.spy();
  var mockedController = require(
    '../../../app/scripts/dnssd/dns-controller'
  );

  mockedController.query = querySpy;

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

  mockedController.query = querySpy;

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

  mockedController.query = querySpy;

  var instanceName = 'Fancy Cache._semcache._tcp';

  mockedController.queryForSrvRecord(instanceName);

  t.equal(querySpy.firstCall.args[0], instanceName);
  t.equal(querySpy.firstCall.args[1], dnsCodes.RECORD_TYPES.SRV);
  t.equal(querySpy.firstCall.args[2], dnsCodes.CLASS_CODES.IN);

  t.end();

  resetDnsController();
});

test('query calls send with correct args', function(t) {
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

  var byteArr = targetPacket.convertToByteArray();
  var expectedArr = byteArray.getByteArrayAsUint8Array(byteArr);

  // We need a socket that has a send function we can spy on.
  var socket = new chromeUdp.ChromeUdpSocket({socketId: 123, port: 333});
  socket.send = function(uint8Arr, group, port) {
    t.deepEqual(uint8Arr, expectedArr);
    t.equal(group, mockedController.DNSSD_MULTICAST_GROUP);
    t.equal(port, mockedController.DNSSD_PORT);
    t.end();
  };

  mockedController.getSocket = sinon.stub().resolves(socket);
  mockedController.query(qName, qType, qClass);

  resetDnsController();
});
