/*jshint esnext:true*/
/* globals Promise */
'use strict';

/**
 * The client API for interacting with mDNS and DNS-SD.
 *
 * This is based in part on the Bonjour APIs outlined in 'Zero Configuration
 * Networking: The Definitive Guide' by Cheshire and Steinberg in order to
 * provide a familiar interface.
 *
 * 'RFC 6762: Multicast DNS' is the model for many of the decisions and actions
 * take in this module. 'The RFC' in comments below refers to this RFC. It can
 * be accessed here:
 *
 * https://tools.ietf.org/html/rfc6762#
 *
 * Since this is programming to a specification (or at least to an RFC), it is
 * conforming to a standard. Actions are explained in comments, with direct
 * references to RFC sections as much as is possible.
 */


var dnsUtil = require('./dns-util');
var dnsController = require('./dns-controller');
var dnsCodes = require('./dns-codes-sem');
var resRec = require('./resource-record');
var dnsPacket = require('./dns-packet-sem');

var MAX_PROBE_WAIT = 250;
var DEFAULT_QUERY_WAIT_TIME = 2000;

exports.DEFAULT_QUERY_WAIT_TIME = DEFAULT_QUERY_WAIT_TIME;

exports.LOCAL_SUFFIX = 'local';

/**
 * Returns a promise that resolves after the given time (in ms).
 *
 * @param {integer} ms the number of milliseconds to wait before resolving
 */
exports.wait = function(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
};

/**
 * Returns a Promise that resolves after 0-250 ms (inclusive).
 *
 * @return {Promise}
 */
exports.waitForProbeTime = function() {
  // +1 because randomInt is by default [min, max)
  return exports.wait(dnsUtil.randomInt(0, MAX_PROBE_WAIT + 1));
};

/**
 * Returns true if the DnsPacket is for this queryName.
 *
 * @param {DnsPacket} packet
 * @param {string} qName
 * @param {integer} qType
 * @param {integer} qClass
 *
 * @return {boolean}
 */
exports.packetIsForQuery = function(packet, qName, qType, qClass) {
  var filteredRecords = dnsController.filterResourcesForQuery(
    packet.answers, qName, qType, qClass
  );
  return filteredRecords.length !== 0;
};

/**
 * Generates a semi-random hostname ending with ".local". An example might be
 * 'host123.local'.
 *
 * @param {string}
 */
exports.createHostName = function() {
  var start = 'host';
  // We'll return within the range 0, 1000.
  var randomInt = dnsUtil.randomInt(0, 1001);
  var result = start + randomInt + dnsUtil.getLocalSuffix();
  return result;
};

/**
 * Advertise the resource records.
 *
 * @param {Array<resource records>} resourceRecords the records to advertise
 */
exports.advertiseService = function(resourceRecords) {
  var advertisePacket = new dnsPacket.DnsPacket(
    0,      // id 0 for mDNS
    false,  // not a query
    0,      // opCode must be 0 on transmit (18.3)
    false,  // authoritative must be false on transmit (18.4)
    false,  // isTruncated must be false on transmit (18.5)
    false,  // recursion desired should be 0 (18.6)
    false,  // recursion available must be 0 (18.7)
    false   // return code must be 0 (18.11)
  );

  // advertisements should be sent in the answer section
  resourceRecords.forEach(record => {
    advertisePacket.addAnswer(record);
  });
  dnsController.sendPacket(
    advertisePacket,
    dnsController.DNSSD_MULTICAST_GROUP,
    dnsController.DNSSD_PORT
  );
};

/**
 * Register a service via mDNS. Returns a Promise that resolves with an object
 * like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 1234
 * }
 *
 * @param {string} host the host of the service, e.g. 'laptop.local'
 * @param {string} name a user-friendly string to be the name of the instance,
 * e.g. "Sam's SemCache".
 * @param {string} type the service type string. This should be the protocol
 * spoken and the transport protocol, eg "_http._tcp".
 * @param {integer} port the port the service is available on
 */
exports.register = function(host, name, type, port) {
  // Registration is a multi-step process. According to the RFC, section 8.
  //
  // 8.1 indicates that the first step is to send an mDNS query of type ANY
  // (255) for a given domain name.
  //
  // 8.1 also indicates that the host should wait a random time between 0-250ms
  // before issuing the query. This must be performed a total of three times
  // before a lack of responses indicates that the name is free.
  //
  // The probes should be sent with QU questions with the unicast response bit
  // set.
  //
  // 8.2 goes into tiebreaking. That is omitted here.
  //
  // 8.3 covers announcing. After probing, announcing is performed with all of
  // the newly created resource records in the Answer Section. This must be
  // performed twice, one second apart.

  var result = new Promise(function(resolve, reject) {
    var foundHostFree = null;
    // We start by probing for messages of type ANY with the hostname.
    exports.issueProbe(
      host,
      dnsCodes.RECORD_TYPES.ANY,
      dnsCodes.CLASS_CODES.IN
    ).then(function hostFree() {
      foundHostFree = true;
      // We need to probe for the name under which a SRV record would be, which
      // is name.type.local
      var srvName = exports.createSrvName(name, type, 'local');
      return exports.issueProbe(
        srvName,
        dnsCodes.RECORD_TYPES.ANY,
        dnsCodes.CLASS_CODES.IN
      );
    }, function hostTaken() {
      foundHostFree = false;
      reject(new Error('host taken: ' + host));
    }).then(function instanceFree() {
      if (foundHostFree) {
        var hostRecords = exports.createHostRecords(host);
        var serviceRecords = exports.createServiceRecords(
          name,
          type,
          port,
          host
        );
        var allRecords = hostRecords.concat(serviceRecords);
        exports.advertiseService(allRecords);

        resolve(
          {
            serviceName: name,
            type: type,
            domain: host,
            port: port
          }
        );
      }
    }, function instanceTaken() {
      console.log('INSTANCE TAKEN');
      reject(new Error('instance taken: ' + name));
    });
  });

  return result;
};

