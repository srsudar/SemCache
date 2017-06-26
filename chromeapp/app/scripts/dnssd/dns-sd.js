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


const _ = require('lodash');

const util = require('../util');
const dnsUtil = require('./dns-util');
const dnsController = require('./dns-controller');
const dnsCodes = require('./dns-codes');
const resRec = require('./resource-record');
const dnsPacket = require('./dns-packet');

/**
 * In Section 8.1, RFC 6762 uses 250ms as the length of time clients should
 * wait when probing the network for responses when attempting to determine
 * records (e.g. host names) are already claimed by other devices. In order to
 * remain compliant with the RFC, It should not be changed.
 */
const MAX_PROBE_WAIT = 250;

/**
 * This is the default time we will wait for a response to a DNS query before
 * timing out.
 *
 * This is a best effort value and may be tuned.
 */
const DEFAULT_QUERY_WAIT_TIME = 3000;

exports.DEFAULT_QUERY_WAIT_TIME = DEFAULT_QUERY_WAIT_TIME;

/**
 * The default number of additional queries that are sent if an expected
 * response is not generated. E.g. SRV records are expected to generate A
 * records, unless a peer leaves the group. If a SRV does not generate an A on
 * the first query, the query will be issued up to this many additional times.
 */
exports.DEFAULT_NUM_RETRIES = 2;

/**
 * In Section 3, RFC 6762 reserves the top-level domain 'local' for hosts on
 * the local network. This value is 'local' without any leading or trailing
 * periods.
 */
exports.LOCAL_SUFFIX = 'local';

/**
 * The default number of initial scans for PTR requests. Since PTR requests
 * accept multiple responses (i.e. from all the devices on the network) these
 * additional queries will always be issued, so the number should be increased
 * more cautiously than DEFAULT_NUM_RETRIES.
 */
exports.DEFAULT_NUM_PTR_RETRIES = 2;

exports.LOCAL_SUFFIX = 'local';

exports.DEBUG = true;

/**
 * Returns a Promise that resolves after 0-250 ms (inclusive).
 *
 * @return {Promise}
 */
