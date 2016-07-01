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
 *     _chromecache._http.local .
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
