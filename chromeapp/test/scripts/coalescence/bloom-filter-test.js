'use strict';

const test = require('tape');

let bloom = require('../../../app/scripts/coalescence/bloom-filter');


/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/bloom-filter')
  ];
  bloom = require('../../../app/scripts/coalescence/bloom-filter');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  reset();
  t.end();
}

test('constructor succeeds', function(t) {
  let bf = new bloom.BloomFilter();
  t.notEqual(bf, null);
  end(t);
});

test('add and test work as expected', function(t) {
  let bf = new bloom.BloomFilter();
  
  t.false(bf.test('foo'));
  bf.add('foo');
  t.true(bf.test('foo'));
  end(t);
});

test('toBuffer and fromBuffer work as expected', function(t) {
  let bf = new bloom.BloomFilter();

  bf.add('tyrion');
  bf.add('jamie');

  let buff = bf.toBuffer();

  let actual = bloom.BloomFilter.fromBuffer(buff);

  t.true(actual.test('tyrion'));
  t.true(actual.test('jamie'));
  t.false(actual.test('foo'));

  // Testing for deepEqual on the top level object fails because of the
  // _locations field. This seems to never be used in the object? Unclear as to
  // what it is, so just ignoring it.
  t.deepEqual(actual.buckets, bf.buckets);
  end(t);
});
