'use strict';
var Buffer = require('buffer').Buffer;
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var cmgr = require('../../../app/scripts/webrtc/connection-manager');
var peerConn = require('../../../app/scripts/webrtc/peer-connection');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetCmgr() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/connection-manager')
  ];
  cmgr = require('../../../app/scripts/webrtc/connection-manager');
}

/**
 * Proxyquire the cmgr object with proxies passed as the proxied modules.
 */
function proxyquireCmgr(proxies) {
  cmgr = proxyquire(
    '../../../app/scripts/webrtc/connection-manager',
    proxies
  );
}

/**
 * @returns {JSON} an event with a candidate as expected for a call to
 * onicecandidate
 */
function createIceEvent(candidate) {
  return { candidate: candidate };
}

/**
 * Helper for setting up tests for createConnection. The callback heavy nature
 * of the WebRTC format, as well as the things like the fact that in our case
 * we do not want to perform trickle ICE, eg, instead only sending an offer
 * after all ICE candidates have been generated, all conspire to make a lot of
 * set up required.
 *
 * This method assists with that at the name of some additional complexity to
 * spare code duplication.
 *
 * If all parameters are falsey, a success case is asserted and state is reset.
 * Otherwise, the call to createConnection is not performed and the cmgr module
 * is prepared for a .catch() assertion to be made by the caller.
 *
 * Callers should reset cmgr state after each test.
 *
 * @param {Object} sendOfferError if truthy, will be the error sendOffer
 * rejects with
 * @param {Object} createOfferError if truthy, will be the error createOffer
 * rejects with
 * @param {Object} setLocalDescriptionError if truthy, will be the error
 * setLocalDescription rejects with
 * @param {Object} createDataChannelError if truthy, the exception that will be
 * thrown when createDataChannel is called
 * @param {Tape} t the Tape test object
 */
function createConnectionAssertionHelper(
    sendOfferError,
    createOfferError,
    setLocalDescriptionError,
    createDataChannelError,
    t
) {
  var ipaddr = '5.4.3.2';
  var port = 4444;
  var peerEndpoint = ipaddr + ':' + port + '/receive_wrtc';
  var localDescription = 'local offer description';

  var peerConnection = sinon.stub();

  if (createOfferError) {
    peerConnection.createOffer = sinon.stub().rejects(createOfferError);
  } else {
    peerConnection.createOffer = sinon.stub().resolves(localDescription);
  }

  if (createDataChannelError) {
    peerConnection.createDataChannel = sinon.stub()
      .throws(createDataChannelError);
  } else {
    peerConnection.createDataChannel = sinon.stub();
  }
  
  var iceCandidates = [
    'candidate 1',
    'candidate 2',
    'candidate 3'
  ];

  var actualDescription = null;
  if (setLocalDescriptionError) {
    peerConnection.setLocalDescription = sinon.stub()
      .rejects(setLocalDescriptionError);
  } else {
    peerConnection.setLocalDescription = function(desc) {
      actualDescription = desc;
      // After a call to setLocalDescription ice events should start being
      // received.
      iceCandidates.forEach(candidate => {
        peerConnection.onicecandidate(createIceEvent(candidate));
      });
      // and finally we send a candidate = null event to signify ice gathering is
      // complete.
      peerConnection.onicecandidate(createIceEvent(null));
    };
  }
  
  cmgr.getPathForWebrtcNegotiation = sinon.stub().withArgs(ipaddr, port)
    .returns(peerEndpoint);
  cmgr.createRTCPeerConnection = sinon.stub().returns(peerConnection);

  if (sendOfferError) {
    cmgr.sendOffer = sinon.stub().rejects(sendOfferError);
  } else {
    // sendOffer should resolve with our peer connection after it is open.
    cmgr.sendOffer = sinon.stub().resolves(peerConnection);
  }

  if (sendOfferError ||
    createOfferError ||
    setLocalDescriptionError || 
    createDataChannelError
  ) {
    return;
  }
  // Start sending ice candidates.
  cmgr.createConnection(ipaddr, port)
  .then(actual => {
    t.equal(actual, peerConnection);
    t.deepEqual(cmgr.getPathForWebrtcNegotiation.args[0], [ipaddr, port]);
    t.deepEqual(actualDescription, localDescription);
    t.deepEqual(
      cmgr.sendOffer.args[0],
      [
        peerEndpoint,
        peerConnection, 
        localDescription, 
        iceCandidates, 
        ipaddr, 
        port
      ]
    );
    t.end();
    resetCmgr();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetCmgr();
  });
}

