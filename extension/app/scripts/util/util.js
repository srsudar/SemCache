/* globals fetch */
'use strict';

var tabs = require('../chrome-apis/tabs');

/**
 * Very thin wrapper around the global fetch API to enable mocks during test.
 *
 * @param {string} url URL against which to issue the fetch
 *
 * @return {Promise} Promise that is the result of the global fetch API
 */
exports.fetch = function(url) {
  return fetch(url);
};

/**
 * @return {document} the global document object
 */
exports.getDocument = function() {
  return document;
};

/**
 * @return {window} the global window object
 */
exports.getWindow = function() {
  return window;
};

/**
 * @return {window.performance}
 */
exports.getPerf = function() {
  return exports.getWindow().performance;
};

/**
 * @return {Promise} Promise that resolves when document.readyState is
 * complete, indicating that all resources have been loaded (and thus the page
 * is presumably safe to save
 */
exports.getOnCompletePromise = function() {
  // Modeled on Jake Archibald's svgomg utils:
  // https://github.com/jakearchibald/svgomg/blob/master/src/js/page/utils.js
  var doc = exports.getDocument();
  return new Promise(function(resolve) {
    var checkState = function() {
      if (doc.readyState === 'complete') {
        resolve();
      }
    };
    doc.addEventListener('readystatechange', checkState);
    checkState();
  });
};

/**
 * @return {Promise -> Tab} Promise that resolves with the current active Tab
 */
exports.getActiveTab = function() {
  return new Promise(function(resolve) {
    tabs.query({ currentWindow: true, active: true})
      .then(tabs => {
        var tab = tabs[0];
        resolve(tab);
      });
  });
};

/**
 * @return {Date} return result of 'new Date()'
 */
exports.getToday = function() {
  return new Date();
};

/**
 * Returns a promise that resolves after the given time (in ms).
 *
 * @param {integer} ms the number of milliseconds to wait before resolving
 */
exports.wait = function(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
};
