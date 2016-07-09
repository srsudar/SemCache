require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*jshint esnext:true, bitwise: false */
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

var DEFAULT_SIZE = 512;

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


};

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
};

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
 * Get the ByteArray object as a Uint8Array. This is truncated to the correct
 * size. The ByteArray might be a larger size than necessary, but the
 * Uint8Array is truncated to just the size that is actually used by the
 * ByteArray.
 */
exports.getByteArrayAsUint8Array = function(byteArr) {
  return new Uint8Array(byteArr._buffer, 0, byteArr._cursor);
};

},{"./binary-utils":"binaryUtils"}],2:[function(require,module,exports){
/*jshint esnext:true*/
/*exported ByteArray*/
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

'use strict';

exports.ByteArray = (function() {

var BinaryUtils = require('./binary-utils');

function ByteArray(maxBytesOrData) {
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

  this._buffer = new ArrayBuffer(maxBytesOrData || 256);
  this._data = new Uint8Array(this._buffer);
  this._cursor = 0;
}

ByteArray.prototype.constructor = ByteArray;

Object.defineProperty(ByteArray.prototype, 'length', {
  get: function() {
    return this._cursor;
  }
});

Object.defineProperty(ByteArray.prototype, 'buffer', {
  get: function() {
    return this._buffer.slice(0, this._cursor);
  }
});

ByteArray.prototype.push = function(value, length) {
  length = length || 1;

  this.append(valueToUint8Array(value, length));
};

ByteArray.prototype.append = function(data) {
  // Get `data` as a `Uint8Array`
  if (data instanceof ByteArray) {
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

ByteArray.prototype.getReader = function(startByte) {
  return new ByteArrayReader(this, startByte);
};

function ByteArrayReader(byteArray, startByte) {
  this.byteArray = byteArray;
  this.cursor = startByte || 0;
}

ByteArrayReader.prototype.constructor = ByteArrayReader;

Object.defineProperty(ByteArrayReader.prototype, 'eof', {
  get: function() {
    return this.cursor >= this.byteArray.length;
  }
});

ByteArrayReader.prototype.getBytes = function(length) {
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

  return new ByteArray(uint8Array);
};

ByteArrayReader.prototype.getString = function(length) {
  var byteArray = this.getBytes(length);
  if (byteArray.length === 0) {
    return '';
  }

  return BinaryUtils.arrayBufferToString(byteArray.buffer);
};

ByteArrayReader.prototype.getValue = function(length) {
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

return ByteArray;

})();

},{"./binary-utils":"binaryUtils"}],3:[function(require,module,exports){
/*jshint esnext:true*/
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

'use strict';

exports.QUERY_RESPONSE_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  RESPONSE    : 1       // RFC 1035 - Reponse
});

exports.OPERATION_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  IQUERY      : 1,      // RFC 1035 - Inverse Query
  STATUS      : 2,      // RFC 1035 - Status
  NOTIFY      : 4,      // RFC 1996 - Notify
  UPDATE      : 5       // RFC 2136 - Update
});

exports.AUTHORITATIVE_ANSWER_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Authoritative
  YES         : 1       // RFC 1035 - Is Authoritative
});

exports.TRUNCATED_RESPONSE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Truncated
  YES         : 1       // RFC 1035 - Is Truncated
});

exports.RECURSION_DESIRED_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursion Not Desired
  YES         : 1       // RFC 1035 - Recursion Is Desired
});

exports.RECURSION_AVAILABLE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursive Query Support Not Available
  YES         : 1       // RFC 1035 - Recursive Query Support Is Available
});

exports.AUTHENTIC_DATA_CODES = defineType({
  NO          : 0,      // RFC 4035 - Response Has Not Been Authenticated/Verified
  YES         : 1       // RFC 4035 - Response Has Been Authenticated/Verified
});

exports.CHECKING_DISABLED_CODES = defineType({
  NO          : 0,      // RFC 4035 - Authentication/Verification Checking Not Disabled
  YES         : 1       // RFC 4035 - Authentication/Verification Checking Is Disabled
});

exports.RETURN_CODES = defineType({
  NOERROR     : 0,      // RFC 1035 - No Error
  FORMERR     : 1,      // RFC 1035 - Format Error
  SERVFAIL    : 2,      // RFC 1035 - Server Failure
  NXDOMAIN    : 3,      // RFC 1035 - Non-Existent Domain
  NOTIMP      : 4,      // RFC 1035 - Not Implemented
  REFUSED     : 5,      // RFC 1035 - Query Refused
  YXDOMAIN    : 6,      // RFC 2136 - Name Exists when it should not
  YXRRSET     : 7,      // RFC 2136 - RR Set Exists when it should not
  NXRRSET     : 8,      // RFC 2136 - RR Set that should exist does not
  NOTAUTH     : 9,      // RFC 2136 - Server Not Authoritative for zone
  NOTZONE     : 10      // RFC 2136 - NotZone Name not contained in zone
});

exports.CLASS_CODES = defineType({
  IN          : 1,      // RFC 1035 - Internet
  CS          : 2,      // RFC 1035 - CSNET
  CH          : 3,      // RFC 1035 - CHAOS
  HS          : 4,      // RFC 1035 - Hesiod
  NONE        : 254,    // RFC 2136 - None
  ANY         : 255     // RFC 1035 - Any
});

exports.OPTION_CODES = defineType({
  LLQ         : 1,      // RFC ???? - Long-Lived Queries
  UL          : 2,      // RFC ???? - Update Leases
  NSID        : 3,      // RFC ???? - Name Server Identifier
  OWNER       : 4,      // RFC ???? - Owner
  UNKNOWN     : 65535   // RFC ???? - Token
});

exports.RECORD_TYPES = defineType({
  SIGZERO     : 0,      // RFC 2931
  A           : 1,      // RFC 1035
  NS          : 2,      // RFC 1035
  MD          : 3,      // RFC 1035
  MF          : 4,      // RFC 1035
  CNAME       : 5,      // RFC 1035
  SOA         : 6,      // RFC 1035
  MB          : 7,      // RFC 1035
  MG          : 8,      // RFC 1035
  MR          : 9,      // RFC 1035
  NULL        : 10,     // RFC 1035
  WKS         : 11,     // RFC 1035
  PTR         : 12,     // RFC 1035
  HINFO       : 13,     // RFC 1035
  MINFO       : 14,     // RFC 1035
  MX          : 15,     // RFC 1035
  TXT         : 16,     // RFC 1035
  RP          : 17,     // RFC 1183
  AFSDB       : 18,     // RFC 1183
  X25         : 19,     // RFC 1183
  ISDN        : 20,     // RFC 1183
  RT          : 21,     // RFC 1183
  NSAP        : 22,     // RFC 1706
  NSAP_PTR    : 23,     // RFC 1348
  SIG         : 24,     // RFC 2535
  KEY         : 25,     // RFC 2535
  PX          : 26,     // RFC 2163
  GPOS        : 27,     // RFC 1712
  AAAA        : 28,     // RFC 1886
  LOC         : 29,     // RFC 1876
  NXT         : 30,     // RFC 2535
  EID         : 31,     // RFC ????
  NIMLOC      : 32,     // RFC ????
  SRV         : 33,     // RFC 2052
  ATMA        : 34,     // RFC ????
  NAPTR       : 35,     // RFC 2168
  KX          : 36,     // RFC 2230
  CERT        : 37,     // RFC 2538
  DNAME       : 39,     // RFC 2672
  OPT         : 41,     // RFC 2671
  APL         : 42,     // RFC 3123
  DS          : 43,     // RFC 4034
  SSHFP       : 44,     // RFC 4255
  IPSECKEY    : 45,     // RFC 4025
  RRSIG       : 46,     // RFC 4034
  NSEC        : 47,     // RFC 4034
  DNSKEY      : 48,     // RFC 4034
  DHCID       : 49,     // RFC 4701
  NSEC3       : 50,     // RFC ????
  NSEC3PARAM  : 51,     // RFC ????
  HIP         : 55,     // RFC 5205
  SPF         : 99,     // RFC 4408
  UINFO       : 100,    // RFC ????
  UID         : 101,    // RFC ????
  GID         : 102,    // RFC ????
  UNSPEC      : 103,    // RFC ????
  TKEY        : 249,    // RFC 2930
  TSIG        : 250,    // RFC 2931
  IXFR        : 251,    // RFC 1995
  AXFR        : 252,    // RFC 1035
  MAILB       : 253,    // RFC 1035
  MAILA       : 254,    // RFC 1035
  ANY         : 255,    // RFC 1035
  DLV         : 32769   // RFC 4431
});

function defineType(values) {
  function T(value) {
    for (var name in T) {
      if (T[name] === value) {
        return name;
      }
    }

    return null;
  }

  for (var name in values) {
    T[name] = values[name];
  }

  return T;
}

},{}],4:[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSCodes*/
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

'use strict';

exports.DNSCodes = (function() {

const QUERY_RESPONSE_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  RESPONSE    : 1       // RFC 1035 - Reponse
});

const OPERATION_CODES = defineType({
  QUERY       : 0,      // RFC 1035 - Query
  IQUERY      : 1,      // RFC 1035 - Inverse Query
  STATUS      : 2,      // RFC 1035 - Status
  NOTIFY      : 4,      // RFC 1996 - Notify
  UPDATE      : 5       // RFC 2136 - Update
});

const AUTHORITATIVE_ANSWER_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Authoritative
  YES         : 1       // RFC 1035 - Is Authoritative
});

const TRUNCATED_RESPONSE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Not Truncated
  YES         : 1       // RFC 1035 - Is Truncated
});

const RECURSION_DESIRED_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursion Not Desired
  YES         : 1       // RFC 1035 - Recursion Is Desired
});

const RECURSION_AVAILABLE_CODES = defineType({
  NO          : 0,      // RFC 1035 - Recursive Query Support Not Available
  YES         : 1       // RFC 1035 - Recursive Query Support Is Available
});

const AUTHENTIC_DATA_CODES = defineType({
  NO          : 0,      // RFC 4035 - Response Has Not Been Authenticated/Verified
  YES         : 1       // RFC 4035 - Response Has Been Authenticated/Verified
});

const CHECKING_DISABLED_CODES = defineType({
  NO          : 0,      // RFC 4035 - Authentication/Verification Checking Not Disabled
  YES         : 1       // RFC 4035 - Authentication/Verification Checking Is Disabled
});

const RETURN_CODES = defineType({
  NOERROR     : 0,      // RFC 1035 - No Error
  FORMERR     : 1,      // RFC 1035 - Format Error
  SERVFAIL    : 2,      // RFC 1035 - Server Failure
  NXDOMAIN    : 3,      // RFC 1035 - Non-Existent Domain
  NOTIMP      : 4,      // RFC 1035 - Not Implemented
  REFUSED     : 5,      // RFC 1035 - Query Refused
  YXDOMAIN    : 6,      // RFC 2136 - Name Exists when it should not
  YXRRSET     : 7,      // RFC 2136 - RR Set Exists when it should not
  NXRRSET     : 8,      // RFC 2136 - RR Set that should exist does not
  NOTAUTH     : 9,      // RFC 2136 - Server Not Authoritative for zone
  NOTZONE     : 10      // RFC 2136 - NotZone Name not contained in zone
});

const CLASS_CODES = defineType({
  IN          : 1,      // RFC 1035 - Internet
  CS          : 2,      // RFC 1035 - CSNET
  CH          : 3,      // RFC 1035 - CHAOS
  HS          : 4,      // RFC 1035 - Hesiod
  NONE        : 254,    // RFC 2136 - None
  ANY         : 255     // RFC 1035 - Any
});

const OPTION_CODES = defineType({
  LLQ         : 1,      // RFC ???? - Long-Lived Queries
  UL          : 2,      // RFC ???? - Update Leases
  NSID        : 3,      // RFC ???? - Name Server Identifier
  OWNER       : 4,      // RFC ???? - Owner
  UNKNOWN     : 65535   // RFC ???? - Token
});

