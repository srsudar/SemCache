'use strict';

var settings = require('../settings');
var ifHttp = require('./http-impl');
var ifWebrtc = require('./webrtc-impl');

/**
 * Manages peer interfaces for the application.
 */

/**
 * Create a PeerAccessor based on the configured settings.
 *
 * @return {HttpPeerAccessor|WebrtcPeerAccessor}
 */
exports.getPeerAccessor = function() {
  var transportMethod = settings.getTransportMethod();
  console.log(transportMethod);
  if (transportMethod === 'http') {
    return new ifHttp.HttpPeerAccessor(); 
  } else if (transportMethod === 'webrtc') {
    return new ifWebrtc.WebrtcPeerAccessor();
  } else {
    throw new Error('Unrecognized transport method: ' + transportMethod);
  }
};