/**
 * Register the host on the network. Assumes that a probe has occurred and the
 * hostname is free.
 *
 * @param {string} host
 *
 * @return {Array<resource records>} an Array of the records that were added.
 */
exports.createHostRecords = function(host) {
  // This just consists of an A Record. Make an entry for every IPv4 address.
  var result = [];
  dnsController.getIPv4Interfaces().forEach(iface => {
    var aRecord = new resRec.ARecord(
      host,
      dnsUtil.DEFAULT_TTL,
      iface.address,
      dnsCodes.CLASS_CODES.IN
    );
    result.push(aRecord);
    dnsController.addRecord(host, aRecord);
  });
  return result;
};

/**
 * Create the complete name of the service as is appropriate for a SRV record,
 * e.g. "Sam Cache._semcache._tcp.local".
 *
 * @param {string} userFriendlyName the friendly name of the instance, e.g.
 * "Sam Cache"
 * @param {string} type the type string of the service, e.g. "_semcache._tcp"
 * @param {string} domain the domain in which to find the service, e.g. "local"
 *
 * @return {string}
 */
exports.createSrvName = function(userFriendlyName, type, domain) {
  return [userFriendlyName, type, domain].join('.');
};

/**
 * Register the service on the network. Assumes that a probe has occured and
 * the service name is free.
 *
 * @param {string} name name of the instance, e.g. 'Sam Cache'
 * @param {string} type type of the service, e.g. _semcache._tcp
 * @param {integer} port port the service is running on, eg 7777
 * @param {string} domain target domain/host the service is running on, e.g.
 * 'blackhack.local'
 *
 * @return {Array<resource records>} an Array of the records that were added.
 */
exports.createServiceRecords = function(name, type, port, domain) {
  // We need to add a PTR record and an SRV record.

  // SRV Records are named according to name.type.domain, which we always
  // assume to be local.
  var srvName = exports.createSrvName(name, type, 'local');
  var srvRecord = new resRec.SrvRecord(
    srvName,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  var ptrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    srvName,
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(srvName, srvRecord);
  dnsController.addRecord(type, ptrRecord);

  var result = [srvRecord, ptrRecord];
  return result;
};

exports.receivedResponsePacket = function(packets, qName, qType, qClass) {
  for (var i = 0; i < packets.length; i++) {
    var packet = packets[i];
    if (
      !packet.isQuery &&
        exports.packetIsForQuery(packet, qName, qType, qClass)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Issue a probe compliant with the mDNS spec, which specifies that a probe
 * happen three times at random intervals.
 *
 * @param {string} queryName
 * @param {integer} queryType
 * @param {integer} queryClass
 *
 * @return {Promise} Returns a promise that resolves if the probe returns
 * nothing, meaning that the queryName is available, and rejects if it is
 * taken.
 */
exports.issueProbe = function(queryName, queryType, queryClass) {
  // Track the packets we receive whilst querying.
  var packets = [];
  var callback = function(packet) {
    packets.push(packet);
  };
  dnsController.addOnReceiveCallback(callback);

  // Now we kick off a series of queries. We wait a random time to issue a
  // query. 250ms after that we issue another, then another.
  var result = new Promise(function(resolve, reject) {
    exports.waitForProbeTime()
      .then(function success() {
        dnsController.query(
          queryName,
          queryType,
          queryClass
        );
        return exports.wait(MAX_PROBE_WAIT);
      }).then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(
          packets, queryName, queryType, queryClass
        )) {
          throw new Error('received a packet, jump to catch');
        } else {
          resolve();
          dnsController.removeOnReceiveCallback(callback);
        }
      })
      .catch(function failured() {
        dnsController.removeOnReceiveCallback(callback);
        reject();
      });
  });

  return result;
};

/**
 * Issue a query for instances of a particular service type. Tantamout to
 * issueing PTR requests.
 *
 * @param {string} serviceType the service string to query for
 * @param {number} waitTime the time to wait for responses. As multiple
 * responses can be expected in response to a query for instances of a service
 * (as multiple instances can exist on the same network), the Promise will
 * always resolve after this many milliseconds.
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   instanceName: 'Magic Cache'
 * }
 */
exports.queryForServiceInstances = function(serviceType, timeout) {
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.PTR;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      serviceType,
      rType,
      rClass,
      true,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                serviceType: answer.serviceType,
                serviceName: answer.instanceName
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query for an IP address mapping to a domain.
 *
 * @param {string} domainName the domain name to query for
 * @param {number} timeout the number of ms after which to time out
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   domainName: 'example.local',
 *   ipAddress: '123.4.5.6'
 * }
 */
exports.queryForIpAddress = function(domainName, timeout) {
  // Note that this method ignores the fact that you could have multiple IP
  // addresses per domain name. At a minimum, you could have IPv6 and IPv4
  // addresses. For prototyping purposes, a single IP address is sufficient.
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.A;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      domainName,
      rType,
      rClass,
      false,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                domainName: answer.domainName,
                ipAddress: answer.ipAddress
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query for information about a service instance name, including the
 * port and domain name on which it is active.
 *
 * @param {string} instanceName the instance name to query for
 * @param {number} timeout the number of ms after which to time out
 *
 * @return {Promise} Returns a Promise that resolves with a list of objects
 * representing services, like the following:
 * {
 *   instanceName: 'Sam Cache',
 *   domain: 'example.local',
 *   port: 1234
 * }
 */
exports.queryForInstanceInfo = function(instanceName, timeout) {
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  var rType = dnsCodes.RECORD_TYPES.SRV;
  var rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve) {
    exports.queryForResponses(
      instanceName,
      rType,
      rClass,
      false,
      timeout
    )
    .then(function gotPackets(packets) {
      var result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            result.push(
              {
                instanceName: answer.instanceTypeDomain,
                domain: answer.targetDomain,
                port: answer.port
              }
            );
          }
        });
      });
      resolve(result);
    });
  });
};