const RECORD_TYPES = defineType({
  SIGZERO     : 0,      // RFC 2931
  A           : 1,      // RFC 1035
  NS          : 2,      // RFC 1035
  MD          : 3,      // RFC 1035
  MF          : 4,      // RFC 1035
  CNAME       : 5,      // RFC 1035
  SOA         : 6,      // RFC 1035
  MB          : 7,      // RFC 1035
  MG          : 8,      // RFC 1035
  MR          : 9,      // RFC 1035
  NULL        : 10,     // RFC 1035
  WKS         : 11,     // RFC 1035
  PTR         : 12,     // RFC 1035
  HINFO       : 13,     // RFC 1035
  MINFO       : 14,     // RFC 1035
  MX          : 15,     // RFC 1035
  TXT         : 16,     // RFC 1035
  RP          : 17,     // RFC 1183
  AFSDB       : 18,     // RFC 1183
  X25         : 19,     // RFC 1183
  ISDN        : 20,     // RFC 1183
  RT          : 21,     // RFC 1183
  NSAP        : 22,     // RFC 1706
  NSAP_PTR    : 23,     // RFC 1348
  SIG         : 24,     // RFC 2535
  KEY         : 25,     // RFC 2535
  PX          : 26,     // RFC 2163
  GPOS        : 27,     // RFC 1712
  AAAA        : 28,     // RFC 1886
  LOC         : 29,     // RFC 1876
  NXT         : 30,     // RFC 2535
  EID         : 31,     // RFC ????
  NIMLOC      : 32,     // RFC ????
  SRV         : 33,     // RFC 2052
  ATMA        : 34,     // RFC ????
  NAPTR       : 35,     // RFC 2168
  KX          : 36,     // RFC 2230
  CERT        : 37,     // RFC 2538
  DNAME       : 39,     // RFC 2672
  OPT         : 41,     // RFC 2671
  APL         : 42,     // RFC 3123
  DS          : 43,     // RFC 4034
  SSHFP       : 44,     // RFC 4255
  IPSECKEY    : 45,     // RFC 4025
  RRSIG       : 46,     // RFC 4034
  NSEC        : 47,     // RFC 4034
  DNSKEY      : 48,     // RFC 4034
  DHCID       : 49,     // RFC 4701
  NSEC3       : 50,     // RFC ????
  NSEC3PARAM  : 51,     // RFC ????
  HIP         : 55,     // RFC 5205
  SPF         : 99,     // RFC 4408
  UINFO       : 100,    // RFC ????
  UID         : 101,    // RFC ????
  GID         : 102,    // RFC ????
  UNSPEC      : 103,    // RFC ????
  TKEY        : 249,    // RFC 2930
  TSIG        : 250,    // RFC 2931
  IXFR        : 251,    // RFC 1995
  AXFR        : 252,    // RFC 1035
  MAILB       : 253,    // RFC 1035
  MAILA       : 254,    // RFC 1035
  ANY         : 255,    // RFC 1035
  DLV         : 32769   // RFC 4431
});

function defineType(values) {
  function T(value) {
    for (var name in T) {
      if (T[name] === value) {
        return name;
      }
    }

    return null;
  }

  for (var name in values) {
    T[name] = values[name];
  }

  return T;
}

var DNSCodes = {
  QUERY_RESPONSE_CODES        : QUERY_RESPONSE_CODES,
  OPERATION_CODES             : OPERATION_CODES,
  AUTHORITATIVE_ANSWER_CODES  : AUTHORITATIVE_ANSWER_CODES,
  TRUNCATED_RESPONSE_CODES    : TRUNCATED_RESPONSE_CODES,
  RECURSION_DESIRED_CODES     : RECURSION_DESIRED_CODES,
  RECURSION_AVAILABLE_CODES   : RECURSION_AVAILABLE_CODES,
  AUTHENTIC_DATA_CODES        : AUTHENTIC_DATA_CODES,
  CHECKING_DISABLED_CODES     : CHECKING_DISABLED_CODES,
  RETURN_CODES                : RETURN_CODES,
  CLASS_CODES                 : CLASS_CODES,
  OPTION_CODES                : OPTION_CODES,
  RECORD_TYPES                : RECORD_TYPES
};

