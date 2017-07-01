'use strict';

const test = require('tape');

let common = require('../../../app/scripts/peer-interface/common');

let PeerAccessor = common.PeerAccessor;


test('PeerAccessor getters correct', function(t) {
  let ipAddress = '1.2.244.1';
  let port = 777;

  let pa = new PeerAccessor({ ipAddress, port });

  t.equal(pa.getIpAddress(), ipAddress);
  t.equal(pa.getPort(), port);

  t.end();
});
