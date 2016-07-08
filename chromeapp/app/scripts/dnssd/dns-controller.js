/*jshint esnext:true*/
'use strict';

var chromeUdp = require('./chromeUdp');
var dnsUtil = require('./dns-util');
var dnsPacket = require('./dns-packet-sem');
var byteArray = require('./byte-array-sem');
var dnsCodes = require('./dns-codes-sem');
var qSection = require('./question-section');
var resRec = require('./resource-record');

var DEFAULT_TTL = 10;
var DEFAULT_PRIORITY = 0;
var DEFAULT_WEIGHT = 0;

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

var DNSSD_MULTICAST_GROUP = '244.0.0.251';
var DNSSD_PORT = 53531;
// var DNSSD_SERVICE_NAME = '_services._snd-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.DNSSD_PORT = DNSSD_PORT;

/**
 * These are the records owned by this module. They are maintained in an object
 * of record type (A, SRV, etc) to an object mapping query name to record.
 * E.g.: {A: {'www.example.com': ARecord} }
 */
var records = {};

var onReceiveCallbacks = [];

/**
 * Returns all records known to this module.
 */
exports.getRecords = function() {
  return records;
};

/**
 * Returns all the callbacks currently registered to be invoked with incoming
 * packets.
 */
exports.getOnReceiveCallbacks = function() {
  return onReceiveCallbacks;
};

/**
 * The socket used for accessing the network. Object of type
 * chromeUdp.ChromeUdpSocket.
 */
var socket = null;
/** The information about the socket we are using. */
var socketInfo = null;

/**
 * True if the service is started.
 */
exports.isStarted = function() {
  return started;
};

/**
 * Add a callback to be invoked with received packets.
 */
exports.addOnReceiveCallback = function(callback) {
  onReceiveCallbacks.push(callback);
};

/**
 * Remove the callback.
 */
exports.removeOnReceiveCallback = function(callback) {
  onReceiveCallbacks.remove(callback);
};

/**
 * The listener that is attached to chrome.sockets.udp.onReceive.addListener
 * when the service is started.
 */
exports.onReceiveListener = function(info) {
  if (dnsUtil.DEBUG) {
    chromeUdp.logSocketInfo(info);
  }

  if (!socket) {
    // We don't have a socket with which to listen.
    return;
  }

  if (socket.socketId !== info.socketId) {
    if (dnsUtil.DEBUG) {
      console.log('Message is not for us, ignoring');
    }
    return;
  }

  if (dnsUtil.DEBUG) {
    console.log('Message is for us, parsing');
  }
  
  // Create a DNS packet.
  var byteArr = new byteArray.ByteArray(info.data);
  var packet = dnsPacket.createPacketFromReader(byteArr.getReader());

  exports.handleIncomingPacket(packet);
};

/**
 * Respond to an incoming packet.
 */
exports.handleIncomingPacket = function(packet) {
  for (var i = 0; i < onReceiveCallbacks.length; i++) {
    var fn = onReceiveCallbacks[i];
    fn(packet);
  }
};

/**
 * Start the system. This must be called before any other calls to this module.
 *
 * Returns a promise that resolves with the socket.
 */
exports.getSocket = function() {
  if (exports.isStarted()) {
    if (dnsUtil.DEBUG) {
      console.log('start called when already started');
    }
    // Already started, resolve immediately.
    return new Promise(resolve => { resolve(socket); });
  }

  // Attach our listeners.
  chromeUdp.addOnReceiveListener(exports.onReceiveListener);

  return new Promise((resolve, reject) => {
    // We have two steps to do here: create a socket and bind that socket to the
    // mDNS port.
    var createPromise = chromeUdp.create({});
    createPromise.then(info => {
      socketInfo = info;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success() {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(socketInfo.socketId, DNSSD_MULTICAST_GROUP);
    }, function error(error) {
      console.log('Error when binding DNSSD port: ', error);
      chromeUdp.closeAllSockets();
      reject();
    })
    .then(function joinedGroup() {
      socket = new chromeUdp.ChromeUdpSocket(socketInfo);
      started = true;
      resolve(socket);
    }, function failedToJoinGroup(result) {
      console.log('Error when joining DNSSD group: ', result);
      chromeUdp.closeAllSockets();
      reject();
    });
  });
};

/**
 * Shuts down the system.
 */
exports.stop = function() {
  if (socket) {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: found socket, closing');
    }
    chromeUdp.closeAllSockets();
    socket = null;
    started = false;
  } else {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: no socket found');
    }
  }
};

/**
 * Perform an mDNS query on the network.
 */
exports.query = function(queryName, queryType, queryClass) {
  // ID is zero, as mDNS ignores the id field.
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

  var question = new qSection.QuestionSection(
    queryName,
    queryType,
    queryClass
  );
  packet.addQuestion(question);

  var byteArr = packet.convertToByteArray();
  // And now we need the underlying buffer of the byteArray, truncated to the
  // correct size.
  var uint8Arr = byteArray.getByteArrayAsUint8Array(byteArr);

  exports.getSocket().then(socket => {
    socket.send(uint8Arr, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
  });
};

/**
 * Issue a query for an A Record with the given domain name. Returns a promise
 * that resolves with a list of ARecords received in response. Resolves with an
 * empty list if none are found.
 */
exports.queryForARecord = function(domainName) {
  exports.query(
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for PTR Records advertising the given service name. Returns a
 * promise that resolves with a list of PtrRecords received in response.
 * Resolves with an empty list if none are found.
 */
exports.queryForPtrRecord = function(serviceName) {
  exports.query(
    serviceName,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for SRV Records corresponding to the given instance name.
 * Returns a promise that resolves with a list of SrvRecords received in
 * response. Resolves with an empty list if none are found.
 */
exports.queryForSrvRecord = function(instanceName) {
  exports.query(
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Add an SRV Record to the DNS system.
 */
exports.addSrvRecord = function(
  instanceName,
  port,
  domainName,
  ttl,
  priority,
  weight
) {
  // Create an empty object if there isn't one already present.
  var srvRecords = records.SRV || {};
  ttl = ttl || DEFAULT_TTL;
  priority = priority || DEFAULT_PRIORITY;
  weight = weight || DEFAULT_WEIGHT;

  var record = new resRec.SrvRecord(
    instanceName,
    ttl,
    priority,
    weight,
    port,
    domainName
  );

  srvRecords[instanceName] = record;
  records.SRV = srvRecords;
};

/**
 * Add an A Record to the DNS System.
 */
exports.addARecord = function(domainName, ipString) {
  console.log(domainName, ipString);
};

/**
 * Add a PTR Record to the DNS System.
 */
exports.addPtrRecord = function(serviceInstance, serviceDomain) {
  // unsure if this is the right signature
  console.log(serviceInstance, serviceDomain);
};
