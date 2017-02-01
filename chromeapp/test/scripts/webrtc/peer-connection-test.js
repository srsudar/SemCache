'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var peerConn = require('../../../app/scripts/webrtc/peer-connection');

test('getRawConnection returns constructor arg', function(t) {
  var expected = { foo: 'bar' };
  var pc = new peerConn.PeerConnection(expected);

  var actual  = pc.getRawConnection();

  t.equal(expected, actual);
  t.end();
});

test('getList issues call to peer', function(t) {
  t.fail();
});

test('getList resolves after call to handlemessage', function(t) {
  t.fail();
});
