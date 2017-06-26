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
 * @return {HttpPeerAccessor|WebrtcPeerAccessor}
 */
exports.getPeerAccessor = function(ipaddr, port) {
  let transportMethod = settings.getTransportMethod();
  console.log(transportMethod);
  if (transportMethod === 'http') {
    return new ifHttp.HttpPeerAccessor(); 
  } else if (transportMethod === 'webrtc') {
    return new ifWebrtc.WebrtcPeerAccessor({ ipaddr, port });
  } else {
    throw new Error('Unrecognized transport method: ' + transportMethod);
  }
};
