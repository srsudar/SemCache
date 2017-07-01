'use strict';


/**
 * Base class to be extended by peer interface implementations.
 */
class PeerAccessor {
  /**
   * @param {string} ipAddress
   * @param {number} port
   */
  constructor({ ipAddress, port } = {}) {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  getIpAddress() {
    return this.ipAddress;
  }

  getPort() {
    return this.port;
  }
}

exports.PeerAccessor = PeerAccessor;
