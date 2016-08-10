/* globals Promise, fetch */
'use strict';

/**
 * The main controlling piece of the app. It composes the other modules.
 */

var chromeUdp = require('./chrome-apis/udp');
var datastore = require('./persistence/datastore');
var extBridge = require('./extension-bridge/messaging');
var fileSystem = require('./persistence/file-system');
var settings = require('./settings');
var dnssdSem = require('./dnssd/dns-sd-semcache');
var serverApi = require('./server/server-api');
var dnsController = require('./dnssd/dns-controller');

var LISTENING_HTTP_INTERFACE = null;

var ABS_PATH_TO_BASE_DIR = null;

exports.SERVERS_STARTED = false;

/**
 * Struggling to mock this during testing with proxyquire, so use this as a
 * level of redirection.
 */
exports.getServerController = function() {
  return require('./server/server-controller');
};

/**
 * Get the interface on which the app is listening for incoming http
 * connections.
 *
 * @return {object} an object of the form:
 * {
 *   name: string,
 *   address: string,
 *   prefixLength: integer,
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
 * @return {string} the URL for the list of pages in this device's own cache
 */
exports.getListUrlForSelf = function() {
  var iface = exports.getListeningHttpInterface();
  var host = iface.address;
  var port = iface.port;
  var result = serverApi.getListPageUrlForCache(host, port);
  return result;
};

/**
 * @return {object} the cache object that represents this machine's own cache.
 */
exports.getOwnCache = function() {
  var instanceName = settings.getInstanceName();
  var serverPort = settings.getServerPort();
  var hostName = settings.getHostName();
  var ipAddress = exports.getListeningHttpInterface().address;
  var listUrl = serverApi.getListPageUrlForCache(ipAddress, serverPort);

  var result = {
    domainName: hostName,
    instanceName: instanceName,
    port: serverPort,
    ipAddress: ipAddress,
    listUrl: listUrl
  };
  return result;
};

/**
 * @return {boolean} true if we have turned on the network
 */
exports.networkIsActive = function() {
  return exports.SERVERS_STARTED;
};

/**
 * Obtain an Array of all the caches that can be browsed on the current local
 * network.
 *
 * The current machine's cache is always returned, and is always the first
 * element in the array.
 *
 * @return {Promise} Promise that resolves with an Array of object representing
 * operational info for each cache. An example element:
 * {
 *   domainName: 'laptop.local',
 *   instanceName: 'My Cache._semcache._tcp.local',
 *   ipAddress: '1.2.3.4',
 *   port: 1111,
 *   listUrl: 'http://1.2.3.4:1111/list_pages'
 * }
 */
exports.getBrowseableCaches = function() {
  // First we'll construct our own cache info. Some of these variables may not
  // be set if we are initializing for the first time and settings haven't been
  // created.
  var thisCache = exports.getOwnCache();

  var result = [thisCache];

  if (!exports.networkIsActive()) {
    // When we shouldn't query the network.
    return Promise.resolve(result);
  }

  var ipAddress = exports.getListeningHttpInterface().address;

  return new Promise(function(resolve) {
    dnssdSem.browseForSemCacheInstances()
      .then(instances => {
        // sort by instance name.
        instances.sort(function(a, b) {
          return a.instanceName.localeCompare(b.instanceName);
        });
        instances.forEach(instance => {
          if (instance.ipAddress === ipAddress) {
            // We've found ourselves. Don't add it.
            return;
          }
          instance.listUrl = serverApi.getListPageUrlForCache(
            instance.ipAddress,
            instance.port
          );
          result.push(instance);
        });
        resolve(result);
      });
  });
};

/**
 * Start the mDNS, DNS-SD, and HTTP servers and register the local instance on
 * the network.
 *
 * @return {Promise} Promise that resolves if the service starts successfully,
 * else rejects with a message as to why.
 */
exports.startServersAndRegister = function() {
  return new Promise(function(resolve, reject) {
    var instanceName = settings.getInstanceName();
    var serverPort = settings.getServerPort();
    var baseDirId = settings.getBaseDirId();
    var hostName = settings.getHostName();
    var httpIface = '0.0.0.0';
    if (!instanceName || !serverPort || !baseDirId || !hostName) {
      reject('Complete and save settings before starting');
      return;
    }

    exports.updateCachesForSettings();
    dnsController.start()
    .then(() => {
      return dnssdSem.registerSemCache(hostName, instanceName, serverPort);
    })
    .then(registerResult => {
      console.log('REGISTERED: ', registerResult);
      exports.getServerController().start(httpIface, serverPort);
      exports.SERVERS_STARTED = true;
      resolve(registerResult);
    })
    .catch(rejected => {
      console.log('REJECTED: ', rejected);
      reject(rejected);
    });
  });
};

/**
 * The counterpart method to startServersAndRegister().
 */
exports.stopServers = function() {
  exports.getServerController().stop();
  dnsController.clearAllRecords();
  exports.SERVERS_STARTED = false;
};

/**
 * Start the app.
 *
 * @return {Promise} Promise that resolves when the app is started
 */
exports.start = function() {
  extBridge.attachListeners();

  return new Promise(function(resolve) {
    chromeUdp.getNetworkInterfaces()
      .then(interfaces => {
        var ipv4Interfaces = [];
        interfaces.forEach(nwIface => {
          if (nwIface.address.indexOf(':') === -1) {
            // ipv4
            ipv4Interfaces.push(nwIface);
          }
        });
        if (ipv4Interfaces.length === 0) {
          console.log('Could not find ipv4 interface: ', interfaces);
        } else {
          var iface = ipv4Interfaces[0];
          LISTENING_HTTP_INTERFACE = iface;
        }
      })
      .then(() => {
        return settings.init();
      })
      .then(settingsObj => {
        console.log('initialized settings: ', settingsObj);
        exports.updateCachesForSettings();
        resolve();
      });
  });
};

/**
 * Update the local state of the controller with the current settings.
 */
exports.updateCachesForSettings = function() {
  exports.setAbsPathToBaseDir(settings.getAbsPath());
  LISTENING_HTTP_INTERFACE.port = settings.getServerPort();
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
