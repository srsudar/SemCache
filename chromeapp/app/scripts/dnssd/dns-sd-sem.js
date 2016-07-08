/*jshint esnext:true*/
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
var dnsCodes = require('./dns-codes');

var MAX_PROBE_WAIT = 250;

/**
 * Returns a promise that resolves after the given time (in ms).
 */
exports.wait = function(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
};

/**
 * Returns a Promise that resolves after 0-250 ms (inclusive).
 */
exports.waitForProbeTime = function() {
  // +1 because randomInt is by default [min, max)
  return exports.wait(dnsUtil.randomInt(0, MAX_PROBE_WAIT + 1));
};

/**
 * Returns true if the DnsPacket is for this queryName.
 */
exports.packetIsForQuery = function(packet, queryName) {
  packet.questions.forEach(question => {
    if (question.queryName === queryName) {
      return true;
    }
  });
  return false;
};

/**
 * Generates a semi-random hostname ending with ".local". An example might be
 * 'host123.local'.
 */
function createHostName() {
  var start = 'host';
  // We'll return within the range 0, 1000.
  var randomInt = dnsUtil.randomInt(0, 1001);
  var result = start + randomInt + dnsUtil.getLocalSuffix();
  return result;
}

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
 * name: a user-friendly string to be the name of the instance, e.g. "Sam's
 *   SemCache".
 * type: the service type string. This should be the protocol spoken and the
 *   transport protocol, eg "_http._tcp".
 * port: the port the service is available on.
 */
exports.register = function(name, type, port) {
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

  // Start by selecting a semi-random hostname.
  var host = createHostName();

  var result = new Promise(function(resolve, reject) {
    // We start by probing for messages of type ANY with the hostname.
    var hostProbe = exports.issueProbe(
      host,
      dnsCodes.RECORD_TYPES.ANY,
      dnsCodes.CLASS_CODES.IN
    );

    hostProbe.catch(function failure() {
      reject(new Error('host taken: ' + host));
    });

    hostProbe.then(function success() {
      return exports.issueProbe(
        name,
        dnsCodes.RECORD_TYPES.ANY,
        dnsCodes.CLASS_CODES.IN
      );
    })
    .then(function success() {
      // TODO: make records and issue records now that we know we don't have
      // conflicts.
      resolve(
        {
          serviceName: name,
          type: type,
          domain: host,
          port: port
        }
      );
    })
    .catch(function failure() {
      reject(new Error('instance name taken: ' + name));
    });
  });

  return result;
};

exports.receivedPacket = function(packets, queryName) {
  for (var i = 0; i < packets.length; i++) {
    var packet = packets[i];
    if (exports.packetIsForQuery(packet, queryName)) {
      return true;
    }
  }
  return false;
};

/**
 * Issue a probe compliant with the mDNS spec, which specifies that a probe
 * happen three times at random intervals.
 *
 * Returns a promise that resolves if the probe returns nothing, meaning that
 * the queryName is available, and rejects if it is taken.
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
        console.log('added for probe time');
        if (exports.receivedPacket(packets, queryName)) {
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
        if (exports.receivedPacket(packets, queryName)) {
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
        if (exports.receivedPacket(packets, queryName)) {
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
 * Browse for services of a given type. Returns a promise that resolves with
 * a list of objects like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 8889
 * }
 *
 * type: the service string for the type of services queried for, eg
 * "_http._tcp".
 */
exports.browse = function(type) {
  throw new Error('Unimplemented ' + type);
};