/**
 * Issue a query and listen for responses. (As opposed to simply issuing a DNS
 * query without being interested in the responses.)
 * 
 * @param {String} qName the name of the query to issue
 * @param {number} qType the type of the query to issue
 * @param {number} qClass the class of the query to issue
 * @param {boolean} multipleResponses true if we can expect multiple or an open
 * ended number of responses to this query
 * @param {number} timeoutOrWait if multipleExpected is true, this is the
 * amount of time we wait before returning results. If multipleExpected is
 * false (e.g. querying for an A Record, which should have a single answer),
 * this is the amount of time we wait before timing out and resolving with an
 * empty list.
 *
 * @return {Promise} Returns a Promise that resolves with an Array of Packets
 * received in response to the query. If multipleResponses is true, will not
 * resolve until timeoutOrWait milliseconds. If multipleResponses is false,
 * will resolve after the first packet is received or after timeoutOrWait is
 * satifised. 
 */
exports.queryForResponses = function(
  qName,
  qType,
  qClass,
  multipleResponses,
  timeoutOrWait
) {
  // Considerations for querying exist in RFC 6762 Section 5.2: Continuous
  // Multicast DNS Querying. This scenario essentially allows for a standing
  // request for notifications of instances of a particular type. This is
  // useful for to automatically update a list of available printers, for
  // example. For the current implementation, we are instead going to just
  // issue a query for PTR records of the given type.
  //
  // Several considerations are made in the RFC for how to responsibly browse
  // the network. First, queries should be delayed by a random value between
  // 20 and 120ms, in order to not collide or flood in the event that a browse
  // is triggered at the same time, e.g. by a common event. Second, the first
  // two queries must take place 1 second apart. Third, the period between
  // queries must increase by at least a factor of 2. Finally, known-answer
  // suppression must be employed.
  //
  // For now, we are not implementing those more sophisticated features.
  // Instead, this method provides a way to issue a query immediately. This can
  // include a general standing query (if multipleResponses is true), or a
  // query for the first response (if multipleResponses is false).

  return new Promise(function(resolve) {
    // Code executes even after a promise resolves, so we will use this flag to
    // make sure we never try to resolve more than once.
    var resolved = false;

    // Track the packets we received while querying.
    var packets = [];
    var callback = function(packet) {
      if (exports.packetIsForQuery(packet, qName)) {
        packets.push(packet);
        if (!multipleResponses) {
          // We can go ahead an resolve.
          resolved = true;
          dnsController.removeOnReceiveCallback(callback);
          resolve(packets);
        }
      }
    };
    dnsController.addOnReceiveCallback(callback);

    // A browse for a service corresponds to queries for PTR records.
    dnsController.query(
      qName,
      dnsCodes.RECORD_TYPES.PTR,
      dnsCodes.CLASS_CODES.IN
    );
    
    exports.wait(timeoutOrWait)
      .then(function waited() {
        if (!resolved) {
          dnsController.removeOnReceiveCallback(callback);
          resolved = true;
          resolve(packets);
        }
      })
      .catch(function somethingWentWrong(err) {
        console.log('Something went wrong in query: ', err);
      });
  });
};
