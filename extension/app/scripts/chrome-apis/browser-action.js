/* globals chrome */
'use strict';

/**
 * Wrapper around the chrome.browserAction family of APIs.
 */

exports.setIcon = function() {
  chrome.browserAction.setIcon.apply(null, arguments);
};

exports.setPopup = function() {
  chrome.browserAction.setPopup.apply(null, arguments);
};

exports.setBadgeText = function() {
  chrome.browserAction.setBadgeText.apply(null, arguments);
};