/**
 * Helper to test assertions around the sendOffer method. These methods require
 * a lot of set up due to their callback heavy nature. Without any of the
 * arguments set, an assertion will be performed that everything works as
 * expected. If any of the error objects are set, no assertions will be
 * performed, but the cmgr module will be set up to throw exceptions or reject
 * with the given error, allowing callers to catch() them.
 *
 * Callers are responsible for resetting module state after the test.
 *
 * @param {Object} fetchError if truthy, error that will be thrown by fetch
 * @param {Object} createDescError if truthy, error that will be thrown by
 * createRTCSessionDescription
 * @param {Tape} t the Tape test object
 *
 * @return {null|Function} a function wrapping the call to cmgr.sendOffer to ensure
 * the parameters are correct for a valid call, with the valid stubs
 */
function sendOfferAssertionHelper(fetchError, createDescError, t) {
  var wrtcEndpoint = 'endpoint';
  var rawConnection = sinon.stub();
  rawConnection.addIceCandidate = sinon.stub();
  rawConnection.setRemoteDescription = sinon.stub();

  var peerConnection = 'the custom PeerConnection object';
  var localDescription = 'local description';
  var remoteDescriptionJson = 'remote description';
  var remoteDescriptionObj = 'remoteDescription';
  var localIceCandidates = ['local candidate 1', 'local candidate 2'];
  var serverIceCandidates = ['peer candidate 1', 'peer candidate 2'];
  var wrappedServerIceCandidates = [
    { wrapped: serverIceCandidates[0] },
    { wrapped: serverIceCandidates[1] }
  ];
  var ipaddr = '1.2.3.4';
  var port = 9876;

  var jsonToServer = {
    description: localDescription,
    iceCandidates: localIceCandidates
  };
  var jsonFromServer = {
    description: remoteDescriptionJson,
    iceCandidates: serverIceCandidates
  };

  // Fetch returns a response, which itself has a json() function that returns
  // a Promise.
  var respStub = sinon.stub();
  respStub.json = sinon.stub().resolves(jsonFromServer);

  var fetchStub = sinon.stub().resolves(respStub);
  if (fetchError) {
    fetchStub = sinon.stub().rejects(fetchError);
  }

  proxyquireCmgr({
    '../util': {
      fetch: fetchStub
    }
  });

  if (createDescError) {
    cmgr.createRTCSessionDescription = sinon.stub().throws(createDescError);
  } else {
    cmgr.createRTCSessionDescription = sinon.stub()
      .withArgs(remoteDescriptionJson).returns(remoteDescriptionObj);
  }

  var numCallsToCreateIce = 0;
  var createRTCIceCandidateArgs = [];
  cmgr.createRTCIceCandidate = function(createArg) {
    createRTCIceCandidateArgs.push(createArg);
    var result = wrappedServerIceCandidates[numCallsToCreateIce];
    numCallsToCreateIce++;
    return result;
  };
  cmgr.addConnection = sinon.stub();
  cmgr.createPeerConnection = sinon.stub().withArgs(rawConnection)
    .returns(peerConnection);

  if (fetchError || createDescError) {
    // Allow the caller to do the catch()'ing.
    return function () {
      return cmgr.sendOffer(
        wrtcEndpoint,
        rawConnection,
        localDescription,
        localIceCandidates,
        ipaddr,
        port
      );
    };
  }

  cmgr.sendOffer(
    wrtcEndpoint,
    rawConnection,
    localDescription,
    localIceCandidates,
    ipaddr,
    port
  )
  .then(actual => {
    t.equal(actual, peerConnection);
    t.deepEqual(
      rawConnection.setRemoteDescription.args[0], [remoteDescriptionObj]
    );
    t.deepEqual(createRTCIceCandidateArgs, serverIceCandidates);
    t.deepEqual(
      fetchStub.args[0],
      [
        wrtcEndpoint,
        {
          method: 'PUT',
          body: Buffer.from(JSON.stringify(jsonToServer))
        }
      ]
    );
    t.deepEqual(
      rawConnection.setRemoteDescription.args[0],
      [remoteDescriptionObj]
    );
    t.deepEqual(
      rawConnection.addIceCandidate.args,
      [
        [wrappedServerIceCandidates[0]],
        [wrappedServerIceCandidates[1]]
      ]
    );
    t.deepEqual(cmgr.addConnection.args[0], [ipaddr, port, peerConnection]);

    resetCmgr();
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetCmgr();
  });
}