return DNSCodes;

})();

},{}],5:[function(require,module,exports){
/*jshint esnext:true, bitwise:false */

/**
 * Represents a DNS packet.
 *
 * The structure of the packet is based on the information in 'TCP/IP
 * Illustrated, Volume 1: The Protocols' by Stevens.
 */
'use strict';

var resRec = require('./resource-record');
var dnsCodes = require('./dns-codes-sem');
var byteArray = require('./byte-array-sem');
var qSection = require('./question-section');

var MAX_ID = 65535;
var MAX_OPCODE = 15;
var MAX_RETURN_CODE = 15;

var NUM_OCTETS_ID = 2;
var NUM_OCTETS_FLAGS = 2;
var NUM_OCTETS_SECTION_LENGTHS = 2;

/**
 * Parse numRecords Resource Records from a ByteArrayReader object. Returns an
 * array of resource record objects.
 */
function parseResourceRecordsFromReader(reader, numRecords) {
  var result = [];
  for (var i = 0; i < numRecords; i++) {
    var recordType = resRec.peekTypeInReader(reader);

    var record = null;
    switch (recordType) {
      case dnsCodes.RECORD_TYPES.A:
        record = resRec.createARecordFromReader(reader); 
        break;
      case dnsCodes.RECORD_TYPES.PTR:
        record = resRec.createPtrRecordFromReader(reader); 
        break;
      case dnsCodes.RECORD_TYPES.SRV:
        record = resRec.createSrvRecordFromReader(reader); 
        break;
      default:
        throw new Error('Unsupported record type: ' + recordType);
    }

    result.push(record);
  }

  return result;
}

/**
 * Create a DNS packet. This creates the packet with various flag values. The
 * packet is not converted to byte format until a call is made to
 * getAsByteArray().
 *
 * id: a 2-octet identifier for the packet
 * isQuery: true if packet is a query, false if it is a response
 * opCode: a 4-bit field. 0 is a standard query
 * isAuthoritativeAnswer: true if the response is authoritative for the domain
 *   in the question section
 * isTruncated: true if the reply is truncated
 * recursionIsDesired: true if recursion is desired
 * recursionAvailable: true or recursion is available
 * returnCode: a 4-bit field. 0 is no error and 3 is a name error. Name errors
 *   are returned only from the authoritative name server and means the domain
 *   name specified does not exist
 */
exports.DnsPacket = function DnsPacket(
  id,
  isQuery,
  opCode,
  isAuthorativeAnswer,
  isTruncated,
  recursionDesired,
  recursionAvailable,
  returnCode
) {
  if (!(this instanceof DnsPacket)) {
    throw new Error('DnsPacket must be called with new');
  }

  // The ID must fit in two bytes.
  if (id < 0 || id > MAX_ID) {
    throw new Error('DNS Packet ID is < 0 or > ' + MAX_ID +': ' + id);
  }
  this.id = id;

  this.isQuery = isQuery ? true : false;

  if (opCode < 0 || opCode > MAX_OPCODE) {
    throw new Error(
      'DNS Packet opCode is < 0 or > ' +
        MAX_OPCODE +
        ': ' +
        opCode
    );
  }
  this.opCode = opCode;

  this.isAuthorativeAnswer = isAuthorativeAnswer ? true : false;
  this.isTruncated = isTruncated ? true : false;
  this.recursionDesired = recursionDesired ? true : false;
  this.recursionAvailable = recursionAvailable ? true : false;

  if (returnCode < 0 || returnCode > MAX_RETURN_CODE) {
    throw new Error('DNS Packet returnCode is < 0 or > ' +
      MAX_RETURN_CODE +
      ': ' +
      returnCode
    );
  }
  this.returnCode = returnCode;

  this.questions = [];
  this.answers = [];
  this.authority = [];
  this.additionalInfo = [];
};

/**
 * Convert the DnsPacket to a ByteArray object. The format of a DNS Packet is
 * as specified in 'TCP/IP Illustrated, Volume 1' by Stevens, as follows:
 *
 * 2 octet ID
 *
 * 2 octet flags (see dns-util)
 *
 * 2 octet number of question sections
 *
 * 2 octet number of answer Resource Records (RRs)
 *
 * 2 octet number of authority RRs
 *
 * 2 octet number of additional info RRs
 *
 * Variable number of bytes representing the questions
 *
 * Variable number of bytes representing the answers
 *
 * Variable number of bytes representing authorities
 *
 * Variable number of bytes representing additional info
 */
exports.DnsPacket.prototype.convertToByteArray = function() {
  var result = new byteArray.ByteArray();

  result.push(this.id, NUM_OCTETS_ID);

  // Prepare flags to be passed to getFlagsAsValue
  var qr = this.isQuery ? 0 : 1;  // 0 means query, 1 means response
  var opcode = this.opCode;
  var aa = this.isAuthorativeAnswer ? 1 : 0;
  var tc = this.isTruncated ? 1 : 0;
  var rd = this.recursionDesired ? 1 : 0;
  var ra = this.recursionAvailable ? 1 : 0;
  var rcode = this.returnCode;

  var flagValue = exports.getFlagsAsValue(qr, opcode, aa, tc, rd, ra, rcode);
  result.push(flagValue, NUM_OCTETS_FLAGS);

  result.push(this.questions.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.answers.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.authority.length, NUM_OCTETS_SECTION_LENGTHS);
  result.push(this.additionalInfo.length, NUM_OCTETS_SECTION_LENGTHS);

  // We should have now met the requirement of adding 12 bytes to a DNS header.
  if (result.length !== 12) {
    throw new Error(
      'Problem serializing DNS packet. Header length != 12 bytes'
    );
  }

  this.questions.forEach(question => {
    var byteArr = question.convertToByteArray();
    result.append(byteArr);
  });

  this.answers.forEach(answer => {
    var byteArr = answer.convertToByteArray();
    result.append(byteArr);
  });

  this.authority.forEach(authority => {
    var byteArr = authority.convertToByteArray();
    result.append(byteArr);
  });

  this.additionalInfo.forEach(info => {
    var byteArr = info.convertToByteArray();
    result.append(byteArr);
  });

  return result;
};

/**
 * Create a DNS Packet from a ByteArrayReader object. The contents of the
 * reader are as expected to be output from convertToByteArray().
 */
exports.createPacketFromReader = function(reader) {
  var id = reader.getValue(NUM_OCTETS_ID);
  var flagsAsValue = reader.getValue(NUM_OCTETS_FLAGS);
  var numQuestions = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAnswers = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAuthority = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);
  var numAdditionalInfo = reader.getValue(NUM_OCTETS_SECTION_LENGTHS);

  var flags = exports.getValueAsFlags(flagsAsValue);

  var opCode = flags.opcode;
  var returnCode = flags.rcode;

  // 0 means it is a query, 1 means it is a response.
  var isQuery;
  if (flags.qr === 0) {
    isQuery = true;
  } else {
    isQuery = false;
  }

  // The non-QR flags map more readily to 0/1 = false/true, so we will use
  // ternary operators.
  var isAuthorativeAnswer = flags.aa ? true : false;
  var isTruncated = flags.tc ? true : false;
  var recursionDesired = flags.rd ? true : false;
  var recursionAvailable = flags.ra ? true : false;


  var result = new exports.DnsPacket(
    id,
    isQuery,
    opCode,
    isAuthorativeAnswer,
    isTruncated,
    recursionDesired,
    recursionAvailable,
    returnCode
  );

  for (var i = 0; i < numQuestions; i++) {
    var question = qSection.createQuestionFromReader(reader);
    result.addQuestion(question);
  }

  var answers = parseResourceRecordsFromReader(reader, numAnswers);
  var authorities = parseResourceRecordsFromReader(reader, numAuthority);
  var infos = parseResourceRecordsFromReader(reader, numAdditionalInfo);

  answers.forEach(answer => {
    result.addAnswer(answer);
  });
  authorities.forEach(authority => {
    result.addAuthority(authority);
  });
  infos.forEach(info => {
    result.addAdditionalInfo(info);
  });

  return result;
};

/**
 * Add a question resource to the DNS Packet.
 *
 * question must be a QuestionSection object.
 */
exports.DnsPacket.prototype.addQuestion = function(question) {
  if (!(question instanceof qSection.QuestionSection)) {
    throw new Error('question must be a QuestionSection but was: ' + question);
  }
  this.questions.push(question);
};

/**
 * Add a Resource Record to the answer section.
 */
exports.DnsPacket.prototype.addAnswer = function(resourceRecord) {
  this.answers.push(resourceRecord);
};

/**
 * Add a Resource Record to the authority section.
 */
exports.DnsPacket.prototype.addAuthority = function(resourceRecord) {
  this.authority.push(resourceRecord);
};

/**
 * Add a Resource Record to the additional info section.
 */
exports.DnsPacket.prototype.addAdditionalInfo = function(resourceRecord) {
  this.additionalInfo.push(resourceRecord);
};

/**
 * Convert the given value (in 16 bits) to an object containing the DNS header
 * flags. The returned object will have the following properties: qr, opcdoe,
 * aa, tc, rd, ra, rcode.
 */
exports.getValueAsFlags = function(value) {
  var qr = (value & 0x8000) >> 15;
  var opcode = (value & 0x7800) >> 11;
  var aa = (value & 0x0400) >> 10;
  var tc = (value & 0x0200) >> 9;
  var rd = (value & 0x0100) >> 8;
  var ra = (value & 0x0080) >> 7;
  var rcode = (value & 0x000f) >> 0;

  return {
    qr: qr,
    opcode: opcode,
    aa: aa,
    tc: tc,
    rd: rd,
    ra: ra,
    rcode: rcode
  };
};

/**
 * Convert DNS packet flags to a value that represents the flags (using bitwise
 * operators), fitting in the last 16 bits. All parameters must be numbers.
 *
 * qr: 0 if it is a query, 1 if it is a response
 * opcode: 0 for a standard query
 * aa: 1 if it is authoritative, else 0
 * tc: 1 if truncated
 * rd: 1 if recursion desired
 * ra: 1 if recursion available
 * rcode: 4-bit return code field. 0 for no error, 3 for name error (if this is
 *   the authoritative name server and the name does not exist)
 */
exports.getFlagsAsValue = function(qr, opcode, aa, tc, rd, ra, rcode) {
  var value = 0x0000;

  value = value << 1;
  value += qr & 0x01;

  value = value << 4;
  value += opcode & 0x0f;

  value = value << 1;
  value += aa & 0x01;

  value = value << 1;
  value += tc & 0x01;

  value = value << 1;
  value += rd & 0x01;

  value = value << 1;
  value += ra & 0x01;

  // These three bits are reserved for future use and must be set to 0.
  value = value << 3;

  value = value << 4;
  value += rcode & 0x0f;

  return value;
};

},{"./byte-array-sem":1,"./dns-codes-sem":3,"./question-section":13,"./resource-record":14}],6:[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSPacket*/
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

'use strict';

exports.DNSPacket = (function() {

var DNSRecord         = require('./dns-record');
var DNSResourceRecord = require('./dns-resource-record');
var DNSUtils          = require('./dns-utils');

var ByteArray         = require('./byte-array');

const DNS_PACKET_RECORD_SECTION_TYPES = [
  'QD', // Question
  'AN', // Answer
  'NS', // Authority
  'AR'  // Additional
];

/**
 * DNS Packet Structure
 * *************************************************
 *
 * Header
 * ======
 *
 * 00                   2-Bytes                   15
 * -------------------------------------------------
 * |00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|
 * -------------------------------------------------
 * |<==================== ID =====================>|
 * |QR|<== OP ===>|AA|TC|RD|RA|UN|AD|CD|<== RC ===>|
 * |<================== QDCOUNT ==================>|
 * |<================== ANCOUNT ==================>|
 * |<================== NSCOUNT ==================>|
 * |<================== ARCOUNT ==================>|
 * -------------------------------------------------
 *
 * ID:        2-Bytes
 * FLAGS:     2-Bytes
 *  - QR:     1-Bit
 *  - OP:     4-Bits
 *  - AA:     1-Bit
 *  - TC:     1-Bit
 *  - RD:     1-Bit
 *  - RA:     1-Bit
 *  - UN:     1-Bit
 *  - AD:     1-Bit
 *  - CD:     1-Bit
 *  - RC:     4-Bits
 * QDCOUNT:   2-Bytes
 * ANCOUNT:   2-Bytes
 * NSCOUNT:   2-Bytes
 * ARCOUNT:   2-Bytes
 *
 *
 * Data
 * ====
 *
 * 00                   2-Bytes                   15
 * -------------------------------------------------
 * |00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|
 * -------------------------------------------------
 * |<???=============== QD[...] ===============???>|
 * |<???=============== AN[...] ===============???>|
 * |<???=============== NS[...] ===============???>|
 * |<???=============== AR[...] ===============???>|
 * -------------------------------------------------
 *
 * QD:        ??-Bytes
 * AN:        ??-Bytes
 * NS:        ??-Bytes
 * AR:        ??-Bytes
 *
 *
 * Question Record
 * ===============
 *
 * 00                   2-Bytes                   15
 * -------------------------------------------------
 * |00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|
 * -------------------------------------------------
 * |<???================ NAME =================???>|
 * |<=================== TYPE ====================>|
 * |<=================== CLASS ===================>|
 * -------------------------------------------------
 *
 * NAME:      ??-Bytes
 * TYPE:      2-Bytes
 * CLASS:     2-Bytes
 *
 *
 * Resource Record
 * ===============
 *
 * 00                   4-Bytes                   31
 * -------------------------------------------------
 * |00|02|04|06|08|10|12|14|16|18|20|22|24|26|28|30|
 * -------------------------------------------------
 * |<???================ NAME =================???>|
 * |<======= TYPE ========>|<======= CLASS =======>|
 * |<==================== TTL ====================>|
 * |<====== DATALEN ======>|<???==== DATA =====???>|
 * -------------------------------------------------
 *
 * NAME:      ??-Bytes
 * TYPE:      2-Bytes
 * CLASS:     2-Bytes
 * DATALEN:   2-Bytes
 * DATA:      ??-Bytes (Specified By DATALEN)
 */
function DNSPacket(byteArray) {
  this.flags = DNSUtils.valueToFlags(0x0000);
  this.records = {};

  DNSPacket.RECORD_SECTION_TYPES.forEach((recordSectionType) => {
    this.records[recordSectionType] = [];
  });

  if (!byteArray) {
    return this;
  }

  var reader = byteArray.getReader();

  if (reader.getValue(2) !== 0x0000) {
    throw new Error('Packet must start with 0x0000');
  }

  this.flags = DNSUtils.valueToFlags(reader.getValue(2));

  var recordCounts = {};

  // Parse the record counts.
  DNSPacket.RECORD_SECTION_TYPES.forEach((recordSectionType) => {
    recordCounts[recordSectionType] = reader.getValue(2);
  });

  // Parse the actual records.
  DNSPacket.RECORD_SECTION_TYPES.forEach((recordSectionType) => {
    iterate(recordCounts[recordSectionType], () => {
      var record;

      if (recordSectionType === 'QD') {
        record = DNSRecord.parseFromPacketReader(reader);
        this.addRecord(recordSectionType, record);
      }

      else {
        record = DNSResourceRecord.parseFromPacketReader(reader);
        this.addRecord(recordSectionType, record);
      }
    });
  });

  if (!reader.eof) {
    console.warn('Did not complete parsing packet data');
  }
}

DNSPacket.RECORD_SECTION_TYPES = DNS_PACKET_RECORD_SECTION_TYPES;

DNSPacket.prototype.constructor = DNSPacket;

DNSPacket.prototype.addRecord = function(recordSectionType, record) {
  console.log('Adding record');
  console.log('    Record section type: ', recordSectionType);
  console.log('    record; ', record);
  record.packet = this;
  this.records[recordSectionType].push(record);
};

DNSPacket.prototype.getRecords = function(recordSectionType) {
  return this.records[recordSectionType];
};

DNSPacket.prototype.serialize = function() {
  var byteArray = new ByteArray();

  // Write leading 0x0000 (2 bytes)
  byteArray.push(0x0000, 2);

  // Write `flags` (2 bytes)
  byteArray.push(DNSUtils.flagsToValue(this.flags), 2);

  // Write lengths of record sections (2 bytes each)
  DNSPacket.RECORD_SECTION_TYPES.forEach((recordSectionType) => {
    byteArray.push(this.records[recordSectionType].length, 2);
  });

  // Write records
  DNSPacket.RECORD_SECTION_TYPES.forEach((recordSectionType) => {
    this.records[recordSectionType].forEach((record) => {
      byteArray.append(record.serialize());
    });
  });

  return byteArray.buffer;
};

function iterate(count, iterator) {
  for (var i = 0; i < count; i++) {
    iterator(i);
  }
}

return DNSPacket;

})();

},{"./byte-array":2,"./dns-record":7,"./dns-resource-record":8,"./dns-utils":10}],7:[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSRecord*/
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

'use strict';

exports.DNSRecord = (function() {

var DNSCodes  = require('./dns-codes');
var DNSUtils  = require('./dns-utils');

var ByteArray = require('./byte-array');

/**
 * This is common functionality shared between both resource records (RRs) and
 * questions entries. For this reason it includes query name, query type, and
 * query class, but not TTL. TTL is present in RRs but not in questions.
 */
function DNSRecord(properties) {
  if (properties) {
    for (var property in properties) {
      this[property] = properties[property];
    }
  }

  this.name       = this.name       || '';
  this.recordType = this.recordType || DNSCodes.RECORD_TYPES.ANY;
  this.classCode  = this.classCode  || DNSCodes.CLASS_CODES.IN;
}

DNSRecord.parseFromPacketReader = function(reader) {
  var name       = DNSUtils.byteArrayReaderToLabel(reader);
  var recordType = reader.getValue(2);
  var classCode  = reader.getValue(2);

  return new this({
    name: DNSUtils.decompressLabel(name, reader.byteArray),
    recordType: recordType,
    classCode: classCode
  });
};

DNSRecord.prototype.constructor = DNSRecord;

DNSRecord.prototype.serialize = function() {
  var byteArray = new ByteArray();
  
  // Write `name` (ends with trailing 0x00 byte)
  byteArray.append(DNSUtils.labelToByteArray(this.name));
  byteArray.push(0x00);
  
  // Write `recordType` (2 bytes)
  byteArray.push(this.recordType, 2);

  // Write `classCode` (2 bytes)
  byteArray.push(this.classCode, 2);

  return byteArray;
};

return DNSRecord;

})();

},{"./byte-array":2,"./dns-codes":4,"./dns-utils":10}],8:[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSResourceRecord*/
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

'use strict';

exports.DNSResourceRecord = (function() {

var dnsRecord   = require('./dns-record');
var DNSCodes    = require('./dns-codes');
var DNSUtils    = require('./dns-utils');

var ByteArray   = require('./byte-array');

const DNS_RESOURCE_RECORD_DEFAULT_TTL = 10; // 10 seconds
// const DNS_RESOURCE_RECORD_DEFAULT_TTL = 3600; // 1 hour

/**
 * This corresponds to a resource record (RR) as outlined in the DNS spec. This
 * includes answers, authorities, and additional information.
 */
function DNSResourceRecord(properties) {
  dnsRecord.call(this, properties);

  this.ttl  = this.ttl  || DNS_RESOURCE_RECORD_DEFAULT_TTL;
  this.data = this.data || null;
}

DNSResourceRecord.parseFromPacketReader = function(reader) {
  var record = dnsRecord.parseFromPacketReader.call(this, reader);

  var ttl  = reader.getValue(4);
  var data = reader.getBytes(reader.getValue(2));

  switch (record.recordType) {
    case DNSCodes.RECORD_TYPES.A:
      console.log('not yet handling A records');
      break;
    case DNSCodes.RECORD_TYPES.PTR:
      data = parsePTR(data, reader.byteArray);
      break;
    case DNSCodes.RECORD_TYPES.TXT:
      data = parseTXT(data, reader.byteArray);
      break;
    case DNSCodes.RECORD_TYPES.SRV:
      data = parseSRV(data, data);
      break;
    default:
      console.log(
        'Encountered record type that cannot be deserialized: ',
        record.recordType
      );
      // Do a best effort deserialization
      data = BinaryUtils.arrayBufferToString(data.buffer);
      break;
  }

  record.ttl  = ttl;
  record.data = data;

  return record;
}

DNSResourceRecord.prototype = Object.create(dnsRecord.DNSRecord.prototype);

DNSResourceRecord.prototype.constructor = DNSResourceRecord;

DNSResourceRecord.prototype.serialize = function() {
  var byteArray = dnsRecord.prototype.serialize.call(this);

  // Write `ttl` (4 bytes)
  byteArray.push(this.ttl, 4);

  var data = this.data;

  switch (this.recordType) {
    case DNSCodes.RECORD_TYPES.PTR:
      data = serializePTR(data);
      break;
    case DNSCodes.RECORD_TYPES.TXT:
      data = serializeTXT(data);
      break;
    case DNSCodes.RECORD_TYPES.SRV:
      // SRV records take care of serializing themselves during generation via
      // the generateByteArrayForSRV method.
      data = data;
      break;
    default:
      console.log('Serializing unsupported DNS type: ', this.recordType);
      data = new ByteArray(data);
      break;
  }

  // Write `data` length plus one (2 bytes)
  byteArray.push(data.length + 1, 2);

  // Write `data` (ends with trailing 0x00 byte)
  byteArray.append(data);
  byteArray.push(0x00);

  return byteArray;
};

/**
 * Generate the binary content for the SRV record.
 *
 * The order is specified here in the Wikipedia and RFC documents:
 * https://en.wikipedia.org/wiki/SRV_record
 * https://tools.ietf.org/html/rfc2782
 *
 * serviceProtoName:
 *     This is the service provided, the protocol, and the domain
 *     for which the record is valid. This might be something like
 *     _semcache._http.local .
 * ttl: 
 *     The standard time to live field for DNS.
 * priority: 16 bit unsigned integer
 *     The priority of the target host, lower equals greater priority.
 * weight: 16 bit unsigned integer
 *     When records have the same priority, weight will decide which wins.
 *     Higher values means preferred.
 * port: 16 bit unsigned integer
 *     The port on which the service may be found.
 * target:
 *     The hostname of the machine owning the servce. Wikipedia claims this
 *     should end in a dot, although we are more lenient in this
 *     implementation.
 *
 * The method does not permit a class field, as we assume it will be IN,
 * meaning internet.
 */
DNSResourceRecord.generateByteArrayForSRV = function(
    serviceProtoName,
    ttl,
    priority,
    weight,
    port,
    targetDomain
) {
  if (port < 0 || port > 65535) {
    throw new Error('Port must be > 0 and < 65535, not: ' + port);
  }
  if (priority < 0 || priority > 65535) {
    throw new Error('Priority must be > 0 and < 65535, not: ' + priority);
  }
  if (weight < 0 || weight > 65535) {
    throw new Error('Weight must be > 0 and < 65535, not: ' + weight);
  }

  // We are going to push data into the ByteArray in the following order:
  // serviceProtoName, TTL, class, priority, weight, port, targetDomain
  var result = new ByteArray();

  // serviceProtoName
  var byteSafeName = DNSUtils.labelToByteArray(serviceProtoName);
  result.append(byteSafeName);
 
  // TTL is 4 bytes
  result.push(ttl, 4);

  // class code is 2 bytes
  var internetClassCode = DNSCodes.CLASS_CODES.IN;
  result.push(internetClassCode, 2);

  // priority is 2 bytes
  result.push(priority, 2);

  // weight is two bytes
  result.push(weight, 2);

  // port is two bytes
  result.push(port, 2);

  var byteSafeDomain = DNSUtils.labelToByteArray(targetDomain);
  result.append(byteSafeDomain);

  return result;
}

function parsePTR(data, packetData) {
  var result = DNSUtils.byteArrayToLabel(data);

  return DNSUtils.decompressLabel(result, packetData);
}

function parseSRV(data, packetData) {
  // We're just pulling data back out as it was put in by
  // DNSResourceRecord.generateByteArrayForSRV.

  var packetDataReader = packetData.getReader();

  var serviceProtoName = DNSUtils.byteArrayReaderToLabel(packetDataReader);

  // There is problem here where consuming the reader via the
  // byteArrayReaderToLabel function leads to over-consuming, making off by one
  // problems with parsing packets. -1 byte to correct for this.
  var badCursorIdx = packetDataReader.cursor;
  packetDataReader = packetData.getReader(badCursorIdx - 1);

  var ttl = packetDataReader.getValue(4);
  var classCodeInt = packetDataReader.getValue(2);
  var priority = packetDataReader.getValue(2);
  var weight = packetDataReader.getValue(2);
  var port = packetDataReader.getValue(2);

  var domainName = DNSUtils.byteArrayReaderToLabel(packetDataReader);

  var result = {
    serviceProtoName: serviceProtoName,
    ttl: ttl,
    classCode: classCodeInt,
    priority: priority,
    weight: weight,
    port: port,
    domainName: domainName
  };

  return result;
}

function parseTXT(data, packetData) {
  var result = {};

  console.log('parseTXT');
  console.log('    data: ', data);
  console.log('    packetData: ', packetData);

  var reader = data.getReader();
  var parts = [];

  var partLength;

  while ((partLength = reader.getValue())) {
    // If a length has been specified instead of a pointer,
    // read the string of the specified length.
    if (partLength !== 0xc0) {
      parts.push(reader.getString(partLength));
      continue;
    }

    // TODO: Handle case where we have a pointer to the label
    parts.push(String.fromCharCode(0xc0) + reader.getString());
    break;
  }

  parts.forEach((part) => {
    var pair = DNSUtils.decompressLabel(part, packetData).split('=');
    var name = pair.shift();
    var value = pair.join('=');

    result[name] = value;
  });

  return result;
}

function serializePTR(data) {
  var result = DNSUtils.labelToByteArray(data);

  return result;
}

function serializeTXT(data) {
  var result = new ByteArray();

  for (var name in data) {
    result.push(name.length + data[name].length + 1);
    result.append(BinaryUtils.stringToArrayBuffer(name + '=' + data[name]));
  }

  return result;
}

return DNSResourceRecord;

})();

},{"./byte-array":2,"./dns-codes":4,"./dns-record":7,"./dns-utils":10}],9:[function(require,module,exports){
'use strict';

var byteArray = require('./byte-array-sem');

/**
 * Various methods for common DNS-related operations.
 */

var MAX_LABEL_LENGTH = 63;
var OCTET_LABEL_LENGTH = 1;

exports.DEBUG = true;

exports.DEFAULT_TTL = 10;
exports.DEFAULT_PRIORITY = 0;
exports.DEFAULT_WEIGHT = 0;

/**
 * Return the local suffix, i.e. ".local". The leading dot is included.
 */
exports.getLocalSuffix = function() {
  return '.local';
};

/**
 * Return a random integer between [min, max).
 */
exports.randomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Converts a domain name to a byte array. Despite the name, this can serialize
 * any '.' separated string. _semcache._http.local is not a domain name, eg,
 * but it is serializable in the same fashion. The name 'domain' is retained to
 * be recognizable even to those that are not familiar with the term 'label'
 * that is used in the DNS spec.
 *
 * The DNS protocol specifies that a domain name is serialized as a series of
 * 'labels'. A label is a component of a name between a dot. www.example.com,
 * for example, would consist of three labels: www, example, and com.
 *
 * Labels are serialized by a single byte indicating the length of the bytes to
 * follow, terminated with a 0 byte to indicate there are no additional
 * labels.
 *
 * Labels are limited to 63 bytes.
 */
exports.getDomainAsByteArray = function(domain) {
  var result = new byteArray.ByteArray();

  var labels = domain.split('.');

  labels.forEach(label => {
    var length = label.length;
    if (length > MAX_LABEL_LENGTH) {
      throw new Error('label exceeds max length: ' + label);
    }

    // A label is serialized as a single byte for its length, followed by the
    // character code of each component.
    result.push(length, OCTET_LABEL_LENGTH);

    for (var i = 0; i < label.length; i++) {
      result.push(label.charCodeAt(i), 1);
    }
  });

  // The label is terminated by a 0 byte.
  result.push(0, OCTET_LABEL_LENGTH);

  return result;
};

/**
 * Convert a serialized domain name from its DNS representation to a string.
 * The byteArray should contain bytes as output by getDomainAsByteArray.
 *
 * byteArr: the ByteArray containing the serialized labels
 * startByte: an optional index indicating the start point of the
 *   serialization. If not present, assumes a starting index ov 0.
 */
exports.getDomainFromByteArray = function(byteArr, startByte) {
  if (!(byteArr instanceof byteArray.ByteArray)) {
    throw new Error('byteArr is not type of ByteArray');
  }

  if (!startByte) {
    // If a start byte hasn't been specified, we start at the beginning.
    startByte = 0;
  }

  var reader = byteArr.getReader(startByte);
  
  var result = exports.getDomainFromByteArrayReader(reader, 0);
  return result;
};

/**
 * Convert a serialized domain name from its DNS representation to a string.
 * The reader should contain bytes as output from getDomainAsByteArray.
 *
 * reader: a ByteArrayReader containing the bytes to be deserialized. The
 *   reader will have all the domain bytes consumed.
 */
exports.getDomainFromByteArrayReader = function(reader) {
  var result = '';

  // We expect a series of length charCode pairs, ending when the final length
  // field is a 0. We'll do this by examining a single label at a time.
  var lengthOfCurrentLabel = -1;
  var iteration = 0;
  // Sanity check because while loops are dangerous when faced with outside
  // data.
  var maxIterations = 10;
  while (lengthOfCurrentLabel !== 0) {
    if (iteration > maxIterations) {
      throw new Error('Exceeded max iterations, likely malformed data');
    }

    // Get the first length, consuming the first byte of the reader.
    lengthOfCurrentLabel = reader.getValue(1);

    if (lengthOfCurrentLabel > MAX_LABEL_LENGTH) {
      // This check will try to alert callers when they have an off by one or
      // other error in the byte array.
      throw new Error(
        'Got a label length greater than the max: ' + lengthOfCurrentLabel
      );
    }

    for (var i = 0; i < lengthOfCurrentLabel; i++) {
      var currentCharCode = reader.getValue(1);
      var currentChar = String.fromCharCode(currentCharCode);
      result += currentChar;
    }

    // We've consumed a label unless we're in the last iteration of the while
    // loop, add a '.'.
    if (lengthOfCurrentLabel !== 0) {
      result += '.';
    }

    iteration += 1;
  }

  // Unless we have an empty string, we've added one too many dots due to the
  // fence post problem in the while loop.
  if (result.length > 0) {
    result = result.substring(0, result.length - 1);
  }

  return result;
};

/**
 * Convert a string representation of an IP address to a ByteArray.
 * '155.33.17.68' would return a ByteArray with length 4, corresponding to the
 * bytes 155, 33, 17, 68.
 */
exports.getIpStringAsByteArray = function(ipAddress) {
  var parts = ipAddress.split('.');

  if (parts.length < 4) {
    throw new Error('IP string does not have 4 parts: ' + ipAddress);
  }

  var result = new byteArray.ByteArray();
  
  parts.forEach(part => {
    var intValue = parseInt(part);
    if (intValue < 0 || intValue > 255) {
      throw new Error('A byte of the IP address < 0 or > 255: ' + ipAddress);
    }
    result.push(intValue, 1);
  });

  return result;
};

/**
 * Recover an IP address in string representation from the ByteArrayReader.
 */
exports.getIpStringFromByteArrayReader = function(reader) {
  // We assume a single byte representing each string.
  var parts = [];

  var numParts = 4;
  for (var i = 0; i < numParts; i++) {
    var intValue = reader.getValue(1);
    var stringValue = intValue.toString();
    parts.push(stringValue);
  }

  var result = parts.join('.');
  return result;
};

},{"./byte-array-sem":1}],10:[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSUtils*/
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

'use strict';

exports.DNSUtils = (function() {

var ByteArray   = require('./byte-array');

var DNSUtils = {
  decompressLabel: function(label, byteArray) {
    var result = '';

    for (var i = 0, length = label.length; i < length; i++) {
      if (label.charCodeAt(i) !== 0xc0) {
        result += label.charAt(i);
        continue;
      }

      i++;
      result += this.decompressLabel(
        this.byteArrayToLabel(byteArray, label.charCodeAt(i)),
        byteArray
      );
    }

    return result;
  },

  byteArrayReaderToLabel: function(byteArrayReader) {
    var parts = [];
    var partLength;

    while ((partLength = byteArrayReader.getValue())) {
      // If a length has been specified instead of a pointer,
      // read the string of the specified length.
      if (partLength !== 0xc0) {
        parts.push(byteArrayReader.getString(partLength));
        continue;
      }

      // TODO: Handle case where we have a pointer to the label
      parts.push(String.fromCharCode(0xc0) + byteArrayReader.getString());
      break;
    }

    return parts.join('.');
  },

  byteArrayToLabel: function(byteArray, startByte) {
    return this.byteArrayReaderToLabel(byteArray.getReader(startByte));
  },

  labelToByteArray: function(label) {
    var byteArray = new ByteArray();
    var parts = label.split('.');
    parts.forEach((part) => {
      var length = part.length;
      byteArray.push(length);
      
      for (var i = 0; i < length; i++) {
        byteArray.push(part.charCodeAt(i));
      }
    });

    return byteArray;
  },

  valueToFlags: function(value) {
    return {
      QR: (value & 0x8000) >> 15,
      OP: (value & 0x7800) >> 11,
      AA: (value & 0x0400) >> 10,
      TC: (value & 0x0200) >>  9,
      RD: (value & 0x0100) >>  8,
      RA: (value & 0x0080) >>  7,
      UN: (value & 0x0040) >>  6,
      AD: (value & 0x0020) >>  5,
      CD: (value & 0x0010) >>  4,
      RC: (value & 0x000f) >>  0
    };
  },

  flagsToValue: function(flags) {
    var value = 0x0000;

    value = value << 1;
    value += flags.QR & 0x01;

    value = value << 4;
    value += flags.OP & 0x0f;

    value = value << 1;
    value += flags.AA & 0x01;

    value = value << 1;
    value += flags.TC & 0x01;

    value = value << 1;
    value += flags.RD & 0x01;

    value = value << 1;
    value += flags.RA & 0x01;

    value = value << 1;
    value += flags.UN & 0x01;

    value = value << 1;
    value += flags.AD & 0x01;

    value = value << 1;
    value += flags.CD & 0x01;

    value = value << 4;
    value += flags.RC & 0x0f;

    return value;
  }
};

return DNSUtils;

})();

},{"./byte-array":2}],11:[function(require,module,exports){
/*jshint esnext:true*/
/*exported EventTarget*/
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

'use strict';

exports.EventTarget = (function() {

function EventTarget(object) {
  if (typeof object !== 'object') {
    return;
  }

  for (var property in object) {
    this[property] = object[property];
  }
}

EventTarget.prototype.constructor = EventTarget;

EventTarget.prototype.dispatchEvent = function(name, data) {
  var events    = this._events || {};
  var listeners = events[name] || [];
  listeners.forEach((listener) => {
    listener.call(this, data);
  });
};

EventTarget.prototype.addEventListener = function(name, listener) {
  var events    = this._events = this._events || {};
  var listeners = events[name] = events[name] || [];
  if (listeners.find(fn => fn === listener)) {
    return;
  }

  listeners.push(listener);
};

EventTarget.prototype.removeEventListener = function(name, listener) {
  var events    = this._events || {};
  var listeners = events[name] || [];
  for (var i = listeners.length - 1; i >= 0; i--) {
    if (listeners[i] === listener) {
      listeners.splice(i, 1);
      return;
    }
  }
};

return EventTarget;

})();

},{}],12:[function(require,module,exports){
/*jshint esnext:true*/
/*exported IPUtils*/
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

'use strict';

exports.IPUtils = (function() {

const CRLF = '\r\n';

var IPUtils = {
  getAddresses: function(callback) {
    if (typeof callback !== 'function') {
      console.warn('No callback provided');
      return;
    }

    var addresses = {
      '0.0.0.0': true
    };

    var rtc = new mozRTCPeerConnection({ iceServers: [] });
    rtc.createDataChannel('', { reliable: false });

    rtc.onicecandidate = function(evt) {
      if (evt.candidate) {
        parseSDP('a=' + evt.candidate.candidate);
      }
    };

    rtc.createOffer((description) => {
      parseSDP(description.sdp);
      rtc.setLocalDescription(description, noop, noop);
    }, (error) => {
      console.warn('Unable to create offer', error);
    });

    function addAddress(address) {
      if (addresses[address]) {
        return;
      }

      addresses[address] = true;
      callback(address);
    }

    function parseSDP(sdp) {
      sdp.split(CRLF).forEach((line) => {
        var parts = line.split(' ');

        if (line.indexOf('a=candidate') !== -1) {
          if (parts[7] === 'host') {
            addAddress(parts[4]);
          }
        }

        else if (line.indexOf('c=') !== -1) {
          addAddress(parts[2]);
        }
      });
    }
  }
};

function noop() {}

return IPUtils;

})();

},{}],13:[function(require,module,exports){
/* global exports, require */
'use strict';

var byteArray = require('./byte-array-sem');
var dnsUtil = require('./dns-util');

var NUM_OCTETS_QUERY_TYPE = 2;
var NUM_OCTETS_QUERY_CLASS = 2;

var MAX_QUERY_TYPE = 65535;
var MAX_QUERY_CLASS = 65535;

/**
 * A DNS Question section.
 */
exports.QuestionSection = function QuestionSection(qName, qType, qClass) {
  if (!(this instanceof QuestionSection)) {
    throw new Error('QuestionSection must be called with new');
  }

  if (qType < 0 || qType > MAX_QUERY_TYPE) {
    throw new Error(
      'query type must be > 0 and < ' +
        MAX_QUERY_TYPE +
        ': ' +
        qType
    );
  }

  if (qClass < 0 || qClass > MAX_QUERY_CLASS) {
    throw new Error(
      'query class must be > 0 and < ' +
        MAX_QUERY_CLASS +
        ': ' +
        qClass
    );
  }

  this.queryName = qName;
  this.queryType = qType;
  this.queryClass = qClass;
};

/**
 * Convert the QuestionSection to a ByteArray object. According to 'TCP/IP
 * Illustrated, Volume 1' by Stevens, the format of the question section is as
 * follows:
 *
 * variable number of octets representing the query name
 *
 * 2 octets representing the query type
 *
 * 2 octets representing the query class
 */
exports.QuestionSection.prototype.convertToByteArray = function() {
  var result = new byteArray.ByteArray();
  
  var queryAsBytes = dnsUtil.getDomainAsByteArray(this.queryName);
  result.append(queryAsBytes);

  result.push(this.queryType, NUM_OCTETS_QUERY_TYPE);
  result.push(this.queryClass, NUM_OCTETS_QUERY_CLASS);

  return result;
};

/**
 * Create a QuestionSection from a ByteArrayReader as serialized by
 * convertToByteArray().
 */
exports.createQuestionFromReader = function(reader) {
  var queryName = dnsUtil.getDomainFromByteArrayReader(reader);

  var queryType = reader.getValue(NUM_OCTETS_QUERY_TYPE);
  if (queryType < 0 || queryType > MAX_QUERY_TYPE) {
    throw new Error('deserialized query type out of range: ' + queryType);
  }

  var queryClass = reader.getValue(NUM_OCTETS_QUERY_CLASS);
  if (queryClass < 0 || queryClass > MAX_QUERY_CLASS) {
    throw new Error('deserialized query class out of range: ' + queryClass);
  }

  var result = new exports.QuestionSection(queryName, queryType, queryClass);

  return result;
};

},{"./byte-array-sem":1,"./dns-util":9}],14:[function(require,module,exports){
/* global exports, require */
'use strict';

var byteArray = require('./byte-array-sem');
var dnsUtil = require('./dns-util');

var NUM_OCTETS_TYPE = 2;
var NUM_OCTETS_CLASS = 2;
var NUM_OCTETS_TTL = 4;
var NUM_OCTETS_RESOURCE_DATA_LENGTH = 2;

/** An A Record has for bytes, all representing an IP address. */
var NUM_OCTETS_RESOURCE_DATA_A_RECORD = 4;

var NUM_OCTETS_PRIORITY = 2;
var NUM_OCTETS_WEIGHT = 2;
var NUM_OCTETS_PORT = 2;

/**
 * A resource record (RR) is a component of a DNS message. They share a similar
 * structure but contain different information.
 *
 * Each resource record begins with a domain name, which can be a variable
 * number of bytes.
 *
 * Then is a 2-octet type (e.g. A, SRV, etc).
 *
 * Then is a 2-octet class (e.g. IN for internet).
 *
 * Then is a 4-octet TTL.
 *
 * Then is a variable number of bytes representing the data in record. The
 * first 2-octets are the length of the following data. The structure of that
 * data depends on the type of the record.
 *
 * Information here is based on 'TCP/IP Illustrated, Volume 1' by Stevens and
 * on the Bonjour Overview page provided by Apple:
 *
 * https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/NetServices/Articles/NetServicesArchitecture.html#//apple_ref/doc/uid/20001074-SW1
 */

var dnsCodes = require('./dns-codes-sem');

/**
 * An A record. A records respond to queries for a domain name to an IP
 * address.
 *
 * domainName: the domain name, e.g. www.example.com
 * ttl: the time to live
 * ipAddress: the IP address of the domainName. This must be a string
 *   representation (e.g. '192.3.34.17').
 * recordClass: the class of the record type. This is optional, and if not
 *   present or is not truthy will be set as IN for internet traffic.
 */
exports.ARecord = function ARecord(
  domainName,
  ttl,
  ipAddress,
  recordClass
) {
  if (!(this instanceof ARecord)) {
    throw new Error('ARecord must be called with new');
  }

  if ((typeof ipAddress) !== 'string') {
    throw new Error('ipAddress must be a String: ' + ipAddress);
  }
  
  if (!recordClass) {
    recordClass = dnsCodes.CLASS_CODES.IN;
  }

  this.recordType = dnsCodes.RECORD_TYPES.A;
  this.recordClass = recordClass;

  this.domainName = domainName;
  this.ttl = ttl;
  this.ipAddress = ipAddress;
};

/**
 * Get the A Record as a ByteArray object.
 *
 * The DNS spec indicates that an A Record is represented in byte form as
 * follows.
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the number 4, to indicate that 4 bytes follow.
 *
 * 4 octets representing a 4-byte IP address
 */
exports.ARecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.domainName,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  // First we add the length of the resource data.
  result.push(
    NUM_OCTETS_RESOURCE_DATA_A_RECORD, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the IP address itself.
  var ipStringAsBytes = dnsUtil.getIpStringAsByteArray(this.ipAddress);
  result.append(ipStringAsBytes);

  return result;
};

/**
 * Create an A Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the domain name of the A Record.
 */
exports.createARecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.A) {
    throw new Error(
      'De-serialized A Record does not have A Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);

  // For an A Record this should always be 4.
  if (resourceLength !== NUM_OCTETS_RESOURCE_DATA_A_RECORD) {
    throw new Error(
      'Recovered resource length does not match expected value for A ' +
        '  Record: ' +
        resourceLength
    );
  }

  var ipString = dnsUtil.getIpStringFromByteArrayReader(reader);

  var result = new exports.ARecord(
    commonFields.domainName,
    commonFields.ttl,
    ipString,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create a PTR Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the PTR Record.
 */
exports.createPtrRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.PTR) {
    throw new Error(
      'De-serialized PTR Record does not have PTR Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of PTR Record resource data: ' +
        resourceLength);
  }

  // In a PTR Record, the domain name field of the RR is actually the service
  // type (at least for mDNS).
  var serviceType = commonFields.domainName;
  var serviceName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.PtrRecord(
    serviceType,
    commonFields.ttl,
    serviceName,
    commonFields.rrClass
  );

  return result;
};

/**
 * Create an SRV Record from a ByteArrayReader object. The reader should be at
 * the correct cursor position, at the service type query of the SRV Record.
 */
exports.createSrvRecordFromReader = function(reader) {
  var commonFields = exports.getCommonFieldsFromByteArrayReader(reader);

  if (commonFields.rrType !== dnsCodes.RECORD_TYPES.SRV) {
    throw new Error(
      'De-serialized SRV Record does not have SRV Record type: ' + 
        commonFields.rrType
    );
  }

  // And now we recover just the resource length and resource data.
  var resourceLength = reader.getValue(NUM_OCTETS_RESOURCE_DATA_LENGTH);
  if (resourceLength < 0 || resourceLength > 65535) {
    throw new Error(
      'Illegal length of SRV Record resource data: ' +
        resourceLength);
  }

  // In a SRV Record, the domain name field of the RR is actually the service
  // proto name.
  var serviceInstanceName = commonFields.domainName;
  
  // After the common fields, we expect priority, weight, port, target name.
  var priority = reader.getValue(NUM_OCTETS_PRIORITY);
  if (priority < 0 || priority > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + priority);
  }

  var weight = reader.getValue(NUM_OCTETS_WEIGHT);
  if (weight < 0 || weight > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + weight);
  }

  var port = reader.getValue(NUM_OCTETS_PORT);
  if (port < 0 || port > 65535) {
    throw new Error('Illegal length of SRV Record priority: ' + port);
  }

  var targetName = dnsUtil.getDomainFromByteArrayReader(reader);

  var result = new exports.SrvRecord(
    serviceInstanceName,
    commonFields.ttl,
    priority,
    weight,
    port,
    targetName
  );

  return result;
};

