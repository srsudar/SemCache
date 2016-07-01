/*jshint esnext:true*/
/*exported ByteArray*/
'use strict';

/*
 * https://github.com/justindarc/dns-sd.js
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Justin D'Arcangelo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */


/**
 * ByteArray is an object that makes writing objects to an array of bytes more
 * straightforward. Obtaining values from the ByteArray is accomplished by the
 * ByteArrayReader. A single ByteArray can generate numerous ByteArrayReader
 * objects.
 *
 * The ByteArray class is adopted slightly from an object of the same name by
 * Justin D'Arcangelo. His original license and information is preserved above.
 */

var BinaryUtils = require('./binary-utils');

var DEFAULT_SIZE = 256;

/**
 * Create a new ByteArray. 
 *
 * maxBytesOrData can be an integer indicating the starting number of maximum
 * bytes, or it can be a ByteArray object to serve as the starting point. If
 * maxBytesOrData is not present, the ByteArray will be created with an initial
 * size of 256.
 */
exports.ByteArray = function ByteArray(maxBytesOrData) {
  if (!(this instanceof ByteArray)) {
    throw new Error('ByteArray must be called with new');
  }

  if (maxBytesOrData instanceof ByteArray) {
    maxBytesOrData = maxBytesOrData.buffer;
  }

  if (maxBytesOrData instanceof Uint8Array ||
      maxBytesOrData instanceof ArrayBuffer) {
    this._data = new Uint8Array(maxBytesOrData);
    this._buffer = this._data.buffer;
    this._cursor = this._data.length;
    return this;
  }

  this._buffer = new ArrayBuffer(maxBytesOrData || DEFAULT_SIZE);
  this._data = new Uint8Array(this._buffer);
  this._cursor = 0;


}

exports.ByteArray.prototype.constructor = exports.ByteArray;

Object.defineProperty(exports.ByteArray.prototype, 'length', {
  get: function() {
    return this._cursor;
  }
});

Object.defineProperty(exports.ByteArray.prototype, 'buffer', {
  get: function() {
    return this._buffer.slice(0, this._cursor);
  }
});

exports.ByteArray.prototype.push = function(value, length) {
  length = length || 1;

  this.append(valueToUint8Array(value, length));
};

exports.ByteArray.prototype.append = function(data) {
  // Get `data` as a `Uint8Array`
  if (data instanceof exports.ByteArray) {
    data = data.buffer;
  }

  if (data instanceof ArrayBuffer) {
    data = new Uint8Array(data);
  }

  for (var i = 0, length = data.length; i < length; i++) {
    this._data[this._cursor] = data[i];
    this._cursor++;
  }
};

exports.ByteArray.prototype.getReader = function(startByte) {
  return new exports.ByteArrayReader(this, startByte);
};

exports.ByteArrayReader = function ByteArrayReader(byteArray, startByte) {
  this.byteArray = byteArray;
  this.cursor = startByte || 0;
}

exports.ByteArrayReader.prototype.constructor = exports.ByteArrayReader;

Object.defineProperty(exports.ByteArrayReader.prototype, 'eof', {
  get: function() {
    return this.cursor >= this.byteArray.length;
  }
});

exports.ByteArrayReader.prototype.getBytes = function(length) {
  if (length === null || length === 0) {
    return new Uint8Array();
  }

  length = length || 1;

  var end = this.cursor + length;
  if (end > this.byteArray.length) {
    return new Uint8Array();
  }

  var uint8Array = new Uint8Array(this.byteArray._buffer.slice(this.cursor, end));
  this.cursor += length;

  return new exports.ByteArray(uint8Array);
};

exports.ByteArrayReader.prototype.getString = function(length) {
  var byteArray = this.getBytes(length);
  if (byteArray.length === 0) {
    return '';
  }

  return BinaryUtils.arrayBufferToString(byteArray.buffer);
};

exports.ByteArrayReader.prototype.getValue = function(length) {
  var byteArray = this.getBytes(length);
  if (byteArray.length === 0) {
    return null;
  }

  return uint8ArrayToValue(new Uint8Array(byteArray.buffer));
};

/**
 *  Bit   1-Byte    2-Bytes     3-Bytes     4-Bytes
 *  -----------------------------------------------
 *    0        1        256       65536    16777216
 *    1        2        512      131072    33554432
 *    2        4       1024      262144    67108864
 *    3        8       2048      524288   134217728
 *    4       16       4096     1048576   268435456
 *    5       32       8192     2097152   536870912
 *    6       64      16384     4194304  1073741824
 *    7      128      32768     8388608  2147483648
 *  -----------------------------------------------
 *  Offset     0        255       65535    16777215
 *  Total    255      65535    16777215  4294967295
 */
function valueToUint8Array(value, length) {
  var arrayBuffer = new ArrayBuffer(length);
  var uint8Array = new Uint8Array(arrayBuffer);
  for (var i = length - 1; i >= 0; i--) {
    uint8Array[i] = value & 0xff;
    value = value >> 8;
  }

  return uint8Array;
}

function uint8ArrayToValue(uint8Array) {
  var length = uint8Array.length;
  if (length === 0) {
    return null;
  }

  var value = 0;
  for (var i = 0; i < length; i++) {
    value = value << 8;
    value += uint8Array[i];
  }

  return value;
}
