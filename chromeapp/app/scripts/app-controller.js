'use strict';

/**
 * The main controlling piece of the app. It composes the other modules.
 */

var chromeUdp = require('./chrome-apis/udp');
var datastore = require('./persistence/datastore');
var extBridge = require('./extension-bridge/messaging');
var fileSystem = require('./persistence/file-system');

var LISTENING_HTTP_INTERFACE = null;

/**
 * This port is hard-coded for now, as the web server requires that we pass a
 * port. This will be amended and should be dynamically allocated.
 */
var HTTP_PORT = 9876;

var ABS_PATH_TO_BASE_DIR = null;

/**
 * Get the interface on which the app is listening for incoming http
 * connections.
 *
 * @return {object} an object of the form:
 * {
 *   name: string,
 *   address: string,
 *   prefixLength: integer,
 *   port: integer
 * }
 */
exports.getListeningHttpInterface = function() {
  if (!LISTENING_HTTP_INTERFACE) {
    console.warn('listening http interface not set, is app started?');
  }
  return LISTENING_HTTP_INTERFACE;
};

/**
 * Set the absolute path to the base directory where SemCache is mounted on
 * the file system.
 *
 * This is necessary because, unbelievably, Chrome Apps don't provide a way to
 * access the absolute path of a file. This means that in the prototype users
 * will have to manually type the full path to the directory they choose.
 * Unfortunate.
 *
 * @param {string} absPath the absolute path to the base directory of the file
 * system where SemCache is mounted
 */
exports.setAbsPathToBaseDir = function(absPath) {
  ABS_PATH_TO_BASE_DIR = absPath;
};

/**
 * Start the app.
 *
 * @return {Promise} Promise that resolves when the app is started
 */
exports.start = function(absPath) {
  if (!absPath) {
    console.warn('not starting, must start with absolute path to dir');
    return;
  }
  exports.setAbsPathToBaseDir(absPath);
  return new Promise(function(resolve) {
    chromeUdp.getNetworkInterfaces()
      .then(interfaces => {
        var ipv4Interfaces = [];
        interfaces.forEach(iface => {
          if (iface.address.indexOf(':') === -1) {
            // ipv4
            ipv4Interfaces.push(iface);
          }
        });
        if (ipv4Interfaces.length === 0) {
          console.log('Could not find ipv4 interface: ', interfaces);
        } else {
          var iface = ipv4Interfaces[0];
          iface.port = HTTP_PORT;
          LISTENING_HTTP_INTERFACE = iface;
        }
        resolve();
      });
  });
};

/**
 * A thin wrapper around fetch to allow mocking during tests. Expose parameters
 * are needed.
 */
exports.fetch = function(url) {
  return fetch(url);
};

/**
 * Return the absolute path to the base directory where SemCache is mounted on
 * the file system.
 *
 * This is necessary because, unbelievably, Chrome Apps don't provide a way to
 * access the absolute path of a file. This means that in the prototype users
 * will have to manually type the full path to the directory they choose.
 * Unfortunate.
 *
 * @return {string} absolute path to the base directory, without a trailing
 * slash
 */
exports.getAbsPathToBaseDir = function() {
  return ABS_PATH_TO_BASE_DIR;
};

/**
 * Save the MHTML file at mhtmlUrl into the local cache and open the URL.
 *
 * @param {captureUrl} captureUrl
 * @param {captureDate} captureDate
 * @param {string} mhtmlUrl the url of the mhtml file to save and open
 *
 * @return {Promise} a Promise that resolves after open has been called.
 */
exports.saveMhtmlAndOpen = function(captureUrl, captureDate, mhtmlUrl) {
  return new Promise(function(resolve) {
    exports.fetch(mhtmlUrl)
      .then(response => {
        return response.blob();
      })
      .then(mhtmlBlob => {
        return datastore.addPageToCache(captureUrl, captureDate, mhtmlBlob);
      })
      .then((entry) => {
        var fileUrl = fileSystem.constructFileSchemeUrl(
          exports.getAbsPathToBaseDir(),
          entry.fullPath
        );
        extBridge.sendMessageToOpenUrl(fileUrl);
        resolve();
      });
  });
};
