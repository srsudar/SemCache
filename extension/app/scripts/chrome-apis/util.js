/* globals chrome */
'use strict';

/**
 * Very lightweight utility class relating to the chrome apis.
 */

/**
 * @return {boolean} true if chrome.runtime.lastError is set, else false
 */
exports.wasError = function() {
  if (chrome.runtime.lastError) {
    return true;
  } else {
    return false;
  }
};

/**
 * @returns {runtime} returns chrome.runtime
 */
exports.getRuntime = function() {
  return chrome.runtime;
};

/**
 * @return {string} the value of chrome.runtime.lastError. Does not guarantee
 * that this value is set.
 */
exports.getError = function() {
  return chrome.runtime.lastError;
};

/**
 * @returns {filesystem} returns the chrome.filesystem object.
 */
exports.getFileSystem = function() {
  return chrome.fileSystem;
};

/**
 * @returns {StorageArea} chrome.storage.local
 */
exports.getStorageLocal = function() {
  return chrome.storage.local;
};

/**
 * @returns {chrome.sockets.udp}
 */
exports.getUdp = function() {
  return chrome.sockets.udp;
};

/**
 * This is a complicated function to understand. The need for it arises from
 * the fact that we are trying to mirror the Chrome API. Several of its
 * functions include optional parameters, which complicates just passing in
 * positional arguments directly. To circumvent this issue, we can use the
 * apply() argument to make the call with the exact arguments.
 *
 * Complicating this is that most of the calls also accept a callback
 * parameter. Since we want to Promise-ify the calls and account for errors,
 * this leads to a lot of boiler plate code. This method takes care of all of
 * this.
 *
 * It takes a function and an an arguments object. The function's last
 * parameter is expected to be a function callback. The returned Promise
 * resolves when this function is evoked and rejects if
 * chrome.runtime.lastError indicates that there was an error.
 *
 * @param {function} fn function that accepts a callback as its last parameter
 * @param {arguments} callArgs the arguments object with which fn should be
 * invoked
 *
 * @return {Promise.<any, Error>} Promise that resolves with the result to the
 * callback parameter or rejects with an Error.
 */
exports.applyArgsCheckLastError = function(fn, callArgs) {
  return new Promise(function(resolve, reject) {
    console.log('fn in apply: ', fn);
    console.log('callArgs: ', callArgs);
    // Some of these parameters are "optional", which it seems like the
    // sendMessage function interprets based on type, etc. Rather than passing
    // directly, we are going to pass the arguments variable directly, adding a
    // callback function.
    var args = Array.prototype.slice.call(callArgs);
    args.push(function(response) {
      if (exports.wasError()) {
        reject(exports.getError());
      } else {
        resolve(response);
      }
    });
    console.log('going to apply');
    fn.apply(null, args);
  });
};
