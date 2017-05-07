/* globals chrome */
'use strict';

var util = require('./util');

var DEBUG = false;

/**
 * @constructor
 */
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
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} address
 * @param {integer} port
 *
 * @return {Promise.<any, Error>}
 */
exports.ChromeUdpSocket.prototype.send = function(arrayBuffer, address, port) {
  return exports.send(this.socketId, arrayBuffer, address, port);
};

/**
 * Add listener via call to util.getUdp().onReceive.addListener.
 *
 * @param {function} listener
 */
exports.addOnReceiveListener = function(listener) {
  util.getUdp().onReceive.addListener(listener);
};

/**
 * Add listener via call to util.getUdp().onReceiveError.addListener.
 *
 * @param {function} listener
 */
exports.addOnReceiveErrorListener = function(listener) {
  util.getUdp().onReceiveError.addListener(listener);
};

/**
 * @param {SocketProperties} properties optional
 *
 * @return {Promise.<object, Error>} Promise that resolves with a socket info
 * object or rejects with an Error
 */
exports.create = function(obj) {
  return new Promise(function(resolve, reject) {
    util.getUdp().create(obj, function(socketInfo) {
      if (util.wasError()) {
        reject(util.getError());
      } else {
        resolve(socketInfo);
      }
    });
  });
};

/**
 * @param {integer} socketId
 * @param {string} address
 * @param {integer} port
 *
 * @return {Promise.<integer, Error>}
 */
exports.bind = function(socketId, address, port) {
  return new Promise(function(resolve, reject) {
    util.getUdp().bind(socketId, address, port, function(result) {
      if (result < 0) {
        var lastError = chrome.runtime.lastError;
        var logInfo = {
          socketId: socketId,
          address: address,
          port: port,
          lastError: lastError
        };
        console.error('chromeUdp.bind: result < 0, rejecting ', logInfo);
        reject(new Error('Error during bind: ' + lastError.message));
      } else {
        resolve(result);
      }
    });
  });
};

/**
 * @param {integer} socketId
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} address
 * @param {integer} port
 *
 * @return {Promise.<integer, Error>}
 */
exports.send = function(socketId, arrayBuffer, address, port) {
  if (!socketId || !arrayBuffer || !address || !port) {
    console.warn(
      'send received bad arg: ', socketId, arrayBuffer, address, port
    );
  }
  return new Promise(function(resolve, reject) {
    if (DEBUG) {
      console.log('chromeUdp.send');
      console.log('    socketId: ', socketId);
      console.log('    address: ', address);
      console.log('    port: ', port);
      console.log('    arrayBuffer: ', arrayBuffer);
    }
    util.getUdp().send(
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

/**
 * @param {integer} socketId
 * @param {string} address
 *
 * @return {Promise.<integer, Error>}
 */
exports.joinGroup = function(socketId, address) {
  return new Promise(function(resolve, reject) {
    util.getUdp().joinGroup(socketId, address, function(result) {
      if (DEBUG) {
        console.log('socketId: ', socketId);
        console.log('address: ', address);
      }
      if (result < 0) {
        var lastError = chrome.runtime.lastError || {};
        console.log('chromeUdp.joinGroup: result < 0: ', result);
        reject(new Error('Error joining group: ' + lastError.message));
      } else {
        resolve(result);
      }
    });
  });
};

/**
 * @param {Promise.<Array.<SocketInfo>, Error>}
 */
exports.getSockets = function() {
  return new Promise(function(resolve) {
    util.getUdp().getSockets(function(allSockets) {
      resolve(allSockets);
    });
  });
};

/**
 * @param {integer} socketId
 *
 * @return {Promise.<SocketInfo, Error>}
 */
exports.getInfo = function(socketId) {
  return new Promise(function(resolve) {
    util.getUdp().getInfo(socketId, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.closeAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log('Closing socket with id: ', socketInfo.socketId);
      util.getUdp().close(socketInfo.socketId);
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
 *
 * @return {Promise.<Array.<Object>, Error>}
 */
exports.getNetworkInterfaces = function() {
  return new Promise(function(resolve) {
    chrome.system.network.getNetworkInterfaces(function(interfaces) {
      resolve(interfaces);
    });
  });
};
