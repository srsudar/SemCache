'use strict';

var chromeWrapper = require('./chromeRuntimeWrapper');
var datastore = require('../persistence/datastore');
var base64 = require('base-64');

/**
 * ID of the Semcache extension.
 */
exports.EXTENSION_ID = 'malgfdapbefeeidjfndgioclhfpfglhe';

/**
 * Function to handle messages coming from the SemCache extension.
 *
 * @param {object} message message sent by the extension. Expected to have the
 * following format:
 * {
 *   type: 'write'
 *   params: {captureUrl: 'url', captureDate: 'iso', dataUrl: 'string'}
 * }
 * @param {MessageSender}
 * @param {function}
 */
exports.handleExternalMessage = function(message, sender, response) {
  if (sender.id !== exports.EXTENSION_ID) {
    console.log('ID not from SemCache extension: ', sender);
    return;
  }
  if (message.type === 'write') {
    var blob = exports.getBlobFromDataUrl(message.params.dataUrl);
    var captureUrl = message.params.captureUrl;
    var captureDate = message.params.captureDate;
    datastore.addPageToCache(captureUrl, captureDate, blob);
    if (response) {
      response();
    }
  } else {
    console.log('Unrecognized message type from extension: ', message.type);
  }
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
  chromeWrapper.addOnMessageExternalListener(exports.handleExternalMessage);
};
