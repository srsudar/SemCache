'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var ifHttp = require('../../../app/scripts/peer-interface/http-impl');
var ifWebrtc = require('../../../app/scripts/peer-interface/webrtc-impl');
var mgr = require('../../../app/scripts/peer-interface/manager');

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

test('getPeerAccessor correct for webrtc', function(t) {
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('webrtc')
    }
  });

  var actual = mgr.getPeerAccessor();
  t.deepEqual(actual, new ifHttp.HttpPeerAccessor());
  end(t);
});

test('getPeerAccessor correct for http', function(t) {
  proxyquireManager({
    '../settings': {
      getTransportMethod: sinon.stub().returns('http')
    }
  });

  var actual = mgr.getPeerAccessor();
  t.deepEqual(actual, new ifWebrtc.WebrtcPeerAccessor());
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
