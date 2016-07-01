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
