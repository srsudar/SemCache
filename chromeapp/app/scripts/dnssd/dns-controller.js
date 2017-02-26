/*jshint esnext:true*/
/* globals Promise */
'use strict';

var util = require('../util');
var chromeUdp = require('../chrome-apis/udp');
var dnsUtil = require('./dns-util');
var dnsPacket = require('./dns-packet');
var byteArray = require('./byte-array');
var dnsCodes = require('./dns-codes');
var qSection = require('./question-section');

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

/**
 * This is the IPv4 address specified by RFC 6762 to be used for mDNS.
 */
var DNSSD_MULTICAST_GROUP = '224.0.0.251';

/**
 * The port we use for mDNS.
 *
 * RFC 6762 indicates that port 5353 should be used for mDNS. However, Chrome
 * binds to 5353 (presumably for cloud print or ChromeCast functionality) and
 * does not expose an API to advertise using its internal mDNS machinery. The
 * Chrome App socket API does not provide a way to bind a socket using
 * SO_REUSEADDR, SO_REUSEPORT, or an equivalent, despite the fact that RFC 6762
 * recommends doing so in Section 15.1.
 *
 * Since we cannot bind the conventional port, 5353, we instead are choosing a
 * new port, and deciding on 5353. This can change as long as peers share the
 * port. Ideally we would be using 5353.
 */
var MDNS_PORT = 53531;

/**
 * The special service string used to indicate that callers wish to enumerate
 * all available services, not just services of a particular type.
 *
 * In Section 9, RFC 6763 defines this string. Callers are normally expected to
 * issue DNSSD queries for a particular type, e.g. printers using a protocol
 * they can interact with. This string instead allows callers to enumerate all
 * services.
 */
var DNSSD_SERVICE_NAME = '_services._dns-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.MDNS_PORT = MDNS_PORT;
exports.DNSSD_SERVICE_NAME = DNSSD_SERVICE_NAME;

exports.DEBUG = true;

exports.NEXT_PACKET_ID = 1;


// Section 6 of the RFC covers responding, including when to delay responses.
// In the event that multiple peers may respond simultaneously, collision and
// thus dropped packets are a possibility. To circumvent this, the RFC
// specifies that responses where more than a single response is requested
// should be delayed by a random value between 20 and 120ms. Using these values
// we saw many dropped packets, so we are increasing the range.
exports.RESPONSE_WAIT_MIN = 200;
exports.RESPONSE_WAIT_MAX = 600;

/**
 * These are the records owned by this module. They are maintained in an object
 * of domain name to array of records, e.g. { 'www.example.com': [Object,
 * Object, Object], 'www.foo.com': [Object] }.
 */
var records = {};

var onReceiveCallbacks = new Set();

/**
 * The IPv4 interfaces for this machine, cached to provide synchronous calls.
 */
var ipv4Interfaces = [];

/**
 * Returns all records known to this module.
 *
 * @return {Array.<ARecord|PtrRecord|SrvRecord>} all the resource records known
 * to this module
 */
exports.getRecords = function() {
  return records;
};

/**
 * Returns all the callbacks currently registered to be invoked with incoming
 * packets.
 *
 * @return {Set.<function>} all the onReceive callbacks that have been
 * registered
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
 *
 * @return {boolean} representing whether or not the service has started
 */
exports.isStarted = function() {
  return started;
};

/**
 * Return a cached array of IPv4 interfaces for this machine.
 *
 * @return {Object} an array of all the IPv4 interfaces known to this machine.
 * The objects have the form: 
 * {
 *   name: string,
 *   address: string,
 *   prefixLength: integer
 * }
 */
exports.getIPv4Interfaces = function() {
  if (!exports.isStarted()) {
    throw new Error(
      'Called getIPv4Interfaces when controller was not started'
    );
  }
  if (!ipv4Interfaces) {
    return [];
  } else {
    return ipv4Interfaces;
  }
};

/**
 * Add a callback to be invoked with received packets.
 *
 * @param {function} callback a callback to be invoked with received packets.
 */
exports.addOnReceiveCallback = function(callback) {
  onReceiveCallbacks.add(callback);
};

/**
 * Remove the callback.
 *
 * @param {function} callback the callback function to be removed. The callback
 * should already have been added via a call to addOnReceiveCallback().
 */
exports.removeOnReceiveCallback = function(callback) {
  onReceiveCallbacks.delete(callback);
};