/**
 * A PTR record. PTR records respond to a query for a service type (eg
 * '_printer._tcp.local'. They return the name of an instance offering the
 * service (eg 'Printsalot._printer._tcp.local').
 *
 * serviceType: the string representation of the service that has been queried
 *   for.
 * ttl: the time to live
 * instanceName: the name of the instance providing the serviceType
 * rrClass: the class of the record. If not truthy, will be set to IN for
 *   internet traffic.
 */
exports.PtrRecord = function PtrRecord(
  serviceType,
  ttl,
  instanceName,
  rrClass
) {
  if (!(this instanceof PtrRecord)) {
    throw new Error('PtrRecord must be called with new');
  }

  if ((typeof serviceType) !== 'string') {
    throw new Error('serviceType must be a String: ' + serviceType);
  }
  
  if ((typeof instanceName) !== 'string') {
    throw new Error('instanceName must be a String: ' + instanceName);
  }

  if (!rrClass) {
    rrClass = dnsCodes.CLASS_CODES.IN;
  }
  
  this.recordType = dnsCodes.RECORD_TYPES.PTR;
  this.recordClass = rrClass;

  this.serviceType = serviceType;
  this.ttl = ttl;
  this.instanceName = instanceName;
};

/**
 * Get the PTR Record as a ByteArray object.
 *
 * The DNS spec indicates that an PTR Record is represented in byte form as
 * follows. (Using this and section 3.3.12 as a guide:
 * https://www.ietf.org/rfc/rfc1035.txt).
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * A variable number of octets representing "the domain-name, which points to
 * some location in the domain name space". In the context of mDNS, this would
 * be the name of the instance that actually provides the service that is being
 * queried for.
 */
