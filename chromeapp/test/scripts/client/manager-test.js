'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const webrtcClient = require('../../../app/scripts/client/webrtc-client');
const tutil = require('../test-util');

let mgr = require('../../../app/scripts/client/manager');


/**
 * Proxyquire the messaging module with proxies set as the proxied modules.
 */
function proxyquireManager(proxies) {
  mgr = proxyquire(
    '../../../app/scripts/client/manager',
    proxies
  );
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/client/manager')
  ];
  mgr = require('../../../app/scripts/client/manager');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

test('getClient correct', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('webrtc')
    }
  });

  let actual = mgr.getClient(ipAddress, port);
  t.deepEqual(actual, new webrtcClient.WebrtcClient({ ipAddress, port }));
  end(t);
});
