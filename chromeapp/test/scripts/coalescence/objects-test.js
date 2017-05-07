'use strict';

var test = require('tape');

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