exports.PtrRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.serviceType,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var instanceNameAsBytes = dnsUtil.getDomainAsByteArray(this.instanceName);
  var resourceDataLength = instanceNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the instance name itself.
  result.append(instanceNameAsBytes);

  return result;
};

/**
 * An SRV record. SRV records map the name of a service instance to the
 * information needed to connect to the service. 
 *
 * instanceTypeDomain: the name being queried for, e.g.
 *   'PrintsALot._printer._tcp.local'
 * ttl: the time to live
 * priority: the priority of this record if multiple records are found. This
 *   must be a number from 0 to 65535.
 * weight: the weight of the record if two records have the same priority. This
 *   must be a number from 0 to 65535.
 * port: the port number on which to find the service. This must be a number
 *   from 0 to 65535.
 * targetDomain: the domain hosting the service (e.g. 'blackhawk.local')
 */
exports.SrvRecord = function SrvRecord(
  instanceTypeDomain,
  ttl,
  priority,
  weight,
  port,
  targetDomain
) {
  if (!(this instanceof SrvRecord)) {
    throw new Error('SrvRecord must be called with new');
  }
  this.recordType = dnsCodes.RECORD_TYPES.SRV;
  // Note that we're not exposing rrClass as a caller-specified variable,
  // because according to the spec SRV records occur in the IN class.
  this.recordClass = dnsCodes.CLASS_CODES.IN;

  this.instanceTypeDomain = instanceTypeDomain;
  this.ttl = ttl;
  this.priority = priority;
  this.weight = weight;
  this.port = port;
  this.targetDomain = targetDomain;
};

