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
var DNSSD_SERVICE_NAME = '_services._dns-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.DNSSD_PORT = DNSSD_PORT;
exports.DNSSD_SERVICE_NAME = DNSSD_SERVICE_NAME;

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
exports.socket = null;
/** The information about the socket we are using. */
exports.socketInfo = null;

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

  if (!exports.socket) {
    // We don't have a socket with which to listen.
    return;
  }

  if (exports.socket.socketId !== info.socketId) {
    if (dnsUtil.DEBUG) {
      console.log('Message is for this address but not this socket, ignoring');
    }
    return;
  }

  if (dnsUtil.DEBUG) {
    console.log('Message is for us, parsing');
  }
  
  // Create a DNS packet.
  var byteArr = new byteArray.ByteArray(info.data);
  var packet = dnsPacket.createPacketFromReader(byteArr.getReader());

  exports.handleIncomingPacket(packet, info.remoteAddress, info.remotePort);
};

/**
 * Respond to an incoming packet.
 */
exports.handleIncomingPacket = function(packet, remoteAddress, remotePort) {
  // For now, we are expecting callers to register and de-register their own
  // onReceiveCallback to track responses. This means if it's a response we
  // will just ignore invoke the callbacks and return. If it is a query, we
  // need to respond to it.

  // First, invoke all the callbacks.
  for (var i = 0; i < onReceiveCallbacks.length; i++) {
    var fn = onReceiveCallbacks[i];
    fn(packet);
  }

  // Second, see if it's a query. If it is, get the requested records,
  // construct a packet, and send the packet.
  if (!packet.isQuery) {
    return;
  }

  if (packet.questions.length === 0) {
    console.log('Query packet has no questions: ', packet.questions);
    return;
  }

  // According to the RFC, multiple questions in the same packet are an
  // optimization and nothing more. We will respond to each question with its
  // own packet while still being compliant.
  packet.questions.forEach(question => {
    var responsePacket = exports.createResponsePacket(packet);
    var records = exports.getResourcesForQuery(
      question.queryName,
      question.queryType,
      question.queryClass
    );

    // If we didn't get any records, don't send anything.
    if (records.length === 0) {
      return;
    }

    records.forEach(record => {
      responsePacket.addAnswer(record);
    });

    // We may be multicasting, or we may be unicast responding.
    var sendAddr = DNSSD_MULTICAST_GROUP;
    var sendPort = DNSSD_PORT;
    if (question.unicastResponseRequested()) {
      sendAddr = remoteAddress;
      sendPort = remotePort;
    }
    exports.sendPacket(responsePacket, sendAddr, sendPort);
  });
};

/**
 * Create a response packet with the appropriate parameters for the given
 * query. It does not include any resource records (including questions).
 *
 * @param {DnsPacket} queryPacket the query packet to create a response to.
 *
 * @return {DnsPacket} the packet in response. No records are included.
 */
exports.createResponsePacket = function(queryPacket) {
  // According to section 6 of the RFC we do not include the question we are
  // answering in response packets:
  // "Multicast DNS responses MUST NOT contain any questions in the Question
  // Section.  Any questions in the Question Section of a received Multicast
  // DNS response MUST be silently ignored.  Multicast DNS queriers receiving
  // Multicast DNS responses do not care what question elicited the response;
  // they care only that the information in the response is true and accurate."
  if (queryPacket) {
    // We aren't actually using the query packet yet, but we might be in the
    // future, so the API includes it.
    // no op.
  }
  var result = new dnsPacket.DnsPacket(
    0,      // 18.1: IDs in responses MUST be set to 0
    false,  // not a query.
    0,      // 18.3: MUST be set to 0
    true,   // 18.4: in response MUST be set to one
    0,      // 18.5: might be non-0, but caller can adjust if truncated
    0,      // 18.6: SHOULD be 0
    0,      // 18.7 MUST be 0
    0       // 18.11 MUST be 0
  );
  return result;
};

/**
 * Return the resource records belonging to this server that are appropriate
 * for this query. According to section 6 of the RFC, we only respond with
 * records for which we are authoritative. Thus we also must omit records from
 * any cache we are maintaining, unless those records originated from us and
 * are thus considered authoritative.
 *
 * @param {String} qName the query name
 * @param {number} qType the query type
 * @param {number} qClass the query class
 *
 * @return {Array<resource record>} the array of resource records appropriate
 * for this query
 */
