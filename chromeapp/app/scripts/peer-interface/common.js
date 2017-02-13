'use strict';

/**
 * Code shared across the peer-interface implementations.
 */

exports.createListParams = function(ipaddr, port, listUrl) {
  return {
    ipAddress: ipaddr,
    port: port,
    listUrl: listUrl
  };
};

exports.createFileParams = function(ipaddr, port, fileUrl) {
  return {
    ipAddress: ipaddr,
    port: port,
    fileUrl: fileUrl
  };
};
