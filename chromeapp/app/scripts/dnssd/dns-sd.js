/*jshint esnext:true*/
/*exported DNSSD*/
/*
 * https://github.com/justindarc/dns-sd.js
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Justin D'Arcangelo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

'use strict';

module.exports = window.DNSSD = (function() {

var DNSRecord         = require('./dns-record');
var DNSResourceRecord = require('./dns-resource-record');
var DNSPacket         = require('./dns-packet');
var DNSCodes          = require('./dns-codes');
var DNSUtils          = require('./dns-utils');

var EventTarget       = require('./event-target');
var ByteArray         = require('./byte-array');
var BinaryUtils       = require('./binary-utils');
var IPUtils           = require('./ip-utils');

var chromeUdp         = require('./chromeUdp');

const DNSSD_SERVICE_NAME    = '_services._dns-sd._udp.local';
const DNSSD_MULTICAST_GROUP = '224.0.0.251';
const DNSSD_PORT            = 53531;

const DEBUG = true;

var DNSSD = new EventTarget();

var discovering = false;
var services = {};

DNSSD.getSocket = function() {
  // We have two steps to do here: create a socket and bind that socket to the
  // mDNS port.
  return new Promise((resolve, reject) => {
    var dnssdObj = this;
    if (dnssdObj.socket) {
      // We've already created the socket.
      resolve(dnssdObj.socket);
      return;
    }
    var createPromise = chromeUdp.create({});
    var socketInfo;
    createPromise.then(info => {
      socketInfo = info;
      dnssdObj.socketInfo = info;
      dnssdObj.socketId = info.socketId;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success(result) {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(socketInfo.socketId, DNSSD_MULTICAST_GROUP);
    }, function error(error) {
      console.log('Error when binding DNSSD port: ', error);
      chromeUdp.closeAllSockets();
      reject(error);
    })
    .then(function joinedGroup(result) {
      dnssdObj.socket = new chromeUdp.ChromeUdpSocket(socketInfo);
      resolve(dnssdObj.socket);
    }, function failedToJoinGroup(result) {
      console.log('Error when joining DNSSD group: ', result);
      chromeUdp.closeAllSockets();
      reject(result);
    });

    chrome.sockets.udp.onReceive.addListener(info => {
      if (DEBUG) {
        chromeUdp.logSocketInfo(info);
      }
      if (info.socketId !== this.socketId) {
        // The message wasn't for this socket. Do nothing.
        return;
      }

      var packet = new DNSPacket(new ByteArray(info.data));

      switch (packet.flags.QR) {
        case DNSCodes.QUERY_RESPONSE_CODES.QUERY:
          if (DEBUG) {
            console.log('received DNS query packet');
          }
          handleQueryPacket.call(this, packet, info.data, info);
          break;
        case DNSCodes.QUERY_RESPONSE_CODES.RESPONSE:
          if (DEBUG) {
            console.log('received DNS response packet');
          }
          handleResponsePacket.call(this, packet, info.data);
          break;
        default:
          break;
      }
    });

  });
};

DNSSD.startDiscovery = function() {
  discovering = true;

  // Broadcast query for advertised services.
  discover.call(this);
};

DNSSD.stopDiscovery = function() {
  discovering = false;
};

DNSSD.registerService = function(serviceName, port, options) {
  services[serviceName] = {
    port: port || 0,
    options: options || {}
  };

  // Broadcast advertisement of registered services.
  advertise.call(this);
};

DNSSD.unregisterService = function(serviceName) {
  delete services[serviceName];

  // Broadcast advertisement of registered services.
  advertise.call(this);
};

function handleQueryPacket(packet, message, socketInfo) {
  packet.getRecords('QD').forEach((record) => {
    // Don't respond if the query's class code is not IN or ANY.
    if (record.classCode !== DNSCodes.CLASS_CODES.IN &&
        record.classCode !== DNSCodes.CLASS_CODES.ANY) {
      return;
    }

    // Don't respond if the query's record type is not PTR, SRV or ANY.
    if (record.recordType !== DNSCodes.RECORD_TYPES.PTR &&
        record.recordType !== DNSCodes.RECORD_TYPES.SRV &&
        record.recordType !== DNSCodes.RECORD_TYPES.ANY) {
      return;
    }

    // Broadcast advertisement of registered services.
    advertise.call(this);

    // Unicast as well. Unicast can be requested, but this doesn't seem to
    // check for that, and we can't expect all clients to bind to 53531, since
    // we know Chrome doesn't support SO_REUSEADDRESS via a JavaScript API. We
    // are keeping the advertise() call to try and remain compliant with other
    // mDNS implementations that simply switch to 53531 from 5353. However, to
    // actually communicate, we need to fire back with a unicast query.
    unicastAdvertise.call(
      this,
      socketInfo.remoteAddress,
      socketInfo.remotePort
    );
  });
}

function handleResponsePacket(packet, message) {
  if (!discovering) {
    return;
  }

  var services = [];
  packet.getRecords('AN').forEach((record) => {
    if (record.recordType === DNSCodes.RECORD_TYPES.PTR) {
      services.push(record.data);
    }
  });

  this.dispatchEvent('discovered', {
    message: message,
    packet: packet,
    address: message.remoteAddress,
    services: services
  });
}

function discover() {
  var packet = new DNSPacket();

  packet.flags.QR = DNSCodes.QUERY_RESPONSE_CODES.QUERY;

  var question = new DNSRecord({
    name: DNSSD_SERVICE_NAME,
    recordType: DNSCodes.RECORD_TYPES.PTR
  });

  packet.addRecord('QD', question);

  this.getSocket().then((socket) => {
    var data = packet.serialize();
    socket.send(data, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
  });
}

/**
 * Send a DNS response to a specific address and port, essentially unicasting.
 */