exports.getResourcesForQuery = function(qName, qType, qClass) {
  // According to RFC section 6: 
  // "The determination of whether a given record answers a given question is
  // made using the standard DNS rules: the record name must match the question
  // name, the record rrtype must match the question qtype unless the qtype is
  // "ANY" (255) or the rrtype is "CNAME" (5), and the record rrclass must
  // match the question qclass unless the qclass is "ANY" (255).  As with
  // Unicast DNS, generally only DNS class 1 ("Internet") is used, but should
  // client software use classes other than 1, the matching rules described
  // above MUST be used."

  // records stored as {qName: [record, record, record] }
  var namedRecords = records[qName];

  // We need to special case the DNSSD service enumeration string, as specified
  // in RFC 6763, Section 9.
  if (qName === DNSSD_SERVICE_NAME) {
    // This essentially is just a request for all PTR records, regardless of
    // name. We will just get all the records and let the later machinery
    // filter as necessary for class and type.
    namedRecords = [];
    Object.keys(records).forEach(key => {
      var keyRecords = records[key];
      keyRecords.forEach(record => {
        if (record.recordType === dnsCodes.RECORD_TYPES.PTR) {
          namedRecords.push(record);
        }
      });
    });
  }

  if (!namedRecords) {
    // Nothing at all--return an empty array
    return [];
  }
  
  var result = [];

  namedRecords.forEach(record => {
    var meetsType = false;
    var meetsClass = false;
    if (qType === dnsCodes.RECORD_TYPES.ANY || record.recordType === qType) {
      meetsType = true;
    }
    if (qClass === dnsCodes.CLASS_CODES.ANY || record.recordClass === qClass) {
      meetsClass = true;
    }

    if (meetsType && meetsClass) {
      result.push(record);
    }
  });

  return result;
};

/**
 * Start the system. This must be called before any other calls to this module.
 *
 * Returns a promise that resolves with the socket.
 */
exports.getSocket = function() {
  if (exports.socket) {
    // Already started, resolve immediately.
    return new Promise(resolve => { resolve(exports.socket); });
  }

  // Attach our listeners.
  chromeUdp.addOnReceiveListener(exports.onReceiveListener);

  return new Promise((resolve, reject) => {
    // We have two steps to do here: create a socket and bind that socket to
    // the mDNS port.
    var createPromise = chromeUdp.create({});
    createPromise.then(info => {
      exports.socketInfo = info;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success() {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(
        exports.socketInfo.socketId,
        DNSSD_MULTICAST_GROUP
      );
    }, function err(error) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when binding DNSSD port:', error));
    })
    .then(function joinedGroup() {
      exports.socket = new chromeUdp.ChromeUdpSocket(exports.socketInfo);
      started = true;
      resolve(exports.socket);
    }, function failedToJoinGroup(result) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when joining DNSSD group: ', result));
    });
  });
};

/**
 * Start the service.
 *
 * Returns a Promise that resolves when everything is up and running.
 */
exports.start = function() {
  if (exports.isStarted()) {
    if (dnsUtil.DEBUG) {
      console.log('start called when already started');
    }
    // Already started, resolve immediately.
    return new Promise();
  } else {
    // All the initialization we need to do is create the socket (so that we
    // can receive even if we aren't advertising ourselves) and retrieve our
    // network interfaces.
    return new Promise(function(resolve, reject) {
      exports.getSocket()
      .then(function startedSocket() {
        exports.initializeNetworkInterfaceCache();
      })
      .then(function initializedInterfaces() {
        resolve();
      })
      .catch(function startWhenWrong() {
        reject();
      });
    });
  }
};

exports.initializeNetworkInterfaceCache = function() {
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
};

/**
 * Shuts down the system.
 */
exports.stop = function() {
  if (exports.socket) {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: found socket, closing');
    }
    chromeUdp.closeAllSockets();
    exports.socket = null;
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
  exports.getResourcesForQuery(
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
  exports.getResourcesForQuery(
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
  exports.getResourcesForQuery(
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
