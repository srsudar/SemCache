'use strict';

/**
 * Provides a Bloom filter API.
 *
 * We're using this rather than a bare library because I can't find a great
 * library that meets all of our requirements. For that reason we're going to
 * wrap them in case we need to swap one.
 */

/**
 * The library we are wrapping.
 */
const lib = require('bloomfilter');
const toArrayBuffer = require('to-arraybuffer');

/**
 * Both the number of bits and the number of hash functions are constants that
 * we are using solely to facilitate serialization. The numbers are taken from
 * a Google Sheets calculation used to generate 0.001 probability of false
 * positive for 1000 elements.
 */
const NUM_BITS = 14378;
const NUM_HASH_FUNCTIONS = 10;

class BloomFilter {
  constructor() {
    /**
     * Note that for now we're intentionally not exposing any ability to tune
     * parameters. This is because it simplifies serialization with our
     * particular libary, largely.
     */
    this.backingObj = new lib.BloomFilter(NUM_BITS, NUM_HASH_FUNCTIONS);
  }

  /**
   * @param {string} val
   *
   * @return {undefined}
   */
  add(val) {
    this.backingObj.add(val);
  }

  /**
   * @param {string} val
   *
   * @return {boolean}
   */
  test(val) {
    return this.backingObj.test(val);
  }

  /**
   * @return {Buffer} a Buffer that can be used to recreate the filter
   */
  serialize() {
    // Imperfect serialization. We're ignoring the _localizations object.
    return Buffer.from(this.backingObj.buckets.buffer);
  }

  /**
   * @param {Buffer} buff a Buffer as generated by serialize()
   *
   * @return {BloomFilter}
   */
  static from(buff) {
    let wrapper = new exports.BloomFilter();

    // We need an Int32Array, not just a buffer.
    let arrayBuffer = toArrayBuffer(buff);
    let typedArray = new Int32Array(arrayBuffer);
    
    wrapper.backingObj = new lib.BloomFilter(typedArray, NUM_HASH_FUNCTIONS);
    return wrapper;
  }
}

exports.BloomFilter = BloomFilter;
exports.from = BloomFilter.from;
