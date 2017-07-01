'use strict';

const ifHttp = require('./http-impl');
const ifWebrtc = require('./webrtc-impl');
const settings = require('../settings');


/**
 * Manages peer interfaces for the application.
 */

/**
 * Create a PeerAccessor based on the configured settings.
 *
 * @param {string} ipAddress
 * @param {number} port
 *
 * @return {HttpPeerAccessor|WebrtcPeerAccessor}
 */
exports.getPeerAccessor = function(ipAddress, port) {
  let transportMethod = settings.getTransportMethod();
  console.log(transportMethod);
  if (transportMethod === 'http') {
    return new ifHttp.HttpPeerAccessor({ ipAddress, port }); 
  } else if (transportMethod === 'webrtc') {
    return new ifWebrtc.WebrtcPeerAccessor({ ipAddress, port });
  } else {
    throw new Error('Unrecognized transport method: ' + transportMethod);
  }
};