/**
 * Get the SRV Record as a ByteArray object.
 *
 * According to this document (https://tools.ietf.org/html/rfc2782) and more
 * explicitly this document
 * (http://www.tahi.org/dns/packages/RFC2782_S4-1_0_0/SV/SV_RFC2782_SRV_rdata.html),
 * the layout of the SRV RR is as follows:
 *
 * The common fields as indicated in getCommonFieldsAsByteArray.
 *
 * 2 octets representing the length of the following component, in bytes.
 *
 * 2 octets indicating the priority
 *
 * 2 octets indicating the weight
 *
 * 2 octets indicating the port
 *
 * A variable number of octets encoding the target name (e.g.
 * PrintsALot.local), encoded as a domain name.
 */
exports.SrvRecord.prototype.convertToByteArray = function() {
  var result = exports.getCommonFieldsAsByteArray(
    this.instanceTypeDomain,
    this.recordType,
    this.recordClass,
    this.ttl
  );

  var targetNameAsBytes = dnsUtil.getDomainAsByteArray(this.targetDomain);

  var resourceDataLength = NUM_OCTETS_PRIORITY +
    NUM_OCTETS_WEIGHT +
    NUM_OCTETS_PORT +
    targetNameAsBytes.length;

  // First we add the length of the resource data.
  result.push(
    resourceDataLength, 
    NUM_OCTETS_RESOURCE_DATA_LENGTH
  );

  // Then add the priority, weight, and port.
  result.push(this.priority, NUM_OCTETS_PRIORITY);
  result.push(this.weight, NUM_OCTETS_WEIGHT);
  result.push(this.port, NUM_OCTETS_PORT);

  result.append(targetNameAsBytes);

  return result;
};

/**
 * Get the common components of a RR as a ByteArray. As specified by the DNS
 * spec and 'TCP/IP Illustrated, Volume 1' by Stevens, the format is as
 * follows:
 *
 * Variable number of octets encoding the domain name to which the RR is
 *   responding.
 *
 * 2 octets representing the RR type
 *
 * 2 octets representing the RR class
 *
 * 4 octets representing the TTL
 */
exports.getCommonFieldsAsByteArray = function(
  domainName,
  rrType,
  rrClass,
  ttl
) {
  var result = new byteArray.ByteArray();

  var domainNameAsBytes = dnsUtil.getDomainAsByteArray(domainName);
  result.append(domainNameAsBytes);

  result.push(rrType, NUM_OCTETS_TYPE);
  result.push(rrClass, NUM_OCTETS_CLASS);
  result.push(ttl, NUM_OCTETS_TTL);

  return result;
};

/**
 * Extract the common fields from the reader as encoded by
 * getCommonFieldsAsByteArray.
 *
 * Returns an object with fields domainName, rrType, rrClass, and ttl.
 */
exports.getCommonFieldsFromByteArrayReader = function(reader) {
  var domainName = dnsUtil.getDomainFromByteArrayReader(reader);
  var rrType = reader.getValue(NUM_OCTETS_TYPE);
  var rrClass = reader.getValue(NUM_OCTETS_CLASS);
  var ttl = reader.getValue(NUM_OCTETS_TTL);

  var result = {
    domainName: domainName,
    rrType: rrType,
    rrClass: rrClass,
    ttl: ttl
  };

  return result;
};

/**
 * Return type of the Resource Record queued up in the reader. Peaking does not
 * affect the position of the underlying reader.
 */
