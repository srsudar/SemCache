'use strict';

const webrtcClient = require('./webrtc-client');


/**
 * Manages clients for the application. Speaks to the server module.
 */

/**
 * Create a PeerAccessor.
 *
 * @param {string} ipAddress
 * @param {number} port
 *
 * @return {WebrtcPeerAccessor}
 */
exports.getClient = function(ipAddress, port) {
  return new webrtcClient.WebrtcClient({ ipAddress, port });
};