exports.waitForProbeTime = function() {
  // +1 because randomInt is by default [min, max)
  return util.wait(util.randomInt(0, MAX_PROBE_WAIT + 1));
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
  let filteredRecords = dnsController.filterResourcesForQuery(
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
  let start = 'host';
  // We'll return within the range 0, 1000.
  let randomInt = dnsUtil.randomInt(0, 1001);
  let result = start + randomInt + dnsUtil.getLocalSuffix();
  return result;
};

/**
 * Advertise the resource records.
 *
 * @param {Array.<ARecord|PtrRecord|SrvRecord>} resourceRecords the records to
 * advertise
 */
exports.advertiseService = function(resourceRecords) {
  let advertisePacket = new dnsPacket.DnsPacket(
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
    dnsController.MDNS_PORT
  );
};

/**
 * Register a service via mDNS.
 *
 * @param {string} host the host of the service, e.g. 'laptop.local'
 * @param {string} name a user-friendly string to be the name of the instance,
 * e.g. "Sam's SemCache".
 * @param {string} type the service type string. This should be the protocol
 * spoken and the transport protocol, eg "_http._tcp".
 * @param {integer} port the port the service is available on
 *
 * @return {Promise.<Object, Error>} Returns a Promise that resolves with an object
 * like the following:
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 1234
 * }
 */
exports.register = function(host, name, type, port) {
  // Registration is a multi-step process. It is described in Section 8 of the
  // RFC.
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

  let result = new Promise(function(resolve, reject) {
    let foundHostFree = null;
    // We start by probing for messages of type ANY with the hostname.
    exports.issueProbe(
      host,
      dnsCodes.RECORD_TYPES.ANY,
      dnsCodes.CLASS_CODES.IN
    )
    .then(function hostFree() {
      foundHostFree = true;
      // We need to probe for the name under which a SRV record would be, which
      // is name.type.local
      let srvName = exports.createSrvName(name, type, 'local');
      return exports.issueProbe(
        srvName,
        dnsCodes.RECORD_TYPES.ANY,
        dnsCodes.CLASS_CODES.IN
      );
    }, function hostTaken() {
      foundHostFree = false;
      reject(new Error('host taken: ' + host));
    })
    .then(function instanceFree() {
      if (foundHostFree) {
        let hostRecords = exports.createHostRecords(host);
        let serviceRecords = exports.createServiceRecords(
          name,
          type,
          port,
          host
        );
        let allRecords = hostRecords.concat(serviceRecords);
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
 * @return {Array.<ARecord|PtrRecord|SrvRecord>} an Array of the records that
 * were added.
 */
exports.createHostRecords = function(host) {
  // This just consists of an A Record. Make an entry for every IPv4 address.
  let result = [];
  dnsController.getIPv4Interfaces().forEach(iface => {
    let aRecord = new resRec.ARecord(
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
 * @return {Array<ARecord|PtrRecord|SrvRecord>} an Array of the records that
 * were added.
 */
exports.createServiceRecords = function(name, type, port, domain) {
  // We need to add a PTR record and an SRV record.

  // SRV Records are named according to name.type.domain, which we always
  // assume to be local.
  let srvName = exports.createSrvName(name, type, 'local');
  let srvRecord = new resRec.SrvRecord(
    srvName,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  let ptrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    srvName,
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(srvName, srvRecord);
  dnsController.addRecord(type, ptrRecord);

  let result = [srvRecord, ptrRecord];
  return result;
};

/**
 * @param {Array.<DnsPacket>}
 * @param {string} qName
 * @param {integer} qType
 * @param {integer} qClass
 *
 * @return {boolean}
 */
exports.receivedResponsePacket = function(packets, qName, qType, qClass) {
  for (let i = 0; i < packets.length; i++) {
    let packet = packets[i];
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
 * @return {Promise.<undefined, undefined>} Returns a promise that resolves if
 * the probe returns nothing, meaning that the queryName is available, and
 * rejects if it is taken.
 */
exports.issueProbe = function(queryName, queryType, queryClass) {
  // Track the packets we receive whilst querying.
  let packets = [];
  let callback = function(packet) {
    packets.push(packet);
  };
  dnsController.addOnReceiveCallback(callback);

  // Now we kick off a series of queries. We wait a random time to issue a
  // query. 250ms after that we issue another, then another.
  let result = new Promise(function(resolve, reject) {
    exports.waitForProbeTime()
    .then(function success() {
      dnsController.query(
        queryName,
        queryType,
        queryClass
      );
      return util.wait(MAX_PROBE_WAIT);
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
        return util.wait(MAX_PROBE_WAIT);
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
        return util.wait(MAX_PROBE_WAIT);
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
 * Get operational info for the given service instance. This essentially
 * provides the combined results of both a SRV and A record request.
 *
 * @param {string} serviceName the service name contained in a PTR record. This
 * should be the full name, not just the user friendly portion of the name.
 * E.g. `Tyrion's Cache._semcache._tcp.local`, not `Tyrion's Cache`.
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an object like
 * the following if resolution succeeds. The Promise rejects if resolution
 * cannot complete (e.g. if a SRV or A records is not found) or if an error
 * occurs.
 * {
 *   serviceType: '_semcache._tcp',
 *   friendlyName: 'Sam Cache',
 *   instanceName: 'Sam Cache._semcache._tcp.local',
 *   domainName: 'laptop.local',
 *   ipAddress: '123.4.5.6',
 *   port: 8888
 * }
 */
exports.resolveService = function(serviceName) {
  console.log('resolveService: ', serviceName);
  return new Promise(function(resolve, reject) {
    let srvRec = null;
    let aRec = null;
    exports.queryForInstanceInfo(
        serviceName,
        exports.DEFAULT_QUERY_WAIT_TIME,
        exports.DEFAULT_NUM_RETRIES
    )
    .then(srvInfos => {
      if (exports.DEBUG) {
        console.log('srvInfos: ', srvInfos);
      }
      if (!srvInfos || srvInfos.length === 0) {
        let msg = 'did not find SRV record for service: ' + serviceName;
        console.warn(msg);
        reject(msg);
        return;
      }
      srvRec = srvInfos[0];
      
      return exports.queryForIpAddress(
        srvRec.domain,
        exports.DEFAULT_QUERY_WAIT_TIME,
        exports.DEFAULT_NUM_RETRIES
      );
    })
    .then(aInfos => {
      if (exports.DEBUG) {
        console.log('aInfos: ', aInfos);
      }
      if (!aInfos || aInfos.length === 0) {
        let msg = 'did not find A record for SRV: ' + JSON.stringify(srvRec);
        console.warn(msg);
        reject(msg);
        return;
      }
      aRec = aInfos[0];
      let friendlyName = exports.getUserFriendlyName(serviceName);

      let result = {
        serviceType: srvRec.instanceTypeDomain,
        friendlyName: friendlyName,
        instanceName: serviceName,
        domainName: srvRec.domain,
        ipAddress: aRec.ipAddress,
        port: srvRec.port
      };
      resolve(result); 
    })
    .catch(err => {
      reject(err);
    });
  });

};

/**
 * Get operational information on all services of a given type on the network.
 *
 * This is a convenience method for issuing a series of requests--for PTR
 * records to find the specific instances providing a service, SRV records for
 * finding the port and host name of those instances, and finally A records for
 * determining the IP addresses of the hosts.
 *
 * NB: This is a convenience method that disregards DNSSD best practices. It
 * generates a significant amount of mDNS/UDP traffic that in real world tests
 * with multiple peers has resulted in some routers being overwhelmed and
 * dropping packets, hurting discovery. In general, only the service name (as
 * stored in PTR records), is safe for long term cache. One of the objectives
 * of DNSSD is to provide a zero configuration setting that is safe to cache
 * even across IP changes. It accomplishes this by saving only a user-friendly
 * name, resolving the IP address and port on each use of the servce. From
 * Apple's documentation:
 *
 *     Service discovery typically takes place only once in a while—for
 *     example, when a user first selects a printer. This operation saves the
 *     service instance name, the intended stable identifier for any given
 *     instance of a service. Port numbers, IP addresses, and even host names
 *     can change from day to day, but a user should not need to reselect a
 *     printer every time this happens. Accordingly, resolution from a service
 *     name to socket information does not happen until the service is actually
 *     used.
 *
 *     https://developer.apple.com/library/content/documentation/Cocoa/
 *     Conceptual/NetServices/Articles/NetServicesArchitecture.html
 *
 * This method encourages the mass resolution and caching of all services on a
 * network. In addition to generating a large amount of traffic, this method
 * also violates the design goal above. It is useful for debugging and a
 * general purpose solution, but it should not be used as a general discovery
 * mechanism.
 *
 * @param {string} serviceType the type of the service to browse for
 *
 * @return {Promise.<Array.<Object>, Error>} a Promise that resolves with
 * operational information for all instances. This is an Array of objects like
 * the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   friendlyName: 'Sam Cache',
 *   domainName: 'laptop.local',
 *   ipAddress: '123.4.5.6',
 *   port: 8888,
 *   instanceName: 'Sam Cache._semcache._tcp.local'
 * }
 */
exports.browseServiceInstances = function(serviceType) {
  return new Promise(function(resolve, reject) {
    let ptrResponses = [];
    let srvResponses = [];
    let aResponses = [];

    // When resolving services, it is possible that at every step along the way
    // a request goes unanswered. These arrays will keep track of that.
    // The PTR records for which SRV records were returned
    let ptrsWithSrvs = [];
    // The PTR records for which both SRV and A records were returned
    let ptrsWithAs = [];
    // SRV records for which A records were returned
    let srvsWithAs = [];

    exports.queryForServiceInstances(
      serviceType,
      exports.DEFAULT_QUERY_WAIT_TIME,
      exports.DEFAULT_NUM_PTR_RETRIES
    )
    .then(function success(ptrInfos) {
      if (exports.DEBUG) {
        console.log('ptrInfos: ', ptrInfos);
      }
      let srvRequests = [];
      ptrInfos.forEach(ptr => {
        ptrResponses.push(ptr);
        let instanceName = ptr.serviceName;
        let req = exports.queryForInstanceInfo(
          instanceName,
          exports.DEFAULT_QUERY_WAIT_TIME,
          exports.DEFAULT_NUM_RETRIES
        );
        srvRequests.push(req);
      });
      return Promise.all(srvRequests);
    })
    .then(function success(srvInfos) {
      if (exports.DEBUG) {
        console.log('srvInfos: ', srvInfos);
      }
      let aRequests = [];
      for (let srvIter = 0; srvIter < srvInfos.length; srvIter++) {
        // the query methods return an Array of responses, even if only a
        // single response is requested. This allows for for API similarity
        // across calls and for an eventual implementation that permits both
        // A and AAAA records when querying for IP addresses, e.g., but means
        // that we are effectively iterating over an array of arrays. For
        // simplicity, however, we will assume at this stage that we only
        // ever expect a single response, which is correct in the vast
        // majority of cases.
        let srv = srvInfos[srvIter];
        if (srv.length === 0) {
          // If no records resolved (e.g. from a dropped packet or a peer
          // that has dropped out), fail gracefully and log that it occurred.
          console.warn(
            'Did not receive SRV to match PTR, ignoring. PTR: ',
            ptrResponses[srvIter]
          );
        } else {
          // Record that this PTR is active.
          ptrsWithSrvs.push(ptrResponses[srvIter]);
          srv = srv[0];
          srvResponses.push(srv);
          let hostname = srv.domain;
          let req = exports.queryForIpAddress(
            hostname,
            exports.DEFAULT_QUERY_WAIT_TIME,
            exports.DEFAULT_NUM_RETRIES
          );
          aRequests.push(req);
        }
      }
      return Promise.all(aRequests);
    })
    .then(function success(aInfos) {
      if (exports.DEBUG) {
        console.log('aInfos: ', aInfos);
      }

      for (let aIter = 0; aIter < aInfos.length; aIter++) {
        let aInfo = aInfos[aIter];
        if (aInfo.length === 0) {
          // We didn't receive an A. Log that both the 
          console.warn(
            'Did not receive A to match SRV, ignoring. SRV: ',
            srvResponses[aIter]
          );
        } else {
          aInfo = aInfo[0];
          aResponses.push(aInfo);
          ptrsWithAs.push(ptrsWithSrvs[aIter]);
          srvsWithAs.push(srvResponses[aIter]);
        }
      }

      if (
        ptrsWithAs.length !== srvsWithAs.length ||
        srvsWithAs.length !== aResponses.length
      ) {
        throw new Error('Different numbers of PTR, SRV, and A records!');
      }
      
      let result = [];
      for (let i = 0; i < aResponses.length; i++) {
        let ptr = ptrsWithAs[i];
        let instanceName = ptr.serviceName;
        let friendlyName = exports.getUserFriendlyName(ptr.serviceName);
        let srv = srvsWithAs[i];
        let aRec = aResponses[i];
        result.push({
          serviceType: serviceType,
          friendlyName: friendlyName,
          instanceName: instanceName,
          domainName: srv.domain,
          ipAddress: aRec.ipAddress,
          port: srv.port,
        });
      }

      resolve(result);
    })
    .catch(function failed(err) {
      console.log(err);
      reject('Caught error in browsing for service: ' + err);
    });
  });
};

/**
 * Recover the user-friendly instance name from the <instance>.<type>.<domain>
 * representation stored in the DNS records.
 *
 * @param {string} instanceTypeDomain the full string treated as the name of
 * the SRV record, e.g. 'Sam Cache._semcache._tcp.local'.
 *
 * @return {string} the instance name, e.g. 'Sam Cache'
 */
exports.getUserFriendlyName = function(instanceTypeDomain) {
  // We have to allow for any number of legal characters here, including '.'
  // and '_'.
  // It isn't immediately obvious how to do this without accessing the actual
  // underlying DNS labels and counting the number of octets in the first
  // label. It's conceivable that we might add this functionality to the PTR or
  // SRV records themselves. However, I believe that all type strings must
  // include two underscores, and underscores are forbidden in URLs that we
  // might expect as a domain. Thus I think we can use the last two indices of
  // underscores to retrieve the name.
  let idxLastUnderscore = instanceTypeDomain.lastIndexOf('_');
  let idxPenultimateUnderscore = instanceTypeDomain
    .substring(0, idxLastUnderscore)
    .lastIndexOf('_');
  // The penultimate underscore must be preceded by a period, which we don't
  // want to include in the user friendly name.
  let idxEnd = idxPenultimateUnderscore - 1;
  let result = instanceTypeDomain.substring(0, idxEnd);
  return result;
};

/**
 * Issue a query for instances of a particular service type. Tantamout to
 * issueing PTR requests.
 *
 * @param {string} serviceType the service string to query for
 * @param {integer} waitTime the time to wait for responses. As multiple
 * responses can be expected in response to a query for instances of a service
 * (as multiple instances can exist on the same network), the Promise will
 * always resolve after this many milliseconds.
 * @param {integer} numRetries the number of additional queries that should be
 * sent. This can be 0, in which case only the first query will be sent
 *
 * @return {Promise.<Array.<Object>, Error>} Returns a Promise that resolves
 * with a list of objects representing services, like the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   friendlyName: 'Magic Cache',
 *   serviceName: 'Magic Cache._semcache._tcp.local'
 * }
 */
exports.queryForServiceInstances = function(
  serviceType,
  waitTime,
  numRetries
) {
  waitTime = waitTime || exports.DEFAULT_QUERY_WAIT_TIME;
  let rType = dnsCodes.RECORD_TYPES.PTR;
  let rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve, reject) {
    exports.queryForResponses(
      serviceType,
      rType,
      rClass,
      true,
      waitTime,
      numRetries
    )
    .then(function gotPackets(packets) {
      let result = [];
      packets.forEach(packet => {
        packet.answers.forEach(answer => {
          if (answer.recordType === rType && answer.recordClass === rClass) {
            let friendlyName = exports.getUserFriendlyName(
              answer.instanceName
            );
            result.push(
              {
                serviceType: answer.serviceType,
                serviceName: answer.instanceName,
                friendlyName: friendlyName
              }
            );
          }
        });
      });

      // Now de-dupe the results
      result = _.uniqWith(result, _.isEqual);

      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Issue a query for an IP address mapping to a domain.
 *
 * @param {string} domainName the domain name to query for
 * @param {integer} timeout the number of ms after which to time out
 * @param {integer} numRetries the number of additional queries to send after
 * the first if a response is not received.
 *
 * @return {Promise.<Object, Error>} Returns a Promise that resolves with a
 * list of objects representing services, like the following:
 * {
 *   domainName: 'example.local',
 *   ipAddress: '123.4.5.6'
 * }
 */
exports.queryForIpAddress = function(domainName, timeout, numRetries) {
  // Note that this method ignores the fact that you could have multiple IP
  // addresses per domain name. At a minimum, you could have IPv6 and IPv4
  // addresses. For prototyping purposes, a single IP address is sufficient.
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  let rType = dnsCodes.RECORD_TYPES.A;
  let rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve, reject) {
    exports.queryForResponses(
      domainName,
      rType,
      rClass,
      false,
      timeout,
      numRetries
    )
    .then(function gotPackets(packets) {
      let result = [];
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
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Issue a query for information about a service instance name, including the
 * port and domain name on which it is active.
 *
 * @param {string} instanceName the instance name to query for
 * @param {integer} timeout the number of ms after which to time out
 * @param {integer} numRetries the number of additional queries to send after
 * the first if a response is not received.
 *
 * @return {Promise.<Object, Error>} Returns a Promise that resolves with a
 * list of objects representing services, like the following:
 * {
 *   instanceName: 'Sam Cache',
 *   domain: 'example.local',
 *   port: 1234
 * }
 */
exports.queryForInstanceInfo = function(instanceName, timeout, numRetries) {
  timeout = timeout || exports.DEFAULT_QUERY_WAIT_TIME;
  let rType = dnsCodes.RECORD_TYPES.SRV;
  let rClass = dnsCodes.CLASS_CODES.IN;
  return new Promise(function(resolve, reject) {
    exports.queryForResponses(
      instanceName,
      rType,
      rClass,
      false,
      timeout,
      numRetries
    )
    .then(function gotPackets(packets) {
      let result = [];
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
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Issue a query and listen for responses. (As opposed to simply issuing a DNS
 * query without being interested in the responses.)
 * 
 * @param {string} qName the name of the query to issue
 * @param {integer} qType the type of the query to issue
 * @param {integer} qClass the class of the query to issue
 * @param {boolean} multipleResponses true if we can expect multiple or an open
 * ended number of responses to this query
 * @param {integer} timeoutOrWait if multipleExpected is true, this is the
 * amount of time we wait before returning results. If multipleExpected is
 * false (e.g. querying for an A Record, which should have a single answer),
 * this is the amount of time we wait before timing out and resolving with an
 * empty list.
 * @param {integer} numRetries the number of retries to attempt if a query
 * doesn't generate packets.
 *
 * @return {Promise.<Array.<DnsPacket>, Error>} Returns a Promise that resolves
 * with an Array of Packets received in response to the query. If
 * multipleResponses is true, will not resolve until timeoutOrWait
 * milliseconds. If multipleResponses is false, will resolve after the first
 * packet is received or after timeoutOrWait is satifised. 
 */
exports.queryForResponses = function(
  qName,
  qType,
  qClass,
  multipleResponses,
  timeoutOrWait,
  numRetries
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

  // Not immediately obvious where something should reject in this case, so not
  // including a reject parameter yet.
  return new Promise(function(resolve) {
    // Code executes even after a promise resolves, so we will use this flag to
    // make sure we never try to resolve more than once.
    let resolved = false;

    // Track the packets we received while querying.
    let packets = [];
    let callback = function(packet) {
      if (exports.packetIsForQuery(packet, qName, qType, qClass)) {
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

    if (exports.DEBUG) {
      console.log('Calling queryForResponses');
      console.log('  qName: ', qName);
      console.log('  qType: ', qType);
      console.log('  qClass: ', qClass);
    }

    let retriesAttempted = 0;

    let queryAndWait = function() {
      dnsController.query(qName, qType, qClass);
      util.wait(timeoutOrWait)
      .then(() => {
        if (resolved) {
          // Already handled. Do nothing.
          return;
        }
        if (retriesAttempted < numRetries) {
          // We have more retries to attempt. Try again.
          retriesAttempted += 1;
          queryAndWait();
        } else {
          // We've waited and all of our retries are spent. Prepare to resolve.
          dnsController.removeOnReceiveCallback(callback);
          resolved = true;
          resolve(packets);
        }
      })
      .catch(err => {
        console.log('Something went wrong in query: ', err);
      });
    };

    queryAndWait();
  });
};
