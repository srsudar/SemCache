'use strict';

/**
 * The main controlling piece of the app. It composes the other modules.
 */

const coalMgr = require('./coalescence/manager');
const constants = require('./constants');
const datastore = require('./persistence/datastore');
const dnsController = require('./dnssd/dns-controller');
const dnssdSem = require('./dnssd/dns-sd-semcache');
const evaluation = require('./evaluation');
const extBridge = require('./extension-bridge/messaging');
const fileSystem = require('./persistence/file-system');
const ifCommon = require('./peer-interface/common');
const peerIfMgr = require('./peer-interface/manager');
const settings = require('./settings');
const serverApi = require('./server/server-api');


let ABS_PATH_TO_BASE_DIR = null;

exports.LISTENING_HTTP_INTERFACE = null;

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
 * @return {Object} an object of the form:
 * {
 *   name: string,
 *   address: string,
 *   prefixLength: integer,
 * }
 */
exports.getListeningHttpInterface = function() {
  if (!exports.LISTENING_HTTP_INTERFACE) {
    console.warn('listening http interface not set, is app started?');
  }
  return exports.LISTENING_HTTP_INTERFACE;
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
  let iface = exports.getListeningHttpInterface();
  let host = iface.address;
  let port = iface.port;
  let result = serverApi.getListPageUrlForCache(host, port);
  return result;
};

/**
 * @return {Object} the cache object that represents this machine's own cache.
 */
