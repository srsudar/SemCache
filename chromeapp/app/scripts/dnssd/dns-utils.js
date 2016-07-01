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
