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

module.exports = window.DNSResourceRecord = (function() {

var DNSRecord   = require('./dns-record');
var DNSCodes    = require('./dns-codes');
var DNSUtils    = require('./dns-utils');

var ByteArray   = require('./byte-array');

const DNS_RESOURCE_RECORD_DEFAULT_TTL = 10; // 10 seconds
// const DNS_RESOURCE_RECORD_DEFAULT_TTL = 3600; // 1 hour

function DNSResourceRecord(properties) {
  DNSRecord.call(this, properties);

  this.ttl  = this.ttl  || DNS_RESOURCE_RECORD_DEFAULT_TTL;
  this.data = this.data || null;
}

DNSResourceRecord.parseFromPacketReader = function(reader) {
  var record = DNSRecord.parseFromPacketReader.call(this, reader);

  var ttl  = reader.getValue(4);
  var data = reader.getBytes(reader.getValue(2));

  switch (record.recordType) {
    case DNSCodes.RECORD_TYPES.PTR:
      data = parsePTR(data, reader.byteArray);
      break;
    case DNSCodes.RECORD_TYPES.TXT:
      data = parseTXT(data, reader.byteArray);
      break;
    default:
      // data = BinaryUtils.arrayBufferToString(data.buffer);
      break;
  }

  record.ttl  = ttl;
  record.data = data;

  return record;
}

DNSResourceRecord.prototype = Object.create(DNSRecord.prototype);

DNSResourceRecord.prototype.constructor = DNSResourceRecord;

DNSResourceRecord.prototype.serialize = function() {
  var byteArray = DNSRecord.prototype.serialize.call(this);

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
    default:
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

function parsePTR(data, packetData) {
  var result = DNSUtils.byteArrayToLabel(data);

  return DNSUtils.decompressLabel(result, packetData);
}

function parseTXT(data, packetData) {
  var result = {};

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
