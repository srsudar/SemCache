/* globals chrome */
'use strict';

/**
 * Add a callback function via chrome.runtime.onMessageExternal.addListener.
 * @param {Function} fn
 */
exports.addOnMessageExternalListener = function(fn) {
  chrome.runtime.onMessageExternal.addListener(fn);
};
