'use strict';

var test = require('tape');

var bloomFilter = require('../../../app/scripts/coalescence/bloom-filter');
var objects = require('../../../app/scripts/coalescence/objects');

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
}

function createPeerInfo() {
  var peerInfo = {
    ipAddress: '1.2.3.4',
    port: 8888
  };
  return peerInfo;
}

function createPageInfos() {
  var pageInfo1 = {
    fullUrl: 'http://foo.com',
    captureDate: '2017-05-03'
  };
  var pageInfo2 = {
    fullUrl: 'http://bar.com',
    captureDate: '2013-04-02'
  };
  return [pageInfo1, pageInfo2];
}

test('NetworkCachedPage constructor succeeds', function(t) {
  var availability = 'probable';
  var queryInfo = { url: 'hidyho.com' };
  var accessInfo = { info: 'come get some' };
  var ncp = new objects.NetworkCachedPage(availability, queryInfo, accessInfo);

  t.equal(ncp.availability, availability);
  t.equal(ncp.queryInfo, queryInfo);
  t.equal(ncp.accessInfo, accessInfo);
  t.end();
});

test('Digest consructor succeeds', function(t) {
  var peerInfo = createPeerInfo();
  var pageInfos = [];

  var digest = new objects.Digest(peerInfo, pageInfos);

  t.deepEqual(digest.peerInfo, peerInfo);
  // Not going to bother checking the page info, as others tests will verify
  // the processing.
  end(t);
});

test('Digest performQueryForPage returns null if no page', function(t) {
  var peerInfo = createPeerInfo();
  var pageInfos = createPageInfos();

  var digest = new objects.Digest(peerInfo, pageInfos);
  
  var actual = digest.performQueryForPage('http://not-there.com');
  t.equal(actual, null);
  end(t);
});

test('Digest performQueryForPage returns captureDate', function(t) {
  var peerInfo = createPeerInfo();
  var pageInfos = createPageInfos();

  var digest = new objects.Digest(peerInfo, pageInfos);
  
  t.equal(
    digest.performQueryForPage(pageInfos[0].fullUrl),
    pageInfos[0].captureDate
  );
  t.equal(
    digest.performQueryForPage(pageInfos[1].fullUrl),
    pageInfos[1].captureDate
  );
  end(t);
});

test('PeerBloomFilter constructor succeeds with buffer', function(t) {
  var peerInfo = createPeerInfo();
  var bloom = new bloomFilter.BloomFilter();
  var buff = bloom.serialize();

  var actual = new objects.PeerBloomFilter(peerInfo, buff);

  t.deepEqual(actual.peerInfo, peerInfo);
  t.deepEqual(actual.bloomFilter, bloom);
  end(t);
});

test('PeerBloomFilter constructor succeeds with BloomFilter', function(t) {
  let pinfo = createPeerInfo();
  let bloom = new bloomFilter.BloomFilter();
  bloom.add('toots');

  let actual = new objects.PeerBloomFilter(pinfo, bloom);

  t.deepEqual(actual.peerInfo, pinfo);
  t.deepEqual(actual.bloomFilter, bloom);

  end(t);
});

test('PeerBloomFilter performQueryForPage false if not present', function(t) {
  var peerInfo = createPeerInfo();
  var bloom = new bloomFilter.BloomFilter();
  var buff = bloom.serialize();

  var actual = new objects.PeerBloomFilter(peerInfo, buff);
  t.false(actual.performQueryForPage('http://foo.com'));
  end(t);
});

test('PeerBloomFilter performQueryForPage true if present', function(t) {
  var peerInfo = createPeerInfo();
  var rawBloom = new bloomFilter.BloomFilter();
  var url = 'foo';
  rawBloom.add(url);
  var buff = rawBloom.serialize();

  var peerBloom = new objects.PeerBloomFilter(peerInfo, buff);
  t.deepEqual(peerBloom.bloomFilter.backingObj.buckets, rawBloom.backingObj.buckets);
  t.true(peerBloom.performQueryForPage(url));
  end(t);
});
