'use strict';

const EventEmitter = require('wolfy87-eventemitter');

const bufferedChannel = require('./buffered-channel');
const message = require('./message');
const serverApi = require('../server/server-api');
const util = require('../util');


const EV_CLOSE = 'close';

const Client = bufferedChannel.BufferedChannelClient;

exports.DEFAULT_TIMEOUT = 20000;

/**
 * Handles a connection to a SemCache peer. This forms the client portion of a
 * client/server pair.
 */

/**
 * PeerConnection is a wrapper around the raw WebRTC machinery to provide a
 * SemCache-specific API.
 *
 * @constructor
 * 
 * @param {RTCPeerConnection} rawConnection the raw RTCPeerConnection that will
 * be backing this connection. This rawConnection has its onclose handler
 * modified to allow the PeerConnection to emit its own 'close' event.
 */
class PeerConnection extends EventEmitter {
  constructor(rawConnection) {
    super();
    this.rawConnection = rawConnection;

    let self = this;

    // MDN says there should be an 'onconnectionstatechange' event. However
    // that doesn't seem to be implemented in Chrome. Instead, the wisdom of
    // the internet says to use oniceconnectionstatechange and monitor
    // iceConnectionState. 'closed' indicates that the peer itself has shut
    // down.
    this.rawConnection.oniceconnectionstatechange = function() {
      switch (self.rawConnection.iceConnectionState) {
        case 'closed':
          // Emit an event indicating that we are closed.
          self.emitClose();
          break;
      }
    };
  }

  /**
   * Emit a close event.
   */
  emitClose() {
    this.emit(EV_CLOSE);
  }

  /**
   * Return the raw WebRTC connection backing this PeerConnection.
   *
   * @return {RTCPeerConnection} 
   */
  getRawConnection() {
    return this.rawConnection;
  }

  /**
   * Get the list of available files from the peer.
   *
   * @param {number} offset
   * @param {number} limit
   *
   * @return {Promise.<Object, Error>} Promise that resolves with the JSON list
   * of the directory contents
   */
  getList(offset, limit) {
    let self = this;
    return new Promise(function(resolve, reject) {
      let msg = message.createListMessage(offset, limit);

      self.sendAndGetResponse(msg)
      .then(buff => {
        let result = serverApi.parseResponseForList(buff);
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Get the digest of page information from the peer.
   *
   * @return {Promise.<Object, Error>} Promise that resolves with the JSON object
   * representing the digest or rejects with an Error.
   */
  getCacheDigest() {
    let self = this;
    return new Promise(function(resolve, reject) {
      let msg = message.createDigestMessage();

      self.sendAndGetResponse(msg)
      .then(buff => {
        let result = serverApi.parseResponseForDigest(buff);
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Get the BloomFilter representing cache contents from the peer.
   *
   * @return {Promise.<BloomFilter, Error>}
   */
  getCacheBloomFilter() {
    let self = this;
    return new Promise(function(resolve, reject) {
      let msg = message.createBloomFilterMessage();

      self.sendAndGetResponse(msg)
      .then(buff => {
        let result = serverApi.parseResponseForBloomFilter(buff);
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Get a cached page from the peer.
   *
   * @param {string} href
   *
   * @return {Promise.<CPDisk, Error>}
   */
  getCachedPage(href) {
    let self = this;
    return new Promise(function(resolve, reject) {
      let msg = message.createCachedPageMessage(href);

      self.sendAndGetResponse(msg)
      .then(buff => {
        let result = serverApi.parseResponseForCachedPage(buff);
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Helper for common functionality of creating a channel, sending a request
   * message, and resolving after a response is received.
   *
   * After the response is received, the channel that was used to send the
   * message will be closed. The response is resolved after the first message is
   * received.
   *
   * @param {Object} msg the message to send to the peer
   * @param {number} timeout the timeout, in milliseconds, to wait for the send
   * to complete
   * 
   * @return {Promise.<ArrayBuffer, Error>} Promise that resolves with the
   * ArrayBuffer message received on the channel or with an Error if something
   * went wrong. Callers are responsible for any parsing of the ArrayBuffer
   * object, eg to reclaim a JSON response.
   */
  sendAndGetResponse(msg, timeout) {
    timeout = timeout || exports.DEFAULT_TIMEOUT;
    let self = this;
    return new Promise(function(resolve, reject) {
      let settled = false;
      Promise.resolve()
      .then(() => {
        let client = exports.createClient(self.rawConnection, msg);

        client.on('complete', buff => {
          if (!settled) {
            settled = true;
            resolve(buff);
          }
        });

        client.on('error', err => {
          self.emitClose(err);
          if (!settled) {
            settled = true;
            reject(err);
          }
        });

        client.start();

        util.setTimeout(
          function() {
            let err = new Error('timed out waiting for channel');
            self.emitClose(err);
            if (!settled) {
              settled = true;
              reject(err);
            }
          },
          timeout
        );
      })
      .catch(err => {
        self.emitClose(err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }
}

/**
 * @param {RTCPeerConnection} pc
 * @param {Object} msg
 *
 * @return {BufferedChannelClient}
 */
exports.createClient = function(pc, msg) {
  return new Client(pc, true, msg);
};

exports.PeerConnection = PeerConnection;