exports.getOwnCache = function() {
  let friendlyName = settings.getInstanceName();
  let instanceName = dnssdSem.getFullName(friendlyName);
  let serverPort = settings.getServerPort();
  let hostName = settings.getHostName();
  let ipAddress = exports.getListeningHttpInterface().address;
  let listUrl = serverApi.getListPageUrlForCache(ipAddress, serverPort);
  let serviceType = dnssdSem.getSemCacheServiceString();

  let result = {
    serviceType: serviceType,
    domainName: hostName,
    instanceName: instanceName,
    friendlyName: friendlyName,
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
 * This should return the same object that getPeerCaches should return.
 * However, we don't want to query the network to get this information, as
 * people should be able to browse on their own machine even if the network
 * doesn't support UDP.
 *
 * @return {Object} Object identical to that returned by getPeerCacheNames, but
 * for this device
 */
exports.getOwnCacheName = function() {
  let friendlyName = settings.getInstanceName();
  let fullName = dnssdSem.getFullName(friendlyName);
  let serviceType = dnssdSem.getSemCacheServiceString();

  let result = {
    serviceType: serviceType,
    friendlyName: friendlyName,
    serviceName: fullName
  };
  
  return result;
};

/**
 * Obtain the operational information to use the cache. Does not use the
 * network if we are requesting our own information. Otherwise, queries the
 * network for the SRV and A records needed to resolve the service and resolves
 * with the operational information needed to connect to the service.
 *
 * @param {string} fullName the full <instance>.<type>.<domain> name of the
 * service
 *
 * @return {Promise.<Object, Error>} Promise that resolves with an object like
 * the following, or rejects if something went wrong.
 * {
 *   domainName: 'laptop.local',
 *   friendlyName: 'My Cache',
 *   instanceName: 'My Cache._semcache._tcp.local',
 *   ipAddress: '1.2.3.4',
 *   port: 1111,
 *   serviceType: '_semcache._tcp',
 *   listUrl: 'http://1.2.3.4:1111/list_pages'
 * }
 */
exports.resolveCache = function(fullName) {
  return new Promise(function(resolve, reject) {
    let ownCache = exports.getOwnCache();
    if (fullName === constants.SELF_SERVICE_SHORTCUT) {
      resolve(ownCache);
      return;
    }
    if (fullName === ownCache.instanceName) {
      // We're looking for ourselves--don't both querying the network.
      resolve(ownCache);
      return;
    }
    // We need to hit the network.
    dnssdSem.resolveCache(fullName)
    .then(cache => {
      resolve(cache);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Obtain an Array of all the cache names that can be browsed on the current
 * local network.
 *
 * Unlike getBrowseableCaches, this method only returns the information
 * contained in a PTR request and is safe for caching. An additional call will
 * be required to obtain operational information (like the IP address) of these
 * caches.
 *
 * @return {Promise.<Array.<Object>, Error>} Promise that resolves a list of
 * objects like the following:
 * {
 *   serviceType: '_semcache._tcp',
 *   friendlyName: 'Magic Cache',
 *   serviceName: 'Magic Cache._semcache._tcp.local'
 * }
 */
exports.getPeerCacheNames = function() {
  if (!exports.SERVERS_STARTED) {
    return Promise.resolve([]);
  }

  // First we'll construct our own cache info. Some of these variables may not
  // be set if we are initializing for the first time and settings haven't been
  // created.
  let thisCacheName = exports.getOwnCacheName();

  let result = [thisCacheName];

  if (!exports.networkIsActive()) {
    // When we shouldn't query the network.
    return Promise.resolve(result);
  }

  return new Promise(function(resolve, reject) {
    dnssdSem.browseForSemCacheInstanceNames()
    .then(instanceNames => {
      // sort by instance name.
      instanceNames.sort(function(a, b) {
        return a.serviceName.localeCompare(b.serviceName);
      });
      instanceNames.forEach(instance => {
        if (instance.serviceName === thisCacheName.serviceName) {
          // We've found ourselves. Don't add it.
          return;
        }
        result.push(instance);
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Obtain an Array of all the caches that can be browsed on the current local
 * network.
 *
 * The current machine's cache is always returned, and is always the first
 * element in the array.
 *
 * @return {Promise.<Array.<Object>, Error>} Promise that resolves with an
 * Array of object representing operational info for each cache. An example
 * element:
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
  if (!exports.SERVERS_STARTED) {
    return Promise.resolve([]);
  }

  let thisCache = exports.getOwnCache();

  let result = [thisCache];

  if (!exports.networkIsActive()) {
    // When we shouldn't query the network.
    return Promise.resolve(result);
  }

  let ipAddress = exports.getListeningHttpInterface().address;

  return new Promise(function(resolve, reject) {
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
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Start the mDNS, DNS-SD, and HTTP servers and register the local instance on
 * the network.
 *
 * @return {Promise.<undefined, Error>} Promise that resolves if the service
 * starts successfully, else rejects with a message as to why.
 */
exports.startServersAndRegister = function() {
  return new Promise(function(resolve, reject) {
    let instanceName = settings.getInstanceName();
    let serverPort = settings.getServerPort();
    let baseDirId = settings.getBaseDirId();
    let hostName = settings.getHostName();
    let httpIface = '0.0.0.0';
    if (!instanceName || !serverPort || !baseDirId || !hostName) {
      reject('Complete and save settings before starting');
      return;
    }

    dnsController.start()
    .then(() => {
      let ifaces = dnsController.getIPv4Interfaces();
      if (ifaces.length === 0) {
        throw new Error('No network interfaces in dns-controller');
      }
      exports.LISTENING_HTTP_INTERFACE = ifaces[0];
      exports.LISTENING_HTTP_INTERFACE.port = serverPort;
      exports.updateCachesForSettings();

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
  coalMgr.reset();
  exports.getServerController().stop();
  dnsController.stop();
  exports.LISTENING_HTTP_INTERFACE = null;
  exports.SERVERS_STARTED = false;
};

/**
 * Start the app.
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when the app is
 * started
 */
exports.start = function() {
  extBridge.attachListeners();

  return new Promise(function(resolve, reject) {
    settings.init()
    .then(settingsObj => {
      console.log('initialized settings: ', settingsObj);
      exports.updateCachesForSettings();
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Update the local state of the controller with the current settings.
 */
exports.updateCachesForSettings = function() {
  exports.setAbsPathToBaseDir(settings.getAbsPath());
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
 * Obtain the list of cached pages from a service, given its full name.
 *
 * @param {string} serviceName the full <instance>.<type>.<domain> name of the
 * service
 *
 * @return {Promise.<Object, Error>} Promise that resolves with the JSON
 * response representing the list, or rejects with an Error
 */
exports.getListFromService = function(serviceName) {
  return new Promise(function(resolve, reject) {
    let peerAccessor = peerIfMgr.getPeerAccessor();
    exports.resolveCache(serviceName)
    .then(cacheInfo => {
      let listParams = ifCommon.createListParams(
        cacheInfo.ipAddress, cacheInfo.port, cacheInfo.listUrl
      );
      return peerAccessor.getList(listParams);
    })
    .then(pageList => {
      resolve(pageList);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Save the MHTML file at mhtmlUrl into the local cache and open the URL.
 *
 * @param {string} serviceName the service name of the peer
 * @param {string} href the URL to fetch from the peer
 *
 * @return {Promise.<number, Error>} a Promise that resolves with the total
 * time to save the MHTML and open the file.
 */
exports.saveMhtmlAndOpen = function(serviceName, href) {
  return new Promise(function(resolve, reject) {
    let start = evaluation.getNow();
    let streamName = 'open_' + href;
    exports.resolveCache(serviceName)
    .then(cacheInfo => {
      return peerIfMgr.getPeerAccessor(
        cacheInfo.ipAddress, cacheInfo.port
      ).getCachedPage(href);
    })
    .then(cpdisk => {
      return datastore.addPageToCache(cpdisk);
    })
    .then((entry) => {
      let fileUrl = fileSystem.constructFileSchemeUrl(
        exports.getAbsPathToBaseDir(),
        entry.fullPath
      );
      extBridge.sendMessageToOpenUrl(fileUrl);
      let end = evaluation.getNow();
      let totalTime = end - start;
      evaluation.logTime(streamName, totalTime);
      console.warn('totalTime to fetch: ', totalTime);
      resolve(totalTime);
    })
    .catch(err => {
      reject(err);
    });
  });
};
