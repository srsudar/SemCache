'use strict';

var base64 = require('base-64');

var chromep = require('../chrome-apis/chromep');
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
  if (message.type === 'write') {
    if (response) {
      // We'll handle the response callback asynchronously. Return true to
      // inform Chrome to keep the channel open for us.
      result = true;
    }
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
  } else if (message.type === 'query') {
    // TODO: ugly duplication here of same machinery
    if (response) {
      result = true;
    }
    exports.performQuery(message.params.url)
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
  } else {
    console.log('Unrecognized message type from extension: ', message.type);
  }
  return result;
};

/**
 * Handle a query from the extension about a saved page.
 *
 * @param {object} message the message from the extension
 *
 * @return {object} the result of the query
 */
exports.performQuery = function(message) {
  return new Promise(function(resolve, reject) {
    // Check for the url.
    // Return the information about the entry, including the access path.
    datastore.getAllCachedPages()
    .then(pages => {
      pages.forEach(page => {
        if (exports.urlsMatch(message.params.url, page.captureUrl)) {
          resolve(page);
          return;
        }
      });
    resolve(null);
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