exports.peekTypeInReader = function(reader) {
  // Getting values from the reader normally consumes bytes. Create a defensive
  // copy to work with instead.
  var byteArr = reader.byteArray;
  var startByte = reader.cursor;
  var safeReader = byteArr.getReader(startByte);

  // Consume an encoded domain name. Note this means we're computing domain
  // names twice, which isn't optimal.
  dnsUtil.getDomainFromByteArrayReader(safeReader);
  // After the domain, the type is next.
  var result = safeReader.getValue(NUM_OCTETS_TYPE);
  return result;
};

},{"./byte-array-sem":1,"./dns-codes-sem":3,"./dns-util":9}],15:[function(require,module,exports){
/* globals Promise */
'use strict';

// Listens for the app launching then creates the window
chrome.app.runtime.onLaunched.addListener(function() {
  var width = 500;
  var height = 300;

  chrome.app.window.create('index.html', {
    id: 'main',
    bounds: {
      width: width,
      height: height,
      left: Math.round((screen.availWidth - width) / 2),
      top: Math.round((screen.availHeight - height)/2)
    }
  });
});

var dnssd = require('./dnssd/dns-sd');
console.log('required dns?');
console.log(dnssd);
console.log('loaded?');

},{"./dnssd/dns-sd":"dnssd"}],"binaryUtils":[function(require,module,exports){
/*jshint esnext:true*/
/*exported BinaryUtils*/
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

'use strict';

exports.BinaryUtils = (function() {

var BinaryUtils = {
  stringToArrayBuffer: function(string) {
    var length = (string || '').length;
    var arrayBuffer = new ArrayBuffer(length);
    var uint8Array = new Uint8Array(arrayBuffer);
    for (var i = 0; i < length; i++) {
      uint8Array[i] = string.charCodeAt(i);
    }

    return arrayBuffer;
  },

  arrayBufferToString: function(arrayBuffer) {
    var results = [];
    var uint8Array = new Uint8Array(arrayBuffer);

    for (var i = 0, length = uint8Array.length; i < length; i += 200000) {
      results.push(String.fromCharCode.apply(null, uint8Array.subarray(i, i + 200000)));
    }

    return results.join('');
  },

  blobToArrayBuffer: function(blob, callback) {
    var fileReader = new FileReader();
    fileReader.onload = function() {
      if (typeof callback === 'function') {
        callback(fileReader.result);
      }
    };
    fileReader.readAsArrayBuffer(blob);

    return fileReader.result;
  },

  mergeArrayBuffers: function(arrayBuffers, callback) {
    return this.blobToArrayBuffer(new Blob(arrayBuffers), callback);
  }
};

return BinaryUtils;

})();

},{}],"chromeUdp":[function(require,module,exports){
/* globals Promise, chrome */
'use strict';

var DEBUG = true;

exports.ChromeUdpSocket = function ChromeUdpSocket(socketInfo) {
  if (!(this instanceof ChromeUdpSocket)) {
    throw new Error('ChromeUdpSocket must be called with new');
  }
  this.socketInfo = socketInfo;
  this.socketId = socketInfo.socketId;
};

/**
 * Send data over the port and return a promise with the sendInfo result.
 * Behaves as a thin wrapper around chromeUdp.send.
 */
exports.ChromeUdpSocket.prototype.send = function(arrayBuffer, address, port) {
  return exports.send(this.socketId, arrayBuffer, address, port);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceive.addListener.
 */
exports.addOnReceiveListener = function(listener) {
  chrome.sockets.udp.onReceive.addListener(listener);
};

/**
 * Add listener via call to chrome.sockets.udp.onReceiveError.addListener.
 */
exports.addOnReceiveErrorListener = function(listener) {
  chrome.sockets.udp.onReceiveError.addListener(listener);
};

exports.create = function(obj) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.create(obj, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.bind = function(socketId, address, port) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.bind(socketId, address, port, function(result) {
      if (result < 0) {
        console.log('chromeUdp.bind: result < 0, rejecting');
        console.log('    socketId: ', socketId);
        console.log('    address: ', address);
        console.log('    port: ', port);
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.send = function(socketId, arrayBuffer, address, port) {
  return new Promise(function(resolve, reject) {
    if (DEBUG) {
      console.log('chromeUdp.send');
      console.log('    socketId: ', socketId);
      console.log('    address: ', address);
      console.log('    port: ', port);
      console.log('    arrayBuffer: ', arrayBuffer);
    }
    chrome.sockets.udp.send(
      socketId,
      arrayBuffer,
      address,
      port,
      function(sendInfo) {
        if (sendInfo.resultCode < 0) {
          console.log('chromeUdp.send: result < 0, rejecting');
          reject(sendInfo);
        } else {
          resolve(sendInfo);
        }
      }
    );
  });
};

exports.joinGroup = function(socketId, address) {
  return new Promise(function(resolve, reject) {
    chrome.sockets.udp.joinGroup(socketId, address, function(result) {
      console.log('socketId: ', socketId);
      console.log('address: ', address);
      if (result < 0) {
        console.log('chromeUdp.joinGroup: result < 0, reject');
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};

exports.getSockets = function() {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getSockets(function(allSockets) {
      resolve(allSockets);
    });
  });
};

exports.getInfo = function(socketId) {
  return new Promise(function(resolve) {
    chrome.sockets.udp.getInfo(socketId, function(socketInfo) {
      resolve(socketInfo);
    });
  });
};

exports.closeAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log('Closing socket with id: ', socketInfo.socketId);
      chrome.sockets.udp.close(socketInfo.socketId);
    });
  });
};

exports.listAllSockets = function() {
  exports.getSockets().then(function(allSockets) {
    allSockets.forEach(function(socketInfo) {
      console.log(socketInfo);
    });
  });
};

exports.logSocketInfo = function(info) {
  console.log('Received data via UDP on ', new Date());
  console.log('    socketId: ', info.socketId);
  console.log('    remoteAddress: ', info.remoteAddress);
  console.log('    remotePort: ', info.remotePort);
  console.log('    data: ', info.data);
  console.log('    info: ', info);
};

/**
 * Returns a Promise that resolves with a list of network interfaces.
 */
exports.getNetworkInterfaces = function() {
  return new Promise(function(resolve) {
    chrome.system.network.getNetworkInterfaces(function(interfaces) {
      resolve(interfaces);
    });
  });
};

},{}],"dnsc":[function(require,module,exports){
/*jshint esnext:true*/
/* globals Promise */
'use strict';

var chromeUdp = require('./chromeUdp');
var dnsUtil = require('./dns-util');
var dnsPacket = require('./dns-packet-sem');
var byteArray = require('./byte-array-sem');
var dnsCodes = require('./dns-codes-sem');
var qSection = require('./question-section');

/**
 * This module maintains DNS state and serves as the DNS server. It is
 * responsible for issuing DNS requests.
 */

var DNSSD_MULTICAST_GROUP = '224.0.0.251';
var DNSSD_PORT = 53531;
// var DNSSD_SERVICE_NAME = '_services._snd-sd._udp.local';

/** True if the service has started. */
var started = false;

exports.DNSSD_MULTICAST_GROUP = DNSSD_MULTICAST_GROUP;
exports.DNSSD_PORT = DNSSD_PORT;

/**
 * These are the records owned by this module. They are maintained in an object
 * of domain name to array of records, e.g. { 'www.example.com': [Object,
 * Object, Object], 'www.foo.com': [Object] }.
 */
var records = {};

var onReceiveCallbacks = [];

/**
 * Returns all records known to this module.
 */
exports.getRecords = function() {
  return records;
};

/**
 * Returns all the callbacks currently registered to be invoked with incoming
 * packets.
 */
exports.getOnReceiveCallbacks = function() {
  return onReceiveCallbacks;
};

/**
 * The socket used for accessing the network. Object of type
 * chromeUdp.ChromeUdpSocket.
 */
var socket = null;
/** The information about the socket we are using. */
var socketInfo = null;

/**
 * True if the service is started.
 */
exports.isStarted = function() {
  return started;
};

/**
 * Add a callback to be invoked with received packets.
 */
exports.addOnReceiveCallback = function(callback) {
  onReceiveCallbacks.push(callback);
};

/**
 * Remove the callback.
 */
exports.removeOnReceiveCallback = function(callback) {
  var index = onReceiveCallbacks.indexOf(callback);
  if (index >= 0) {
    onReceiveCallbacks.splice(index, 1);
  }
};

/**
 * The listener that is attached to chrome.sockets.udp.onReceive.addListener
 * when the service is started.
 */
exports.onReceiveListener = function(info) {
  if (dnsUtil.DEBUG) {
    chromeUdp.logSocketInfo(info);
  }

  if (!socket) {
    // We don't have a socket with which to listen.
    return;
  }

  if (socket.socketId !== info.socketId) {
    if (dnsUtil.DEBUG) {
      console.log('Message is not for us, ignoring');
    }
    return;
  }

  if (dnsUtil.DEBUG) {
    console.log('Message is for us, parsing');
  }
  
  // Create a DNS packet.
  var byteArr = new byteArray.ByteArray(info.data);
  var packet = dnsPacket.createPacketFromReader(byteArr.getReader());

  exports.handleIncomingPacket(packet);
};

/**
 * Respond to an incoming packet.
 */
exports.handleIncomingPacket = function(packet) {
  for (var i = 0; i < onReceiveCallbacks.length; i++) {
    var fn = onReceiveCallbacks[i];
    fn(packet);
  }
};

/**
 * Start the system. This must be called before any other calls to this module.
 *
 * Returns a promise that resolves with the socket.
 */
exports.getSocket = function() {
  if (exports.isStarted()) {
    if (dnsUtil.DEBUG) {
      console.log('start called when already started');
    }
    // Already started, resolve immediately.
    return new Promise(resolve => { resolve(socket); });
  }

  // Attach our listeners.
  chromeUdp.addOnReceiveListener(exports.onReceiveListener);

  return new Promise((resolve, reject) => {
    // We have two steps to do here: create a socket and bind that socket to the
    // mDNS port.
    var createPromise = chromeUdp.create({});
    createPromise.then(info => {
      socketInfo = info;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success() {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(socketInfo.socketId, DNSSD_MULTICAST_GROUP);
    }, function err(error) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when binding DNSSD port:', error));
    })
    .then(function joinedGroup() {
      socket = new chromeUdp.ChromeUdpSocket(socketInfo);
      started = true;
      resolve(socket);
    }, function failedToJoinGroup(result) {
      chromeUdp.closeAllSockets();
      reject(new Error('Error when joining DNSSD group: ', result));
    });
  });
};

/**
 * Shuts down the system.
 */
exports.stop = function() {
  if (socket) {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: found socket, closing');
    }
    chromeUdp.closeAllSockets();
    socket = null;
    started = false;
  } else {
    if (dnsUtil.DEBUG) {
      console.log('Stopping: no socket found');
    }
  }
};

/**
 * Perform an mDNS query on the network.
 */
exports.query = function(queryName, queryType, queryClass) {
  // ID is zero, as mDNS ignores the id field.
  var packet = new dnsPacket.DnsPacket(
    0,
    true,
    0,
    0,
    0,
    0,
    0,
    0
  );

  var question = new qSection.QuestionSection(
    queryName,
    queryType,
    queryClass
  );
  packet.addQuestion(question);

  var byteArr = packet.convertToByteArray();
  // And now we need the underlying buffer of the byteArray, truncated to the
  // correct size.
  var uint8Arr = byteArray.getByteArrayAsUint8Array(byteArr);

  exports.getSocket().then(socket => {
    socket.send(uint8Arr.buffer, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
  });
};

/**
 * Issue a query for an A Record with the given domain name. Returns a promise
 * that resolves with a list of ARecords received in response. Resolves with an
 * empty list if none are found.
 */
exports.queryForARecord = function(domainName) {
  exports.query(
    domainName,
    dnsCodes.RECORD_TYPES.A,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for PTR Records advertising the given service name. Returns a
 * promise that resolves with a list of PtrRecords received in response.
 * Resolves with an empty list if none are found.
 */
exports.queryForPtrRecord = function(serviceName) {
  exports.query(
    serviceName,
    dnsCodes.RECORD_TYPES.PTR,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Issue a query for SRV Records corresponding to the given instance name.
 * Returns a promise that resolves with a list of SrvRecords received in
 * response. Resolves with an empty list if none are found.
 */
exports.queryForSrvRecord = function(instanceName) {
  exports.query(
    instanceName,
    dnsCodes.RECORD_TYPES.SRV,
    dnsCodes.CLASS_CODES.IN
  );
};

/**
 * Add a record corresponding to name to the internal data structures.
 */
exports.addRecord = function(name, record) {
  var existingRecords = records[name];
  if (!existingRecords) {
    existingRecords = [];
    records[name] = existingRecords;
  }
  existingRecords.push(record);
};

},{"./byte-array-sem":1,"./chromeUdp":"chromeUdp","./dns-codes-sem":3,"./dns-packet-sem":5,"./dns-util":9,"./question-section":13}],"dnssd-sem":[function(require,module,exports){
/*jshint esnext:true*/
/* globals Promise */
'use strict';

/**
 * The client API for interacting with mDNS and DNS-SD.
 *
 * This is based in part on the Bonjour APIs outlined in 'Zero Configuration
 * Networking: The Definitive Guide' by Cheshire and Steinberg in order to
 * provide a familiar interface.
 *
 * 'RFC 6762: Multicast DNS' is the model for many of the decisions and actions
 * take in this module. 'The RFC' in comments below refers to this RFC. It can
 * be accessed here:
 *
 * https://tools.ietf.org/html/rfc6762#
 *
 * Since this is programming to a specification (or at least to an RFC), it is
 * conforming to a standard. Actions are explained in comments, with direct
 * references to RFC sections as much as is possible.
 */


var dnsUtil = require('./dns-util');
var dnsController = require('./dns-controller');
var dnsCodes = require('./dns-codes-sem');
var resRec = require('./resource-record');
var chromeUdp = require('./chromeUdp');

var MAX_PROBE_WAIT = 250;

/**
 * Returns a promise that resolves after the given time (in ms).
 */
exports.wait = function(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
};

/**
 * Returns a Promise that resolves after 0-250 ms (inclusive).
 */
exports.waitForProbeTime = function() {
  // +1 because randomInt is by default [min, max)
  return exports.wait(dnsUtil.randomInt(0, MAX_PROBE_WAIT + 1));
};

/**
 * Returns true if the DnsPacket is for this queryName.
 */
exports.packetIsForQuery = function(packet, queryName) {
  console.log('PACKET IS FOR QUERY');
  for (var i = 0; i < packet.questions.length; i++) {
    var question = packet.questions[i];
    if (question.queryName === queryName) {
      return true;
    }
  }
  return false;
};

/**
 * Generates a semi-random hostname ending with ".local". An example might be
 * 'host123.local'.
 */
exports.createHostName = function() {
  var start = 'host';
  // We'll return within the range 0, 1000.
  var randomInt = dnsUtil.randomInt(0, 1001);
  var result = start + randomInt + dnsUtil.getLocalSuffix();
  return result;
};

/**
 * Register a service via mDNS. Returns a Promise that resolves with an object
 * like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 1234
 * }
 *
 * name: a user-friendly string to be the name of the instance, e.g. "Sam's
 *   SemCache".
 * type: the service type string. This should be the protocol spoken and the
 *   transport protocol, eg "_http._tcp".
 * port: the port the service is available on.
 */
exports.register = function(host, name, type, port) {
  // Registration is a multi-step process. According to the RFC, section 8.
  //
  // 8.1 indicates that the first step is to send an mDNS query of type ANY
  // (255) for a given domain name.
  //
  // 8.1 also indicates that the host should wait a random time between 0-250ms
  // before issuing the query. This must be performed a total of three times
  // before a lack of responses indicates that the name is free.
  //
  // The probes should be sent with QU questions with the unicast response bit
  // set.
  //
  // 8.2 goes into tiebreaking. That is omitted here.
  //
  // 8.3 covers announcing. After probing, announcing is performed with all of
  // the newly created resource records in the Answer Section. This must be
  // performed twice, one second apart.

  var result = new Promise(function(resolve, reject) {
    // We start by probing for messages of type ANY with the hostname.
    exports.issueProbe(
      host,
      dnsCodes.RECORD_TYPES.ANY,
      dnsCodes.CLASS_CODES.IN
    ).then(function hostFree() {
      return exports.issueProbe(
        name,
        dnsCodes.RECORD_TYPES.ANY,
        dnsCodes.CLASS_CODES.IN
      );
    }, function hostTaken() {
      reject(new Error('host taken: ' + host));
    }).then(function instanceFree() {
      // TODO: make records and issue records now that we know we don't have
      // conflicts.
      exports.createHostRecords(host);
      exports.createServiceRecords(name, type, port, host);
      resolve(
        {
          serviceName: name,
          type: type,
          domain: host,
          port: port
        }
      );
    }, function instanceTaken() {
      reject(new Error('instance taken: ' + name));
    });
  });

  return result;
};

/**
 * Register the host on the network. Assumes that a probe has occurred and the
 * hostname is free.
 */
exports.createHostRecords = function(host) {
  // This just consists of an A Record. Make an entry for every IPv4 address.
  chromeUdp.getNetworkInterfaces().then(function success(interfaces) {
    interfaces.forEach(iface => {
      if (iface.address.indexOf(':') !== -1) {
        console.log('Not yet supporting IPv6: ', iface);
      } else {
        var aRecord = new resRec.ARecord(
          host,
          dnsUtil.DEFAULT_TTL,
          iface.address,
          dnsCodes.CLASS_CODES.IN
        );
        dnsController.addRecord(host, aRecord);
      }
    });
  });
};

/**
 * Register the service on the network. Assumes that a probe has occured and
 * the service name is free.
 */
exports.createServiceRecords = function(name, type, port, domain) {
  // We need to add a PTR record and an SRV record.
  var srvRecord = new resRec.SrvRecord(
    name,
    dnsUtil.DEFAULT_TTL,
    dnsUtil.DEFAULT_PRIORITY,
    dnsUtil.DEFAULT_WEIGHT,
    port,
    domain
  );

  var ptrRecord = new resRec.PtrRecord(
    type,
    dnsUtil.DEFAULT_TTL,
    name,
    dnsCodes.CLASS_CODES.IN
  );

  dnsController.addRecord(name, srvRecord);
  dnsController.addRecord(type, ptrRecord);
};

exports.receivedResponsePacket = function(packets, queryName) {
  console.log('CALLED FUNCTION');
  for (var i = 0; i < packets.length; i++) {
    var packet = packets[i];
    if (exports.packetIsForQuery(packet, queryName) && !packet.isQuery) {
      console.log('isQuery: ', packet.isQuery);
      return true;
    }
  }
  return false;
};

/**
 * Issue a probe compliant with the mDNS spec, which specifies that a probe
 * happen three times at random intervals.
 *
 * Returns a promise that resolves if the probe returns nothing, meaning that
 * the queryName is available, and rejects if it is taken.
 */
exports.issueProbe = function(queryName, queryType, queryClass) {
  // Track the packets we receive whilst querying.
  var packets = [];
  var callback = function(packet) {
    packets.push(packet);
  };
  dnsController.addOnReceiveCallback(callback);

  // Now we kick off a series of queries. We wait a random time to issue a
  // query. 250ms after that we issue another, then another.
  var result = new Promise(function(resolve, reject) {
    exports.waitForProbeTime()
      .then(function success() {
        dnsController.query(
          queryName,
          queryType,
          queryClass
        );
        return exports.wait(MAX_PROBE_WAIT);
      }).then(function success() {
        console.log('added for probe time');
        if (exports.receivedResponsePacket(packets, queryName)) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(packets, queryName)) {
          throw new Error('received a packet, jump to catch');
        } else {
          dnsController.query(
            queryName,
            queryType,
            queryClass
          );
          return exports.wait(MAX_PROBE_WAIT);
        }
      })
      .then(function success() {
        if (exports.receivedResponsePacket(packets, queryName)) {
          throw new Error('received a packet, jump to catch');
        } else {
          resolve();
          dnsController.removeOnReceiveCallback(callback);
        }
      })
      .catch(function failured() {
        dnsController.removeOnReceiveCallback(callback);
        reject();
      });
  });

  return result;
};

/**
 * Browse for services of a given type. Returns a promise that resolves with
 * a list of objects like the following:
 *
 * {
 *   serviceName: "Sam's SemCache",
 *   type: "_http._local",
 *   domain: "laptop.local",
 *   port: 8889
 * }
 *
 * type: the service string for the type of services queried for, eg
 * "_http._tcp".
 */
exports.browse = function(type) {
  throw new Error('Unimplemented ' + type);
};

},{"./chromeUdp":"chromeUdp","./dns-codes-sem":3,"./dns-controller":"dnsc","./dns-util":9,"./resource-record":14}],"dnssd":[function(require,module,exports){
/*jshint esnext:true*/
/*exported DNSSD*/
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

'use strict';

exports.DNSSD = (function() {

var DNSRecord         = require('./dns-record');
var DNSResourceRecord = require('./dns-resource-record');
var DNSPacket         = require('./dns-packet');
var DNSCodes          = require('./dns-codes');
var DNSUtils          = require('./dns-utils');

var eventTarget       = require('./event-target');
var ByteArray         = require('./byte-array');
var BinaryUtils       = require('./binary-utils');
var IPUtils           = require('./ip-utils');

var chromeUdp         = require('./chromeUdp');

const DNSSD_SERVICE_NAME    = '_services._dns-sd._udp.local';
const DNSSD_MULTICAST_GROUP = '224.0.0.251';
const DNSSD_PORT            = 53531;

const DEBUG = true;

var DNSSD = new eventTarget.EventTarget();

var discovering = false;
var services = {};

DNSSD.getSocket = function() {
  // We have two steps to do here: create a socket and bind that socket to the
  // mDNS port.
  return new Promise((resolve, reject) => {
    var dnssdObj = this;
    if (dnssdObj.socket) {
      // We've already created the socket.
      resolve(dnssdObj.socket);
      return;
    }
    var createPromise = chromeUdp.create({});
    var socketInfo;
    createPromise.then(info => {
      socketInfo = info;
      dnssdObj.socketInfo = info;
      dnssdObj.socketId = info.socketId;
      return info;
    })
    .then(info => {
      return chromeUdp.bind(info.socketId, '0.0.0.0', DNSSD_PORT);
    })
    .then(function success(result) {
      // We've bound to the DNSSD port successfully.
      return chromeUdp.joinGroup(socketInfo.socketId, DNSSD_MULTICAST_GROUP);
    }, function error(error) {
      console.log('Error when binding DNSSD port: ', error);
      chromeUdp.closeAllSockets();
      reject(error);
    })
    .then(function joinedGroup(result) {
      dnssdObj.socket = new chromeUdp.ChromeUdpSocket(socketInfo);
      resolve(dnssdObj.socket);
    }, function failedToJoinGroup(result) {
      console.log('Error when joining DNSSD group: ', result);
      chromeUdp.closeAllSockets();
      reject(result);
    });

    chrome.sockets.udp.onReceive.addListener(info => {
      if (DEBUG) {
        chromeUdp.logSocketInfo(info);
      }
      if (info.socketId !== this.socketId) {
        // The message wasn't for this socket. Do nothing.
        return;
      }

      var packet = new DNSPacket(new ByteArray(info.data));

      switch (packet.flags.QR) {
        case DNSCodes.QUERY_RESPONSE_CODES.QUERY:
          if (DEBUG) {
            console.log('received DNS query packet');
          }
          handleQueryPacket.call(this, packet, info.data, info);
          break;
        case DNSCodes.QUERY_RESPONSE_CODES.RESPONSE:
          if (DEBUG) {
            console.log('received DNS response packet');
          }
          handleResponsePacket.call(this, packet, info.data);
          break;
        default:
          break;
      }
    });

  });
};

DNSSD.startDiscovery = function() {
  discovering = true;

  // Broadcast query for advertised services.
  discover.call(this);
};

DNSSD.stopDiscovery = function() {
  discovering = false;
};

DNSSD.registerService = function(serviceName, port, options) {
  services[serviceName] = {
    port: port || 0,
    options: options || {}
  };

  // Broadcast advertisement of registered services.
  advertise.call(this);
};

DNSSD.unregisterService = function(serviceName) {
  delete services[serviceName];

  // Broadcast advertisement of registered services.
  advertise.call(this);
};

function handleQueryPacket(packet, message, socketInfo) {
  packet.getRecords('QD').forEach((record) => {
    // Don't respond if the query's class code is not IN or ANY.
    if (record.classCode !== DNSCodes.CLASS_CODES.IN &&
        record.classCode !== DNSCodes.CLASS_CODES.ANY) {
      return;
    }

    // Don't respond if the query's record type is not PTR, SRV or ANY.
    if (record.recordType !== DNSCodes.RECORD_TYPES.PTR &&
        record.recordType !== DNSCodes.RECORD_TYPES.SRV &&
        record.recordType !== DNSCodes.RECORD_TYPES.ANY) {
      return;
    }

    // Broadcast advertisement of registered services.
    advertise.call(this);

    // Unicast as well. Unicast can be requested, but this doesn't seem to
    // check for that, and we can't expect all clients to bind to 53531, since
    // we know Chrome doesn't support SO_REUSEADDRESS via a JavaScript API. We
    // are keeping the advertise() call to try and remain compliant with other
    // mDNS implementations that simply switch to 53531 from 5353. However, to
    // actually communicate, we need to fire back with a unicast query.
    unicastAdvertise.call(
      this,
      socketInfo.remoteAddress,
      socketInfo.remotePort
    );
  });
}

function handleResponsePacket(packet, message) {
  if (!discovering) {
    return;
  }

  var services = [];
  packet.getRecords('AN').forEach((record) => {
    if (record.recordType === DNSCodes.RECORD_TYPES.PTR) {
      services.push(record.data);
    }
  });

  this.dispatchEvent('discovered', {
    message: message,
    packet: packet,
    address: message.remoteAddress,
    services: services
  });
}

function discover() {
  var packet = new DNSPacket();

  packet.flags.QR = DNSCodes.QUERY_RESPONSE_CODES.QUERY;

  var question = new DNSRecord({
    name: DNSSD_SERVICE_NAME,
    recordType: DNSCodes.RECORD_TYPES.PTR
  });

  packet.addRecord('QD', question);

  this.getSocket().then((socket) => {
    var data = packet.serialize();
    socket.send(data, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
  });
}

/**
 * Send a DNS response to a specific address and port, essentially unicasting.
 */
function unicastAdvertise(address, port) {
  sendServiceHelper.call(this, address, port);
}

function sendServiceHelper(address, port) {
  if (Object.keys(services).length === 0) {
    return;
  }

  var packet = new DNSPacket();

  packet.flags.QR = DNSCodes.QUERY_RESPONSE_CODES.RESPONSE;
  packet.flags.AA = DNSCodes.AUTHORITATIVE_ANSWER_CODES.YES;

  for (var serviceName in services) {
    addServiceToPacket(serviceName, packet);
  }

  this.getSocket().then((socket) => {
    var data = packet.serialize();
    if (DEBUG) {
      console.log('Sending packet');
      console.log(packet);
    }
    socket.send(data, address, port);

    // Re-broadcast announcement after 1000ms (RFC6762, 8.3).
    // setTimeout(() => {
    //   socket.send(data, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
    // }, 1000);
  });
}

function advertise() {
  sendServiceHelper.call(this, DNSSD_MULTICAST_GROUP, DNSSD_PORT);
}

function addServiceToPacket(serviceName, packet) {
  var service = services[serviceName];
  if (!service) {
    return;
  }

  var alias = serviceName;

  // SRV Record
  var srvData = DNSResourceRecord.generateByteArrayForSRV(
    serviceName,
    10,
    0,
    0,
    1234,
    'testdomain.local'
  );

  // var srvData = new ByteArray();
  // srvData.push(0x0000, 2);        // Priority
  // srvData.push(0x0000, 2);        // Weight
  // srvData.push(service.port, 2);  // Port
  // srvData.append(DNSUtils.labelToByteArray(serviceName));

  var srv = new DNSResourceRecord({
    name: alias,
    recordType: DNSCodes.RECORD_TYPES.SRV,
    data: srvData
  });

  packet.addRecord('AR', srv);

  // TXT Record
  // var txtData = new ByteArray();

  // for (var key in service.options) {
  //   txtData.append(DNSUtils.labelToByteArray(key + '=' + service.options[key]));
  // }
  
  // var txt = new DNSResourceRecord({
  //   name: alias,
  //   recordType: DNSCodes.RECORD_TYPES.TXT,
  //   data: txtData
  // });

  // packet.addRecord('AR', txt);

  // PTR Wildcard Record
  var ptrWildcard = new DNSResourceRecord({
    name: DNSSD_SERVICE_NAME,
    recordType: DNSCodes.RECORD_TYPES.PTR,
    data: serviceName
  });

  packet.addRecord('AN', ptrWildcard);

  // PTR Service Record
  var ptrService = new DNSResourceRecord({
    name: serviceName,
    recordType: DNSCodes.RECORD_TYPES.PTR,
    data: alias
  });

  packet.addRecord('AN', ptrService);
}

return DNSSD;

})();

},{"./binary-utils":"binaryUtils","./byte-array":2,"./chromeUdp":"chromeUdp","./dns-codes":4,"./dns-packet":6,"./dns-record":7,"./dns-resource-record":8,"./dns-utils":10,"./event-target":11,"./ip-utils":12}]},{},[15]);
