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
