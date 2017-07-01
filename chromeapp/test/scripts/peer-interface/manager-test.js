'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const ifHttp = require('../../../app/scripts/peer-interface/http-impl');
const ifWebrtc = require('../../../app/scripts/peer-interface/webrtc-impl');
const tutil = require('../test-util');

let mgr = require('../../../app/scripts/peer-interface/manager');


/**
 * Proxyquire the messaging module with proxies set as the proxied modules.
 */
function proxyquireManager(proxies) {
  mgr = proxyquire(
    '../../../app/scripts/peer-interface/manager',
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
    require.resolve('../../../app/scripts/peer-interface/manager')
  ];
  mgr = require('../../../app/scripts/peer-interface/manager');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  t.end();
  reset();
}

test('getPeerAccessor correct for http', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('http')
    }
  });

  let actual = mgr.getPeerAccessor(ipAddress, port);
  t.deepEqual(actual, new ifHttp.HttpPeerAccessor({ ipAddress, port }));
  end(t);
});

test('getPeerAccessor correct for webrtc', function(t) {
  let { ipAddress, port } = tutil.getIpPort();
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('webrtc')
    }
  });

  let actual = mgr.getPeerAccessor(ipAddress, port);
  t.deepEqual(actual, new ifWebrtc.WebrtcPeerAccessor({ ipAddress, port }));
  end(t);
});

test('getPeerAccessor throws if unrecognized', function(t) {
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('I do not exist')
    }
  });

  t.throws(mgr.getPeerAccessor);
  end(t);
});
