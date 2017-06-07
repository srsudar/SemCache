'use strict';

var base64 = require('base-64');

var appc = require('../app-controller');
var chromep = require('../chrome-apis/chromep');
var coalMgr = require('../coalescence/manager');
var datastore = require('../persistence/datastore');

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
  message.timeSent = Date.now();
  chromep.getRuntime().sendMessage(exports.EXTENSION_ID, message);
};

/**
 * Function to handle messages coming from the SemCache extension.
 *
 * @param {Object} message message sent by the extension. Expected to have the
 * following format:
 * {
 *   type: 'write'
 *   params: {
 *     captureUrl: 'url',
 *     captureDate: 'iso',
 *     dataUrl: 'string',
 *     metadata: {}
 *   }
 * }
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
  if (message.type === 'write') {
    var blob = exports.getBlobFromDataUrl(message.params.dataUrl);
    var captureUrl = message.params.captureUrl;
    var captureDate = message.params.captureDate;
    var metadata = message.params.metadata;
    datastore.addPageToCache(captureUrl, captureDate, blob, metadata)
    .then(() => {
      var successMsg = exports.createResponseSuccess(message);
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      var errorMsg = exports.createResponseError(message, err);
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === 'local-query') {
    exports.queryLocalMachineForUrls(message)
    .then(result => {
      var successMsg = exports.createResponseSuccess(message);
      successMsg.response = result;
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      var errorMsg = exports.createResponseError(message, err);
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === 'open') {
    exports.handleOpenRequest(message)
    .then(result => {
      var successMsg = exports.createResponseSuccess(message);
      successMsg.response = result;
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      var errorMsg = exports.createResponseError(message, err);
      if (response) {
        response(errorMsg);
      }
    });
  } else if (message.type === 'network-query') {
    console.log('received network-query: ', message);
    exports.queryLocalNetworkForUrls(message)
    .then(result => {
      var successMsg = exports.createResponseSuccess(message);
      successMsg.response = result;
      successMsg.timeSent = Date.now();
      if (response) {
        response(successMsg);
      }
    })
    .catch(err => {
      var errorMsg = exports.createResponseError(message, err);
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
    var cachedPage = message.params.page;
    appc.saveMhtmlAndOpen(
      cachedPage.captureUrl,
      cachedPage.captureDate,
      cachedPage.accessPath,
      cachedPage.metadata
    )
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      console.err('Error in handleOpenRequest: ', err);
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
 *   url: [ pageinfo, ... ]
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
    .then(pages => {
      pages.forEach(page => {
        urls.forEach(url => {
          if (exports.urlsMatch(url, page.metadata.fullUrl)) {
            var copies = result[url];
            if (!copies) {
              copies = [];
              result[url] = copies;
            }
            copies.push(page);
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
 * Determine if two URLs refer to the same page.
 *
 * This method is required only because we might not be saving the URL exactly
 * with the cached page and thus a straight string comparison does not apply.
 * E.g. we might only associated the cached page with "www.nytimes.com", not
 * "http://www.nytimes.com".
 *
 * @param {string} url the url passed from the extension. It is expected that
 * this can contain the full schema, eg "http://www.nytimes.com".
 * @param {string} savedUrl the url of the saved page
 *
 * @return {boolean} true if the URLs refer to the same page, else false
 */
exports.urlsMatch = function(url, savedUrl) {
  function cleanupForComparison(url) {
    // First strip a trailing slash.
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    // Then remove schemes
    if (url.startsWith('http://')) {
      url = url.substring('http://'.length);
    }
    if (url.startsWith('https://')) {
      url = url.substring('https://'.length);
    }
    return url;
  }

  url = cleanupForComparison(url);
  savedUrl = cleanupForComparison(savedUrl);

  // This isn't a perfect way to do this, but it will work in most usual cases.
  return url.endsWith(savedUrl);
};

/**
 * Create a message to send to the extension upon a successful action.
 *
 * @param {Object} message the original message that generated the request
 *
 * @return {Object} a response object. Contains at a result key, indicating
 * 'success', a type key, indicating the type of the original message, and an
 * optional params key with additional values.
 */
exports.createResponseSuccess = function(message) {
  return {
    type: message.type,
    result: 'success',
  };
};

/**
 * Create a message to send to the extension upon an error.
 *
 * @param {Object} message the original message that generated the request
 * @param {any} err the error info to send to the extension
 */
exports.createResponseError = function(message, err) {
  return {
    type: message.type,
    result: 'error',
    err: err
  };
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
