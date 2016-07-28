'use strict';

/**
 * The main controlling piece of the app. It composes the other modules.
 */

var chromeUdp = require('./dnssd/chromeUdp');

var LISTENING_HTTP_INTERFACE = null;

/**
 * This port is hard-coded for now, as the web server requires that we pass a
 * port. This will be amended and should be dynamically allocated.
 */
var HTTP_PORT = 9876;

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
 * Start the app.
 *
 * @return {Promise} Promise that resolves when the app is started
 */
exports.start = function() {
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
