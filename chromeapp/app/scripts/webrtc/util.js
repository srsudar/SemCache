/* globals RTCPeerConnection */
'use strict';

var util = require('../util');

var pc;
var localDesc;

exports.getConnection = function() {
  return pc;
};

/**
 * This is taken largely from:
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/datachannel/filetransfer/js/main.js
 */

exports.createConnection = function() {
  pc = new RTCPeerConnection(null, null); 

  var requestChannel = pc.createDataChannel('requestChannel');
  requestChannel.binaryType = 'arraybuffer';

  requestChannel.onopen = exports.onChannelStateChange;
  requestChannel.onclose = exports.onChannelStateChange;

  pc.onicecandidate = function(e) {
    exports.onIceCandidate(pc, e);
  };

  pc.createOffer().then(
    exports.gotDescription,
    exports.onCreateDescriptionError
  );
};

exports.onCreateDescriptionError = function(err) {
  util.trace('Failed to create session description: ' + err.toString());
};

exports.onChannelStateChange = function(e) {
  util.trace(e);
};

exports.onIceCandidate = function(pc, e) {
  if (e.candidate === null) {
    // supposedly all candidates complete
    util.trace('done with candidates');
    util.trace('desc after ICE candidate: ' + pc);

  }
};

exports.gotDescription = function(desc) {
  util.trace('Got description: ' + desc.toString());
  localDesc = desc;
  pc.setLocalDescription(desc);  
};
