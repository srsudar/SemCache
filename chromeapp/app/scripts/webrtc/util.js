/* globals RTCPeerConnection, RTCSessionDescription, RTCIceCandidate */
'use strict';

var util = require('../util');
var settings = require('../settings');
var binUtil = require('../dnssd/binary-utils').BinaryUtils;
var serverApi = require('../server/server-api');
var cxnMgr = require('./connection-manager');

var pc;
var localDesc;
var requestChannel;
var iceCandidates;

exports.optionalCreateArgs = { };

exports.getConnection = function() {
  return pc;
};

exports.getRequestChannel = function() {
  return requestChannel;
};

/**
 * This is taken largely from:
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/datachannel/filetransfer/js/main.js
 */

exports.createConnection = function() {
  iceCandidates = [];
  pc = new RTCPeerConnection(null, exports.optionalCreateArgs); 

  requestChannel = pc.createDataChannel('requestChannel');
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
    exports.sendOffer();
  } else {
    console.log('got ice candidate: ', e);
    iceCandidates.push(e.candidate);
  }
};

exports.sendOffer = function() {
  // Now we set up a request.
  var port = settings.getServerPort();
  var addr = '127.0.0.1';
  var fullAddr = 'http://' +
    addr +
    ':' +
    port +
    '/' +
    serverApi.getApiEndpoints().receiveWrtcOffer;

  var bodyJson = {
    description: localDesc,
    iceCandidates: iceCandidates
  };

  util.fetch(
    fullAddr,
    {
      method: 'PUT',
      body: binUtil.stringToArrayBuffer(JSON.stringify(bodyJson))
    }
  )
  .then(resp => {
    console.log('got response from fetch, window.putResp: ' + resp);
    window.putResp = resp;
    return resp.json();
  })
  .then(json => {
    console.log('retrieved json: ' + json);
    var calleeDesc = new RTCSessionDescription(json.description);
    pc.setRemoteDescription(calleeDesc);

    json.iceCandidates.forEach(candidateStr => {
      var candidate = new RTCIceCandidate(candidateStr);
      pc.addIceCandidate(candidate);
    });

    pc.ondatachannel = exports.channelCallback;
    cxnMgr.local = pc;
  });
};

exports.gotDescription = function(desc) {
  util.trace('Got description: ' + desc.toString());
  localDesc = desc;
  pc.setLocalDescription(desc);  
};

exports.channelCallback = function(event) {
  util.trace('Channel Callback');
  var channel = event.channel;
  channel.binaryType = 'arraybuffer';
  channel.onmessage = exports.onReceiveMessageCallback;
};

exports.onReceiveMessageCallback = function(event) {
  var dataBin = event.data;
  var dataJson = binUtil.arrayBufferToString(dataBin);
  console.log('received message: ', dataJson);
};
