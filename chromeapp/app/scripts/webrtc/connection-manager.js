/* globals RTCPeerConnection, RTCSessionDescription, RTCIceCandidate */
'use strict';

var Buffer = require('buffer').Buffer;

var util = require('../util');
var peerConn = require('../../../app/scripts/webrtc/peer-connection');
var serverApi = require('../server/server-api');

var globalPc;

exports.DEBUG = true;

/**
 * Manages connections to peers.
 */

var CONNECTIONS = {};

exports.remote = null;
exports.local = null;

/**
 * Creates the cache key for the given ipaddr/port combination.
 *
 * @param {String} ipaddr the IP address of the machine
 * @param {String|Number} port the port of the instance
 *
 * @return {String} a String to be used as a key into the cache
 */
function createKey(ipaddr, port) {
  if (!ipaddr || !port) {
    throw new Error('ipaddr and port must be set: ', ipaddr, port);
  }
  return ipaddr + ':' + port;
}

/**
 * Add a connection to the known pool of connection.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 * @param {PeerConnection} cxn the connection being added
 */
exports.addConnection = function(ipaddr, port, cxn) {
  var key = createKey(ipaddr, port);
  CONNECTIONS[key] = cxn;
};

/**
 * Retrieve a connection from the pool.
 *
 * @return {PeerConnection|null} the connection if it exists, else null
 */
exports.getConnection = function(ipaddr, port) {
  var key = createKey(ipaddr, port);
  var cxn = CONNECTIONS[key];
  if (!cxn) {
    return null;
  }
  return cxn;
};

/**
 * Remove the connection from the known pool.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 */
exports.removeConnection = function(ipaddr, port) {
  var key = createKey(ipaddr, port);
  delete CONNECTIONS[key];
};

/**
 * Create a connection to the given peer, adding it to make it known to the
 * manager.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 *
 * @return {Promise.<PeerConnection, Error>} Promise that resolves with the
 * PeerConnection when it is created
 */
exports.createConnection = function(ipaddr, port) {
  var wrtcEndpoint = exports.getPathForWebrtcNegotiation(ipaddr, port);
  return new Promise(function(resolve, reject) {
    var pc = exports.createRTCPeerConnection(null, null);
    globalPc = pc;

    // Start a channel to kick off ICE candidates. Without this or otherwise
    // requesting media stream the ICE gathering process does not begin.
    pc.createDataChannel('requestChannel');

    var iceCandidates = [];
    var description = null;
    var iceComplete = false;

    pc.onicecandidate = function(e) {
      if (e.candidate === null) {
        // All candidates are complete.
        iceComplete = true;
        if (exports.DEBUG) { console.log('done with ICE candidates'); }
        exports.sendOffer(
          wrtcEndpoint, pc, description, iceCandidates, ipaddr, port
        ).then(establishedConnection => {
          resolve(establishedConnection);
        })
        .catch(err => {
          reject(err);
        });
      } else {
        iceCandidates.push(e.candidate);
      }
    };

    pc.createOffer()
    .then(desc => {
      description = desc;
      return pc.setLocalDescription(desc);
    })
    .catch(err => {
      reject(err);
    });
  });
};

exports.onIceCandidate = function(e) {
  console.log('got ice candidate at module level: ', e);
};

/**
 * @param {String} wrtcEndpoint
 * @param {RTCPeerDescription} rawConnection
 * @param {RTCSessionDescription} desc
 * @param {Array.<RTCIceCandidate>} iceCandidates
 *
 * @return {Promise.<PeerConnection>}
 */
exports.sendOffer = function(
    wrtcEndpoint, rawConnection, desc, iceCandidates, ipaddr, port
) {
  return new Promise(function(resolve, reject) {
    var bodyJson = {};
    bodyJson.description = desc;
    bodyJson.iceCandidates = iceCandidates;

    util.fetch(
      wrtcEndpoint,
      {
        method: 'PUT',
        body: Buffer.from(JSON.stringify(bodyJson))
      }
    )
    .then(resp => {
      return resp.json();
    })
    .then(json => {
      var peerDesc = exports.createRTCSessionDescription(json.description);
      rawConnection.setRemoteDescription(peerDesc);

      json.iceCandidates.forEach(candidateJson => {
        var candidate = exports.createRTCIceCandidate(candidateJson);
        rawConnection.addIceCandidate(candidate);
      });

      var cxn = exports.createPeerConnection(rawConnection);
      exports.addConnection(ipaddr, port, cxn);
      resolve(cxn);
    })
    .catch(err => {
      reject(err);
    });
  });
};

exports.getPathForWebrtcNegotiation = function(addr, port) {
  return 'http://' +
    addr +
    ':' +
    port +
    '/' +
    serverApi.getApiEndpoints().receiveWrtcOffer;
};

/**
 * Create a PeerConnection object. Thin wrapper around the constructor to
 * facilitate testing.
 *
 * @param {RTCPeerConnection} rawConnection
 *
 * @return {PeerConnection}
 */
exports.createPeerConnection = function(rawConnection) {
  return new peerConn.PeerConnection(rawConnection);
};

/**
 * Get the connection if it exists, else create a new connection. This is a
 * convenience method to spare callers checking the cache and should be
 * preferred.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 * 
 * @return {Promise} Promise that resolves with the PeerConnection.
 */
exports.getOrCreateConnection = function(ipaddr, port) {
  var key = createKey(ipaddr, port);
  return new Promise(function(resolve, reject) {
    if (CONNECTIONS[key]) {
      resolve(exports.getConnection(ipaddr, port));
    }
    
    // Otherwise, we need to create the connection.
    exports.createConnection(ipaddr, port)
    .then(cxn => {
      CONNECTIONS[key] = cxn;
      resolve(cxn);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Create an RTCPeerConnection. Thin wrapper around the RTCPeerConnection
 * constructor.
 *
 * Exposed for testing.
 *
 * @param {JSON} servers
 * @param {JSON} constraings
 *
 * @return {RTCPeerConnection}
 */
exports.createRTCPeerConnection = function(servers, constraints) {
  return new RTCPeerConnection(servers, constraints);
};

/**
 * Create an RTCIceCandidate. Thin wrapper around the RTCIceCandidate
 * constructor to facilitate testing.
 *
 * @param {JSON} candidateJson the JSON object representing an ICE candidate
 * that has come across the wire
 *
 * @return {RTCIceCandidate}
 */
exports.createRTCIceCandidate = function(candidateJson) {
  return new RTCIceCandidate(candidateJson);
};

/**
 * Create an RTCSessionDescription from a stringified JSON description. Thing
 * wrapper around the RTCSessionDescription constructor.
 *
 * Exposed for testing.
 *
 * @param {JSON} descJson JSON representation of an RTCSessionDescription
 *
 * @return {RTCSessionDescription}
 */
exports.createRTCSessionDescription = function(descJson) {
  return new RTCSessionDescription(descJson);
};