/**
 * The listener that is attached to chrome.sockets.udp.onReceive.addListener
 * when the service is started.
 *
 * @param {Object} info the object that is called by the chrome.sockets.udp
 * API. It is expected to look like:
 * {
 *   data: ArrayBuffer,
 *   remoteAddress: string,
 *   remotePort: integer
 * }
 */
exports.onReceiveListener = function(info) {
  if (dnsUtil.DEBUG) {
    chromeUdp.logSocketInfo(info);
  }

  if (exports.DEBUG) {
    // Before we do anything else, parse the packet. This will let us try to
    // see if we are getting the packet and ignoring it or just never getting
    // the packet.
    var byteArrImmediate = new byteArray.ByteArray(info.data);
    var packetImmediate =
      dnsPacket.createPacketFromReader(byteArrImmediate.getReader());
    console.log('Got packet: ', packetImmediate);
    console.log('  packet id: ', packetImmediate.id);
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
 *
 * @param {DnsPacket} packet the incoming packet
 * @param {string} remoteAddress the remote address sending the packet
 * @param {integer} remotePort the remote port sending the packet
 */
exports.handleIncomingPacket = function(packet, remoteAddress, remotePort) {
  // For now, we are expecting callers to register and de-register their own
  // onReceiveCallback to track responses. This means if it's a response we
  // will just ignore invoke the callbacks and return. If it is a query, we
  // need to respond to it.

  // First, invoke all the callbacks.
  onReceiveCallbacks.forEach(callback => {
    callback(packet);
  });

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

    if (exports.DEBUG) {
      console.log('Received question: ', question);
      console.log('  found records: ', records);
    }

    // If we didn't get any records, don't send anything.
    if (records.length === 0) {
      return;
    }

    records.forEach(record => {
      responsePacket.addAnswer(record);
    });

    // We may be multicasting, or we may be unicast responding.
    var sendAddr = DNSSD_MULTICAST_GROUP;
    var sendPort = MDNS_PORT;
    if (question.unicastResponseRequested()) {
      sendAddr = remoteAddress;
      sendPort = remotePort;
    }
    // Section 6 of the RFC covers responding, including when to delay
    // responses. In the event that multiple peers may respond simultaneously,
    // collision and thus dropped packets are a possibility. To circumvent
    // this, the RFC specifies that responses where more than a single response
    // is requested should be delayed by a random value between 20 and 120ms.
    // We will delay in all cases, as there is no large price to pay for this.
    util.waitInRange(exports.RESPONSE_WAIT_MIN, exports.RESPONSE_WAIT_MAX)
    .then(() => {
      exports.sendPacket(responsePacket, sendAddr, sendPort);
    });
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
 * @param {string} qName the query name
 * @param {integer} qType the query type
 * @param {integer} qClass the query class
 *
 * @return {Array.<ARecord|SrvRecord|PtrRecord>} the array of resource records
 * appropriate for this query
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

  var result = exports.filterResourcesForQuery(
    namedRecords, qName, qType, qClass
  );

  return result;
};

/**
 * Return an Array with only the elements of resources that match the query
 * terms.
 * 
 * @param {Array.<ARecord|PtrRecord|SrvRecord>} resources an Array of resource
 * records that will be filtered
 * @param {string} qName the name of the query
 * @param {integer} qType the type of the query
 * @param {integer} qClass the class of the query
 *
 * @return {Array.<ARecord|PtrRecord|SrvRecord>} the subset of resources that
 * match the query terms
 */
exports.filterResourcesForQuery = function(resources, qName, qType, qClass) {
  var result = [];

  resources.forEach(record => {
    var meetsName = false;
    var meetsType = false;
    var meetsClass = false;
    if (qName === record.name || qName === DNSSD_SERVICE_NAME) {
      meetsName = true;
    }
    if (qType === dnsCodes.RECORD_TYPES.ANY || record.recordType === qType) {
      meetsType = true;
    }
    if (qClass === dnsCodes.CLASS_CODES.ANY || record.recordClass === qClass) {
      meetsClass = true;
    }

    if (meetsName && meetsType && meetsClass) {
      result.push(record);
    }
  });

  return result;
};

/**
 * Returns a promise that resolves with the socket.
 *
 * @return {Promise.<ChromeUdpSocket, Error>} that resolves with a
 * ChromeUdpSocket
 */
exports.getSocket = function() {
  if (exports.socket) {
    // Already started, resolve immediately.
    return Promise.resolve(exports.socket);
  }

  // Attach our listeners.
  chromeUdp.addOnReceiveListener(exports.onReceiveListener);

  return new Promise(function(resolve, reject) {
    // We have two steps to do here: create a socket and bind that socket to
    // the mDNS port.
    var createPromise = chromeUdp.create({});
    createPromise.then(info => {
      exports.socketInfo = info;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', MDNS_PORT);
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
 *
 * @return {Promise.<undefined, Error>}
 */
exports.start = function() {
  // All the initialization we need to do is create the socket (so that we
  // can receive even if we aren't advertising ourselves) and retrieve our
  // network interfaces.
  return new Promise(function(resolve, reject) {
    exports.getSocket()
    .then(function startedSocket() {
      return exports.initializeNetworkInterfaceCache();
    })
    .then(function initializedInterfaces() {
      resolve();
    })
    .catch(function startWentWrong(err) {
      reject(err);
    });
  });
};

/**
 * Initialize the cache of network interfaces known to this machine.
 *
 * @return {Promise.<undefined, Error>} resolves when the cache is initialized
 */
exports.initializeNetworkInterfaceCache = function() {
  return new Promise(function(resolve, reject) {
    chromeUdp.getNetworkInterfaces()
    .then(function success(interfaces) {
      interfaces.forEach(iface => {
        if (iface.address.indexOf(':') !== -1) {
          console.log('Not yet supporting IPv6: ', iface);
        } else {
          ipv4Interfaces.push(iface);
        }
      });
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Remove all records known to the controller.
 */
exports.clearAllRecords = function() {
  records = {};
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

  // Now clear the caches and local state.
  ipv4Interfaces.splice(0);
  exports.clearAllRecords();
};

/**
 * Send the packet to the given address and port.
 *
 * @param {DnsPacket} packet the packet to send
 * @param {string} address the address to which to send the packet
 * @param {integer} port the port to sent the packet to
 */
exports.sendPacket = function(packet, address, port) {
  // For now, change the ID of the packet. We want to allow debugging, so we
  // are going to use this to try and track packets.
  packet.id = exports.NEXT_PACKET_ID;
  exports.NEXT_PACKET_ID += 1;

  var byteArr = packet.convertToByteArray();
  // And now we need the underlying buffer of the byteArray, truncated to the
  // correct size.
  var uint8Arr = byteArray.getByteArrayAsUint8Array(byteArr);

  exports.getSocket().then(socket => {
    if (exports.DEBUG) {
      console.log('dns-controller.sendPacket(): got socket, sending');
      console.log('  packet: ', packet);
      console.log('  address: ', address);
      console.log('  port: ', port);
    }
    socket.send(uint8Arr.buffer, address, port);
  });
};

/**
 * Perform an mDNS query on the network.
 *
 * @param {string} queryName
 * @param {integer} queryType
 * @param {integer} queryClass
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

  exports.sendPacket(packet, DNSSD_MULTICAST_GROUP, MDNS_PORT);
};

/**
 * Issue a query for an A Record with the given domain name. Returns a promise
 * that resolves with a list of ARecords received in response. Resolves with an
 * empty list if none are found.
 *
 * @param {string} domainName the domain name for which to return A Records
 *
 * @return {Array<ARecord|PtrRecord|SrvRecord>} the A Records corresponding to
 * this domain name
 */
exports.queryForARecord = function(domainName) {
  return exports.getResourcesForQuery(
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for PTR Records advertising the given service name. Returns a
 * promise that resolves with a list of PtrRecords received in response.
 * Resolves with an empty list if none are found.
 *
 * @param {string} serviceName the serviceName for which to query for PTR
 * Records
 *
 * @return {Array<ARecord|PtrRecord|SrvRecord>} the PTR Records for the service
 */
exports.queryForPtrRecord = function(serviceName) {
  return exports.getResourcesForQuery(
    serviceName,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for SRV Records corresponding to the given instance name.
 * Returns a promise that resolves with a list of SrvRecords received in
 * response. Resolves with an empty list if none are found.
 *
 * @param {string} instanceName the instance name for which you are querying
 * for SRV Records
 *
 * @return {Array<rARecord|PtrRecord|SrvRecord>} the SRV Records matching this
 * query
 */
exports.queryForSrvRecord = function(instanceName) {
  return exports.getResourcesForQuery(
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Add a record corresponding to name to the internal data structures.
 *
 * @param {string} name the name of the resource record to add
 * @param {ARecord|PtrRecord|SrvRecord} record the record to add
 */
exports.addRecord = function(name, record) {
  var existingRecords = records[name];
  if (!existingRecords) {
    existingRecords = [];
    records[name] = existingRecords;
  }
  existingRecords.push(record);
};
