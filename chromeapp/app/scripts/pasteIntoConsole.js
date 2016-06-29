'use strict';

// From:
// https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String?hl=en
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}
function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

var socketId;
var port = 33334;
var arrayBuffer = str2ab('Hello from js code');
var mdnsPort = 5353;

// Handle the onReceive event
var onReceive = function(info) {
  if (info.socketId !== socketId) {
    return;
  }
  console.log('onReceive called. Logging data.');
  console.log(info.data);
  console.log('string from data: ', ab2str(info.data));
};

// Create the socket
chrome.sockets.udp.create({}, function(socketInfo) {
  socketId = socketInfo.socketId;
  // Setup event handler and bind socket.
  chrome.sockets.udp.onReceive.addListener(onReceive);
  chrome.sockets.udp.bind(socketId,
    '0.0.0.0', port, function(result) {
      if (result < 0) {
        console.log('Error binding socket');
        return;
      }
      chrome.sockets.udp.send(socketId, arrayBuffer,
        '127.0.0.1', port, function(sendInfo) {
          console.log('sent ' + sendInfo.bytesSent);
        }
      );
    }
  );
});

chrome.sockets.udp.create({}, function(socketInfo) {
  socketId = socketInfo.socketId;
  // Setup event handler and bind socket.
  chrome.sockets.udp.onReceive.addListener(onReceive);
  chrome.sockets.udp.bind(socketId,
    '224.0.0.251', mdnsPort, function(result) {
      if (result < 0) {
        console.log('Error binding socket');
        return;
      }
      chrome.sockets.udp.send(socketId, arrayBuffer,
        '127.0.0.1', port, function(sendInfo) {
          console.log('sent ' + sendInfo.bytesSent);
        }
      );
    }
  );
});
