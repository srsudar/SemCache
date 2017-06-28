'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;

const blobToBufferLib = require('blob-to-buffer');
const dataUrlToBlob = require('dataurl-to-blob');


const DEFAULT_BUFFER_SIZE = 0;

/**
 * Helper to fetch and parse JSON from a URL.
 *
 * @param {string} url
 *
 * @return {Promise.<Object, Error>} Promise that resolves with JSON fetched
 * and parsed from url.
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
 *
 * @return {Promise.<undefined, undefined>}
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
 * @return {Promise.<undefined, undefined>} Promise that resolves after the
 * wait
 */
exports.waitInRange = function(min, max) {
  // + 1 because we specify inclusive, but randomInt is exclusive.
  let waitTime = exports.randomInt(min, max + 1);
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
  let element = document.createElement('a');
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
  let now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ': ', arg);
};

/**
 * @return {window.performance}
 */
exports.getPerf = function() {
  return window.performance;
};

/**
 * Extract the hostname (or IP address) from a URL.
 *
 * @param {string} url
 *
 * @return {string}
 */
exports.getHostFromUrl = function(url) {
  // Find '//'. This will be the end of the scheme.
  // Then find the minimum of '/', ':', '#', '?'. That will contain the URL.
  let slashes = url.indexOf('//');
  if (slashes < 0) { throw new Error('not a url: ' + url); }
  // Truncate to ignore the slashes.
  url = url.substring(slashes + 2);

  let candidateIndices = [
    url.indexOf(':'),
    url.indexOf('#'),
    url.indexOf('?'),
    url.indexOf('/')
  ];
  let min = url.length;
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
 * @param {string} url
 *
 * @return {integer}
 */
exports.getPortFromUrl = function(url) {
  let originalUrl = url;
  let host = exports.getHostFromUrl(url);
  let idxOfHost = url.indexOf(host);
  // Truncate the host
  url = url.substring(idxOfHost + host.length);
  if (!url.startsWith(':')) {
    throw new Error('No port in url: ' + originalUrl);
  }
  // Truncate the colon
  url = url.substring(1);
  let candidateIndices = [
    url.indexOf('#'),
    url.indexOf('?'),
    url.indexOf('/')
  ];
  let min = url.length;
  candidateIndices.forEach(idx => {
    if (idx !== -1) {
      if (idx < min) {
        min = idx;
      }
    }
  });
  let portStr = url.substring(0, min);
  // There is no easy way that I'm aware of to check is something can be safely
  // parsed to an int in JavaScript. Wtf. But this is will work well enough for
  // our cases. It will permit things like '12a', '0xaf', etc, but this seems
  // fine.
  let result = parseInt(portStr, 10);
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
 * @return {Blob}
 */
exports.getBufferAsBlob = function(buff) {
  return new Blob(
    [buff], 
    {
      type: 'application/octet-binary' 
    }
  );
};

/**
 * Convert arg to an array. Leaves untouched if it is already an array.
 *
 * @return {Array}
 */
exports.toArray = function(arg) {
  let result = arg;
  if (!Array.isArray(result)) {
    result = [result];
  }
  return result;
};

/**
 * @param {Buffer} buff
 *
 * @return {string} the buffer encoded as a data URL
 */
exports.getBufferAsDataUrl = function(buff) {
  return new Promise(function(resolve, reject) {
    let blob = exports.getBufferAsBlob(buff);
    exports.getBlobAsDataUrl(blob)
    .then(result => {
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {string} dataUrl
 *
 * @return {Promise.<Buffer, Error>}
 */
exports.getDataUrlAsBuffer = function(dataUrl) {
  return new Promise(function(resolve, reject) {
    let blob = dataUrlToBlob(dataUrl);
    exports.blobToBuffer(blob)
    .then(buff => {
      resolve(buff);
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * @param {Blob} blob
 *
 * @return {Promise} Promise that resolves with a data url string
 */
exports.getBlobAsDataUrl = function(blob) {
  return new Promise(function(resolve) {
    let reader = new window.FileReader();
    reader.onloadend = function() {
      let base64 = reader.result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * @param {Blob} blob
 *
 * @return {Promise.<Buffer, Error>}
 */
exports.blobToBuffer = function(blob) {
  return new Promise(function(resolve, reject) {
    blobToBufferLib(blob, function(err, buff) {
      if (err) {
        reject(err);
      } else {
        resolve(buff);
      }
    });
  });
};

/**
 * @param {Buffer} buff
 *
 * @return {Blob}
 */
exports.buffToBlob = function(buff) {
  return new Blob([ buff ]);
};

/**
 * Convert a data URI to a Buffer.
 *
 * @param {string} uri the data URI
 *
 * @return {Buffer} 
 */
exports.dataToBuff = function(uri) {
  // We expect something like 'data:text/plain;base64,aGVsbG8='.
  // Options are discussed here:
  // https://stackoverflow.com/questions/11335460/how-do-i-parse-a-data-url-in-node
  return new Buffer(uri.split(',')[1], 'base64');
};

/**
 *
 * Conver a Buffer to a dataUri.
 *
 * @param {Buffer} buff
 *
 * @return {string} data uri
 */
exports.buffToData = function(buff) {
  // Do this by hand for our simple use cases. We might have to get fancier and
  // use a dependency-lite library if we start leaning on this method.
  // We'll always use this mimetype for now.
  let startUri = 'data:application/octet-stream;base64,';
  return startUri + buff.toString('base64');
};

/**
 * Convert a JSON object to a Buffer. This tries to be intelligent, serializing
 * the non-Buffer properties via JSON.stringify, and leaving Buffer properties
 * untouched.
 *
 * @param {Object} obj
 *
 * @return {Buffer}
 */
exports.objToBuff = function(obj) {
  // Get all the JSON-ifiable properties on their own and add them as a JSON
  // string.
  let json = {};
  let sBuff = SmartBuffer.fromBuffer(new Buffer(DEFAULT_BUFFER_SIZE));

  for (let prop of Object.keys(obj)) {
    let value = obj[prop];
    if (Buffer.isBuffer(value)) {
      // We will add Buffers as [string, buffer_length, Buffer].
      sBuff.writeStringNT(prop);
      sBuff.writeUInt32LE(value.length);
      sBuff.writeBuffer(value);
    } else {
      json[prop] = value;
    }
  }

  let resultSb = SmartBuffer.fromBuffer(new Buffer(DEFAULT_BUFFER_SIZE));
  let jsonStr = JSON.stringify(json);

  resultSb.writeUInt32LE(jsonStr.length);
  resultSb.writeString(jsonStr);
  resultSb.writeBuffer(sBuff.toBuffer());

  return resultSb.toBuffer();
};

/**
 * Reclaim an Object from a Buffer as generated by objToBuff.
 *
 * @param {Buffer}
 *
 * @return {Object}
 */
exports.buffToObj = function(buff) {
  // We expect:
  // [length, jsonString, (null-terminated string, buff length, buff) * n]
  let sBuff = SmartBuffer.fromBuffer(buff);
  let jsonLength = sBuff.readUInt32LE();
  let jsonStr = sBuff.readString(jsonLength);

  let result = JSON.parse(jsonStr);

  // No reclaim the buffers.
  while (sBuff.remaining() > 0) {
    let propName = sBuff.readStringNT();
    let buffLength = sBuff.readUInt32LE();
    let buff = sBuff.readBuffer(buffLength);
    result[propName] = buff;
  }
  
  return result;
};