test('addConnection and getConnection correct in base case', function(t) {
  var cxn = sinon.stub();
  cxn.on = sinon.stub();
  var ipaddr = '1.2.3.4';
  var port = 1234;

  cmgr.addConnection(ipaddr, port, cxn);
  var actual = cmgr.getConnection(ipaddr, port, cxn);

  t.equal(actual, cxn);
  t.end();
  resetCmgr();
});

test('connection is removed after close event', function(t) {
  var cxn = new peerConn.PeerConnection(sinon.stub());
  var ipaddr = '1.2.3.4';
  var port = 7777;

  cmgr.addConnection(ipaddr, port, cxn);

  t.equal(cmgr.getConnection(ipaddr, port), cxn);
  cxn.emitClose();
  t.equal(cmgr.getConnection(ipaddr, port), null);
  t.end();
});

test('getConnection returns null if not present', function(t) {
  var actual = cmgr.getConnection('foo', 11);
  t.equal(actual, null);
  t.end();
});

test('removeConnection deletes connection if present', function(t) {
  var cxn = sinon.stub();
  cxn.on = sinon.stub();
  var ipaddr = '9.8.7.6';
  var port = 5555;

  cmgr.addConnection(ipaddr, port, cxn);
  cmgr.removeConnection(ipaddr, port);

  var actual = cmgr.getConnection(ipaddr, port);
  t.equal(actual, null);
  t.end();
});

test('removeConnection deletes safely if not present', function(t) {
  t.doesNotThrow(() => {
    cmgr.removeConnection('alpha', 111);
  });
  t.end();
});

test('createConnection resolves with PeerConnection on success', function(t) {
  createConnectionAssertionHelper(null, null, null, null, t);
});

test('createConnection rejects if createOffer rejects', function(t) {
  var expected = { error: 'create offer rejected' };
  createConnectionAssertionHelper(null, expected, null, null, t);
  
  cmgr.createConnection()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});

test('createConnection rejects if setLocalDescription rejects', function(t) {
  var expected = { error: 'setLocalDescription rejected' };
  createConnectionAssertionHelper(null, null, expected, null, t);
  
  cmgr.createConnection()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});

test('createConnection rejects if sendOffer rejects', function(t) {
  var expected = { error: 'sendOffer rejected' };
  createConnectionAssertionHelper(expected, null, null, null, t);
  
  cmgr.createConnection()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});

test('createConnection rejects if createDataChannel throws', function(t) {
  var expected = { error: 'createDataChannel threw' };
  createConnectionAssertionHelper(null, null, null, expected, t);
  
  cmgr.createConnection()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});

test('sendOffer resolves with PeerConnection', function(t) {
  sendOfferAssertionHelper(null, null, t);
});

test('sendOffer rejects if fetch rejects', function(t) {
  var expected = { error: 'fetch went wrong' };
  var wrappedCall = sendOfferAssertionHelper(expected, null, t);

  wrappedCall()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});

test('sendOffer rejects if setRemoteDescription rejects', function(t) {
  var expected = { error: 'setRemoteDescription went wrong' };
  var wrappedCall = sendOfferAssertionHelper(null, expected, t);

  wrappedCall()
  .then(res => {
    t.fail(res);
    t.end();
    resetCmgr();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetCmgr();
  });
});
