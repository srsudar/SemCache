'use strict';

const base64 = require('base-64');

const appc = require('../app-controller');
const chromep = require('../chrome-apis/chromep');
const coalMgr = require('../coalescence/manager');
const common = require('./common-messaging');
const constants = require('../constants');
const datastore = require('../persistence/datastore');
const persObjs = require('../persistence/objects');

const CPDisk = persObjs.CPDisk;


/**
 * ID of the Semcache extension.
 */
exports.EXTENSION_ID = 'malgfdapbefeeidjfndgioclhfpfglhe';

/**
 * Send a message to the extension.
 *
 * @param {any} message
 */
exports.sendMessageToExtension = function(message) {
  chromep.getRuntime().sendMessage(exports.EXTENSION_ID, message);
};

/**
 * Function to handle messages coming from the SemCache extension.
 *
 * @param {Object} message message sent by the extension.
 * @param {MessageSender} sender
 * @param {function} response
 */
exports.handleExternalMessage = function(message, sender, response) {
  // Methods via onMessagExternal.addListener must respond true if the response
  // callback is going to be invoked asynchronously. We'll create this value
  // and allow the if logic below to specify if it will be invoking response.
  var result = false;
  if (sender.id !== exports.EXTENSION_ID) {
    console.log('ID not from SemCache extension: ', sender);
    return;
  }
  if (response) {
    // We'll handle the response callback asynchronously. Return true to
    // inform Chrome to keep the channel open for us.
    result = true;
  }
  if (message.type === common.initiatorTypes.addPageToCache) {
    Promise.resolve()
    .then(() => {
      let cpdisk = CPDisk.fromJSON(message.params.cachedPage);
      return datastore.addPageToCache(cpdisk);
    })
    .then(() => {
      let successMsg = common.createAddPageResponse();
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      let errorMsg = common.createResponseError(
        common.responderTypes.addPageToCache, {}, err
      );
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === common.initiatorTypes.localQuery) {
    exports.queryLocalMachineForUrls(message)
    .then(result => {
      let successMsg = common.createLocalQueryResponse({}, result);
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      var errorMsg = common.createResponseError(
        common.responderTypes.localQuery, {}, err
      );
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === common.initiatorTypes.openPage) {
    exports.handleOpenRequest(message)
    .then(result => {
      let successMsg = common.createOpenResponse({}, result);
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      let errorMsg = common.createResponseError(
        common.responderTypes.openPage, {}, err
      );
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === common.initiatorTypes.networkQuery) {
    exports.queryLocalNetworkForUrls(message)
    .then(result => {
      let successMsg = common.createNetworkQueryResponse({}, result);
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      let errorMsg = common.createResponseError(
        common.responderTypes.networkQuery, {}, err
      );
      if (response) {
        response(errorMsg);
      }
    });
  } else {
    console.log('Unrecognized message type from extension: ', message.type);
  }
  return result;
};

/**
 * Handle a message asking to open a particular cached page.
 *
 * @param {Object} message message from the client
 *
 * @return {Promise.<number, Error>} Promise that resolves with the result of
 * saveMhtmlAndOpen or rejects with an Error
 */
exports.handleOpenRequest = function(message) {
  return new Promise(function(resolve, reject) {
    appc.saveMhtmlAndOpen(
      message.params.serviceName,
      message.params.href
    )
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Handle a query from the extension about a saved page.
 *
 * @param {Object} message the message from the extension
 *
 * @return {Promise.<Object, Error>} the result of the query. We expect an
 * object like:
 * {
 *   url: [ CPInfo.asJSON(), ... ]
 * }
 * This should mirror the API of queryLocalNetworkForUrls.
 */
exports.queryLocalMachineForUrls = function(message) {
  return new Promise(function(resolve, reject) {
    // Check for the url.
    // Return the information about the entry, including the access path.
    var urls = message.params.urls;
    var result = {};
    datastore.getAllCachedPages()
    .then(cpinfos => {
      cpinfos.forEach(cpinfo => {
        urls.forEach(url => {
          if (url === cpinfo.captureHref) {
            var copies = result[url];
            if (!copies) {
              copies = [];
              result[url] = copies;
            }
            // Add a serviceName that says we are referring to our own machine
            cpinfo.serviceName = constants.SELF_SERVICE_SHORTCUT;
            copies.push(cpinfo);
          }
        });
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Query the local network, rather than the local machine, for available URLs.
 *
 * @param {Object} message the message from the extension
 *
 * @return {Promise.<Object, Error>} the result of the query
 */
exports.queryLocalNetworkForUrls = function(message) {
  return new Promise(function(resolve, reject) {
    coalMgr.queryForUrls(message.params.urls)
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {string} dataUrl a data url as encoded by FileReader.readAsDataURL
 *
 * @return {Blob}
 */
exports.getBlobFromDataUrl = function(dataUrl) {
  // Decoding from data URL based on:
  // https://gist.github.com/fupslot/5015897
  var byteString = base64.decode(dataUrl.split(',')[1]);
  var mime = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  // write the ArrayBuffer to a blob, and you're done
  var result = new Blob([ab], {type: mime});
  return result;
};

exports.attachListeners = function() {
  var runtime = chromep.getRuntime();
  console.log('runtime: ', runtime);
  var ome = runtime.onMessageExternal;
  console.log('ome: ', ome);
  chromep.getRuntimeBare().onMessageExternal.addListener(
    exports.handleExternalMessage
  );
};

/**
 * Send a message to the Extension instructing it to open the URL.
 *
 * @param {string} url
 */
exports.sendMessageToOpenUrl = function(url) {
  var message = {
    type: 'open',
    params: {
      url: url
    }
  };
  exports.sendMessageToExtension(message);
};
