/* globals Promise, chrome */
'use strict';

var DEBUG = true;

exports.ChromeUdpSocket = function ChromeUdpSocket(socketInfo) {
  if (!(this instanceof ChromeUdpSocket)) {
    throw new Error('ChromeUdpSocket must be called with new');
  }
  this.socketInfo = socketInfo;
  this.socketId = socketInfo.socketId;
};

/**
 * Send data over the port and return a promise with the sendInfo result.
 * Behaves as a thin wrapper around chromeUdp.send.
 */
exports.ChromeUdpSocket.prototype.send = function(arrayBuffer, address, port) {
  return exports.send(this.socketId, arrayBuffer, address, port);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceive.addListener.
 */
exports.addOnReceiveListener = function(listener) {
  chrome.sockets.udp.onReceive.addListener(listener);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceiveError.addListener.
 */
exports.addOnReceiveErrorListener = function(listener) {
  chrome.sockets.udp.onReceiveError.addListener(listener);
};

exports.create = function(obj) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.create(obj, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.bind = function(socketId, address, port) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.bind(socketId, address, port, function(result) {
      if (result < 0) {
        console.log('chromeUdp.bind: result < 0, rejecting');
        console.log('    socketId: ', socketId);
        console.log('    address: ', address);
        console.log('    port: ', port);
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.send = function(socketId, arrayBuffer, address, port) {
  return new Promise(function(resolve, reject) {
    if (DEBUG) {
      console.log('chromeUdp.send');
      console.log('    socketId: ', socketId);
      console.log('    address: ', address);
      console.log('    port: ', port);
      console.log('    arrayBuffer: ', arrayBuffer);
    }
    chrome.sockets.udp.send(
      socketId,
      arrayBuffer,
      address,
      port,
      function(sendInfo) {
        if (sendInfo.resultCode < 0) {
          console.log('chromeUdp.send: result < 0, rejecting');
          reject(sendInfo);
        } else {
          resolve(sendInfo);
        }
      }
    );
  });
};

exports.joinGroup = function(socketId, address) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.joinGroup(socketId, address, function(result) {
      console.log('socketId: ', socketId);
      console.log('address: ', address);
      if (result < 0) {
        console.log('chromeUdp.joinGroup: result < 0, reject');
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.getSockets = function() {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getSockets(function(allSockets) {
      resolve(allSockets);
    });
  });
};

exports.getInfo = function(socketId) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getInfo(socketId, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.closeAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log('Closing socket with id: ', socketInfo.socketId);
      chrome.sockets.udp.close(socketInfo.socketId);
    });
  });
};

exports.listAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log(socketInfo);
    });
  });
};

exports.logSocketInfo = function(info) {
  console.log('Received data via UDP on ', new Date());
  console.log('    socketId: ', info.socketId);
  console.log('    remoteAddress: ', info.remoteAddress);
  console.log('    remotePort: ', info.remotePort);
  console.log('    data: ', info.data);
  console.log('    info: ', info);
};

/**
 * Returns a Promise that resolves with a list of network interfaces.
 */
exports.getNetworkInterfaces = function() {
  return new Promise(function(resolve) {
    chrome.system.network.getNetworkInterfaces(function(interfaces) {
      resolve(interfaces);
    });
  });
};
