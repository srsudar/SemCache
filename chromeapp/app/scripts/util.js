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
