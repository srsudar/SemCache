'use strict';

const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
require('sinon-as-promised');

let util = require('../../../app/scripts/coalescence/util');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/coalescence/util')
  ];
  util = require('../../../app/scripts/coalescence/util');
}

function proxyquireUtil(proxies) {
  util = proxyquire('../../../app/scripts/coalescence/util', proxies);
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass t'); }
  reset();
  t.end();
}

function createPeerInfos() {
  return [
    {
      domainName: 'tyrion.local',
      port: 1111
    },
    {
      domainName: 'cersei.local',
      port: 4444
    }
  ];
}

test('removeOwnInfo does nothing if not present', function(t) {
  proxyquireUtil({
    '../settings': {
      init: sinon.stub().resolves(),
      getHostName: sinon.stub().returns('not in there')
    }
  });

  let peerInfos = createPeerInfos();
  let expected = createPeerInfos();

  util.removeOwnInfo(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('removeOwnInfo removes our own information', function(t) {
  let peerInfos = createPeerInfos();
  let ourInfo = peerInfos[0];
  let expected = peerInfos.slice(1);

  proxyquireUtil({
    '../settings': {
      init: sinon.stub().resolves(),
      getHostName: sinon.stub().returns(ourInfo.domainName)
    }
  });

  util.removeOwnInfo(peerInfos)
  .then(actual => {
    t.deepEqual(actual, expected);
    end(t);
  })
  .catch(err => {
    t.fail(err);
    end(t);
  });
});

test('removeOwnInfo rejects on error', function(t) {
  let expected = { msg: 'trubs' };
  let peerInfos = createPeerInfos();

  proxyquireUtil({
    '../settings': {
      init: sinon.stub().rejects(expected)
    }
  });

  util.removeOwnInfo(peerInfos)
  .then(actual => {
    t.fail(actual);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    end(t);
  });
});
