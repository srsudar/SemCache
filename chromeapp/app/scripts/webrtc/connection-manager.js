/* globals RTCPeerConnection, RTCSessionDescription */
'use strict';

/**
 * Manages connections to peers.
 */

exports.remote = null;
exports.local = null;

/**
 * Add a connection to the known pool of connection.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 * @param {PeerConnection} cxn the connection being added
 */
exports.addConnection = function(ipaddr, port, cxn) {
  // TODO: implement
};

/**
 * Retrieve a connection from the pool.
 *
 * @return {PeerConnection|null} the connection if it exists, else null
 */
exports.getConnection = function(ipaddr, port) {
  // TODO: implement
};

/**
 * Create a connection to the given peer, adding it to make it known to the
 * manager.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 *
 * @return {Promise} Promise that resolves with the PeerConnection when it is
 * created
 */
exports.createConnection = function(ipaddr, port) {
  // TODO: implement
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
  // TODO: implement
};

/**
 * Remove the connection from the known pool.
 *
 * @param {String} ipaddr the IP address of the peer this connects to
 * @param {number} port the port of the instance advertised via mDNS where this
 * connection is connected
 */
exports.removeConnection = function(ipaddr, port) {
  // TODO: implement
};
