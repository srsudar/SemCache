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
  return new Promise(function(resolve, reject) {
    exports.fetch(url)
    .then(response => {
      resolve(response.json());
    })
    .catch(err => {
      reject(err);
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
exports.fetch = function() {
  return fetch.apply(null, arguments);
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

/**
 * Extract the hostname (or IP address) from a URL.
 *
 * @param {String} url
 *
 * @returns {String}
 */
exports.getHostFromUrl = function(url) {
  // Find '//'. This will be the end of the scheme.
  // Then find the minimum of '/', ':', '#', '?'. That will contain the URL.
  var slashes = url.indexOf('//');
  if (slashes < 0) { throw new Error('not a url: ' + url); }
  // Truncate to ignore the slashes.
  url = url.substring(slashes + 2);

  var candidateIndices = [
    url.indexOf(':'),
    url.indexOf('#'),
    url.indexOf('?'),
    url.indexOf('/')
  ];
  var min = url.length;
  candidateIndices.forEach(idx => {
    if (idx !== -1) {
      // It is present in the string.
      if (idx < min) {
        min = idx;
      }
    }
  });
  
  return url.substr(0, min);
};

/**
 * Extract the port from a URL. The port must be explicitly indicated in the
 * URL, or an error is thrown.
 *
 * @param {String} url
 *
 * @returns {Integer}
 */
exports.getPortFromUrl = function(url) {
  var originalUrl = url;
  var host = exports.getHostFromUrl(url);
  var idxOfHost = url.indexOf(host);
  // Truncate the host
  url = url.substring(idxOfHost + host.length);
  if (!url.startsWith(':')) {
    throw new Error('No port in url: ' + originalUrl);
  }
  // Truncate the colon
  url = url.substring(1);
  var candidateIndices = [
    url.indexOf('#'),
    url.indexOf('?'),
    url.indexOf('/')
  ];
  var min = url.length;
  candidateIndices.forEach(idx => {
    if (idx !== -1) {
      if (idx < min) {
        min = idx;
      }
    }
  });
  var portStr = url.substring(0, min);
  // There is no easy way that I'm aware of to check is something can be safely
  // parsed to an int in JavaScript. Wtf. But this is will work well enough for
  // our cases. It will permit things like '12a', '0xaf', etc, but this seems
  // fine.
  var result = parseInt(portStr, 10);
  if (isNaN(result)) {
    throw new Error('Invalid port in url: ' + originalUrl);
  }
  return parseInt(portStr);
};

/**
 * Return the Buffer as a Blob with type application/octet-binary.
 *
 * @param {Buffer} buff
 *
 * @returns {Blob}
 */
exports.getBufferAsBlob = function(buff) {
  return new Blob(
    [buff], 
    {
      type: 'application/octet-binary' 
    }
  );
};
