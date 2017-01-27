'use strict';

/**
 * Helper to fetch and parse JSON from a URL.
 *
 * @param {string} url
 *
 * @return {Promise -> object} Promise that resolves with JSON fetched and
 * parsed from url.
 */
exports.fetchJson = function(url) {
  return new Promise(function(resolve) {
    exports.fetch(url)
    .then(response => {
      resolve(response.json());
    });
  });
};

/**
 * Wrapper around the global fetch api.
 *
 * @param {string} url
 *
 * @return {Promise} Promise returned by fetch()
 */
exports.fetch = function(url) {
  return fetch(url);
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

/**
 * Returns a Promise that resolves at a random time within the given range.
 *
 * @param {integer} min the minimum number of milliseconds to wait
 * @param {integer} max the maximum number of milliseconds to wait, inclusive
 *
 * @return {Promise} Promise that resolves after the wait
 */
exports.waitInRange = function(min, max) {
  // + 1 because we specify inclusive, but randomInt is exclusive.
  var waitTime = exports.randomInt(min, max + 1);
  return exports.wait(waitTime);
};

/**
 * Return a random integer between [min, max).
 *
 * @param {integer} min
 * @param {integer} max
 *
 * @return {integer} random value >= min and < max
 */
exports.randomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Download a file as text. Note that this requires a DOM, so it is not
 * strictly node compliant.
 *
 * @param {string} text the text to download
 * @param {string} fileName
 */
exports.downloadText = function(text, fileName) {
  // Based on:
  // https://stackoverflow.com/questions/3665115/
  // create-a-file-in-memory-for-user-to-download-not-through-server
  var element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' +
      encodeURIComponent(text)
  );
  element.setAttribute('download', fileName);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/**
 * Utility logging function.
 *
 * Based on:
 * https://github.com/webrtc/samples/blob/gh-pages/src/js/common.js
 */
exports.trace = function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ': ', arg);
};