function unicastAdvertise(address, port) {
  sendServiceHelper.call(this, address, port);
}

function sendServiceHelper(address, port) {
  if (Object.keys(services).length === 0) {
    return;
  }

  var packet = new DNSPacket();

  packet.flags.QR = DNSCodes.QUERY_RESPONSE_CODES.RESPONSE;
  packet.flags.AA = DNSCodes.AUTHORITATIVE_ANSWER_CODES.YES;

  for (var serviceName in services) {
    addServiceToPacket(serviceName, packet);
  }

  this.getSocket().then((socket) => {
    var data = packet.serialize();
    if (DEBUG) {
      console.log('Sending packet');
      console.log(packet);
    }
    socket.send(data, address, port);

    // Re-broadcast announcement after 1000ms (RFC6762, 8.3).
    // setTimeout(() => {
    //   socket.send(data, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
    // }, 1000);
  });
}

function advertise() {
  sendServiceHelper.call(this, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
}

function addServiceToPacket(serviceName, packet) {
  var service = services[serviceName];
  if (!service) {
    return;
  }

  var alias = serviceName;

  // SRV Record
  // var srvData = new ByteArray();
  // srvData.push(0x0000, 2);        // Priority
  // srvData.push(0x0000, 2);        // Weight
  // srvData.push(service.port, 2);  // Port
  // srvData.append(DNSUtils.labelToByteArray(serviceName));

  // var srv = new DNSResourceRecord({
  //   name: alias,
  //   recordType: DNSCodes.RECORD_TYPES.SR,
  //   data: srvData
  // });

  // packet.addRecord('AR', srv);

  // TXT Record
  // var txtData = new ByteArray();

  // for (var key in service.options) {
  //   txtData.append(DNSUtils.labelToByteArray(key + '=' + service.options[key]));
  // }
  
  // var txt = new DNSResourceRecord({
  //   name: alias,
  //   recordType: DNSCodes.RECORD_TYPES.TXT,
  //   data: txtData
  // });

  // packet.addRecord('AR', txt);

  // PTR Wildcard Record
  var ptrWildcard = new DNSResourceRecord({
    name: DNSSD_SERVICE_NAME,
    recordType: DNSCodes.RECORD_TYPES.PTR,
    data: serviceName
  });

  packet.addRecord('AN', ptrWildcard);

  // PTR Service Record
  var ptrService = new DNSResourceRecord({
    name: serviceName,
    recordType: DNSCodes.RECORD_TYPES.PTR,
    data: alias
  });

  packet.addRecord('AN', ptrService);
}

return DNSSD;

})();
