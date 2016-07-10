/*jshint esnext:true*/
/* globals Promise */
'use strict';

var chromeUdp = require('./chromeUdp');
var dnsUtil = require('./dns-util');
var dnsPacket = require('./dns-packet-sem');
var byteArray = require('./byte-array-sem');
var dnsCodes = require('./dns-codes-sem');
var qSection = require('./question-section');

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

var DNSSD_MULTICAST_GROUP = '224.0.0.251';
var DNSSD_PORT = 53531;
// var DNSSD_SERVICE_NAME = '_services._snd-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.DNSSD_PORT = DNSSD_PORT;

/**
 * These are the records owned by this module. They are maintained in an object
 * of domain name to array of records, e.g. { 'www.example.com': [Object,
 * Object, Object], 'www.foo.com': [Object] }.
 */
var records = {};

var onReceiveCallbacks = [];

/**
 * The IPv4 interfaces for this machine, cached to provide synchronous calls.
 */
var ipv4Interfaces = [];

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
 * Return a cached array of IPv4 interfaces for this machine.
 */
exports.getIPv4Interfaces = function() {
  if (!exports.isStarted()) {
    console.log('Called getIPv4Interfaces when controller was not started');
  }
  if (!ipv4Interfaces) {
    return [];
  } else {
    return ipv4Interfaces;
  }
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
  var index = onReceiveCallbacks.indexOf(callback);
  if (index >= 0) {
    onReceiveCallbacks.splice(index, 1);
  }
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
  if (socket) {
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
    }, function err(error) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when binding DNSSD port:', error));
    })
    .then(function joinedGroup() {
      socket = new chromeUdp.ChromeUdpSocket(socketInfo);
      started = true;
      resolve(socket);
    }, function failedToJoinGroup(result) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when joining DNSSD group: ', result));
    });
  });
};

/**
 * Start the service.
 */
exports.start = function() {
  if (exports.isStarted()) {
    if (dnsUtil.DEBUG) {
      console.log('start called when already started');
    }
    // Already started, resolve immediately.
    return new Promise();
  } else {
    // All the initialization we need to do is create the 
    return new Promise(function(resolve) {
      chromeUdp.getNetworkInterfaces().then(function success(interfaces) {
        interfaces.forEach(iface => {
          if (iface.address.indexOf(':') !== -1) {
            console.log('Not yet supporting IPv6: ', iface);
          } else {
            ipv4Interfaces.push(iface);
          }
        });
        resolve();
      });
    });
  }
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
 * Send the packet to the given address and port.
 *
 * @param {DnsPacket} packet the packet to send
 * @param {string} address the address to which to send the packet
 * @param {number} port the port to sent the packet to
 */
exports.sendPacket = function(packet, address, port) {
  var byteArr = packet.convertToByteArray();
  // And now we need the underlying buffer of the byteArray, truncated to the
  // correct size.
  var uint8Arr = byteArray.getByteArrayAsUint8Array(byteArr);

  exports.getSocket().then(socket => {
    socket.send(uint8Arr.buffer, address, port);
  });
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

  exports.sendPacket(packet, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
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
 * Add a record corresponding to name to the internal data structures.
 */
exports.addRecord = function(name, record) {
  var existingRecords = records[name];
  if (!existingRecords) {
    existingRecords = [];
    records[name] = existingRecords;
  }
  existingRecords.push(record);
};
