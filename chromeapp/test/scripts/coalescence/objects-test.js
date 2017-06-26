'use strict';

const test = require('tape');

const bloomFilter = require('../../../app/scripts/coalescence/bloom-filter');
const objects = require('../../../app/scripts/coalescence/objects');


function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
}

function createPeerInfo() {
  let peerInfo = {
    ipAddress: '1.2.3.4',
    port: 8888
  };
  return peerInfo;
}

function createPageInfos() {
  let pageInfo1 = {
    fullUrl: 'http://foo.com',
    captureDate: '2017-05-03'
  };
  let pageInfo2 = {
    fullUrl: 'http://bar.com',
    captureDate: '2013-04-02'
  };
  return [pageInfo1, pageInfo2];
}

test('NetworkCachedPage constructor succeeds', function(t) {
  let availability = 'probable';
  let queryInfo = { url: 'hidyho.com' };
  let accessInfo = { info: 'come get some' };
  let ncp = new objects.NetworkCachedPage(availability, queryInfo, accessInfo);

  t.equal(ncp.availability, availability);
  t.equal(ncp.queryInfo, queryInfo);
  t.equal(ncp.accessInfo, accessInfo);
  t.end();
});

test('Digest consructor succeeds', function(t) {
  let peerInfo = createPeerInfo();
  let pageInfos = [];

  let digest = new objects.Digest(peerInfo, pageInfos);

  t.deepEqual(digest.peerInfo, peerInfo);
  // Not going to bother checking the page info, as others tests will verify
  // the processing.
  end(t);
});

test('Digest performQueryForPage returns null if no page', function(t) {
  let peerInfo = createPeerInfo();
  let pageInfos = createPageInfos();

  let digest = new objects.Digest(peerInfo, pageInfos);
  
  let actual = digest.performQueryForPage('http://not-there.com');
  t.equal(actual, null);
  end(t);
});

test('Digest performQueryForPage returns captureDate', function(t) {
  let peerInfo = createPeerInfo();
  let pageInfos = createPageInfos();

  let digest = new objects.Digest(peerInfo, pageInfos);
  
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
  let peerInfo = createPeerInfo();
  let bloom = new bloomFilter.BloomFilter();
  let buff = bloom.serialize();

  let actual = new objects.PeerBloomFilter(peerInfo, buff);

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
  let peerInfo = createPeerInfo();
  let bloom = new bloomFilter.BloomFilter();
  let buff = bloom.serialize();

  let actual = new objects.PeerBloomFilter(peerInfo, buff);
  t.false(actual.performQueryForPage('http://foo.com'));
  end(t);
});

test('PeerBloomFilter performQueryForPage true if present', function(t) {
  let peerInfo = createPeerInfo();
  let rawBloom = new bloomFilter.BloomFilter();
  let url = 'foo';
  rawBloom.add(url);
  let buff = rawBloom.serialize();

  let peerBloom = new objects.PeerBloomFilter(peerInfo, buff);
  t.deepEqual(
    peerBloom.bloomFilter.backingObj.buckets,
    rawBloom.backingObj.buckets
  );
  t.true(peerBloom.performQueryForPage(url));
  end(t);
});
