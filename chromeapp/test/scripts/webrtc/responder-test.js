'use strict';
var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');
var responder = require('../../../app/scripts/webrtc/responder');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetResponder() {
  delete require.cache[
    require.resolve('../../../app/scripts/webrtc/responder')
  ];
  responder = require('../../../app/scripts/webrtc/responder');
}

test('onList calls sendBuffer with binary contents', function(t) {
  var json = { page1: 'nyt', page2: 'wapo' };
  var channel = 'i am the channel';
  var buffer = Buffer.from(JSON.stringify(json));
  var getResponseForAllCachedPagesSpy = sinon.stub().resolves(json);

  var ccServerSpy = sinon.stub();
  ccServerSpy.sendBuffer = sinon.stub();

  var createCcServerSpy = sinon.stub().withArgs(channel)
    .returns(ccServerSpy);

  responder = proxyquire(
    '../../../app/scripts/webrtc/responder',
    {
      '../server/server-api': {
        getResponseForAllCachedPages: getResponseForAllCachedPagesSpy
      }
    }
  );
  responder.createCcServer = createCcServerSpy;

  responder.onList(channel)
  .then(() => {
    t.deepEqual(ccServerSpy.sendBuffer.args[0], [buffer]);
    t.end();
    resetResponder();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetResponder();
  });
});

test('onList rejects with error', function(t) {
  var channel = 'i am the channel';
  var expected = { error: 'went south' };
  var getResponseForAllCachedPagesSpy = sinon.stub().rejects(expected);

  responder = proxyquire(
    '../../../app/scripts/webrtc/responder',
    {
      '../server/server-api': {
        getResponseForAllCachedPages: getResponseForAllCachedPagesSpy
      }
    }
  );

  responder.onList(channel)
  .then(res => {
    t.fail(res);
    t.end();
    resetResponder();
  })
  .catch(actual => {
    t.deepEqual(actual, expected);
    t.end();
    resetResponder();
  });
});

test('onFile calls sendBuffer with file contents', function(t) {
  var fileName = 'file-name';
  var accessPath = 'path/to/file';
  var msg = { request: { accessPath: accessPath } };
  var buff = Buffer.from('file contents');
  var channel = { testType: 'channel' };

  var ccServerSpy = sinon.stub();
  var createCcServerSpy = sinon.stub().withArgs(channel)
    .returns(ccServerSpy);

  var sendBufferSpy = sinon.stub();
  ccServerSpy.sendBuffer = sendBufferSpy;

  var getCachedFileNameFromPathSpy = sinon.stub().withArgs(accessPath)
    .returns(fileName);
  var getFileContentsFromNameSpy = sinon.stub().withArgs(fileName)
    .resolves(buff);

  responder = proxyquire(
    '../../../app/scripts/webrtc/responder',
    {
      '../persistence/file-system': {
        getFileContentsFromName: getFileContentsFromNameSpy
      },
      '../server/server-api': {
        getCachedFileNameFromPath: getCachedFileNameFromPathSpy
      }
    }
  );
  responder.createCcServer = createCcServerSpy;

  responder.onFile(channel, msg)
  .then(() => {
    t.deepEqual(createCcServerSpy.args[0], [channel]);
    t.deepEqual(sendBufferSpy.args[0], [buff]);
    t.end();
    resetResponder();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetResponder();
  });
});

test('onFile rejects with error', function(t) {
  var fileName = 'file-name';
  var accessPath = 'path/to/file';
  var msg = { request: { accessPath: accessPath } };
  var channel = { testType: 'channel' };

  var expected = { error: 'trouble' };

  var getCachedFileNameFromPathSpy = sinon.stub().returns(fileName);
  var getFileContentsFromNameSpy = sinon.stub().withArgs(fileName)
    .rejects(expected);

  responder = proxyquire(
    '../../../app/scripts/webrtc/responder',
    {
      '../persistence/file-system': {
        getFileContentsFromName: getFileContentsFromNameSpy
      },
      '../server/server-api': {
        getCachedFileNameFromPath: getCachedFileNameFromPathSpy
      }
    }
  );

  responder.onFile(channel, msg)
  .then(res => {
    t.fail(res);
    t.end();
    resetResponder();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
    resetResponder();
  });
});

test('onDataChannelMessageHandler routes correctly', function(t) {
  var channel = { testType: 'channel' };
  var msg = { foo: 'msg' };
  var msgBin = Buffer.from(JSON.stringify(msg));

  var event = { data: msgBin };

  var isListSpy = sinon.stub();
  var isFileSpy = sinon.stub();
 
  var onListSpy = sinon.stub();
  var onFileSpy = sinon.stub();

  responder = proxyquire(
    '../../../app/scripts/webrtc/responder',
    {
      './message': {
        isList: isListSpy,
        isFile: isFileSpy
      }
    }
  );
  responder.onList = onListSpy;
  responder.onFile = onFileSpy;

  // First a list message
  isListSpy.returns(true);
  isFileSpy.returns(false);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 0);
  t.deepEqual(onListSpy.args[0], [channel, msg]);

  // Now a file message
  isListSpy.returns(false);
  isFileSpy.returns(true);

  responder.onDataChannelMessageHandler(channel, event);

  t.equal(onListSpy.callCount, 1);
  t.equal(onFileSpy.callCount, 1);
  t.deepEqual(onFileSpy.args[0], [channel, msg]);

  resetResponder();

  t.end();
});

test('onDataChannelHandler adds onmessage handler to channels', function(t) {
  var channel = sinon.stub();
  var event = { channel: channel };

  var onDataChannelMessageHandlerSpy = sinon.stub();

  responder.onDataChannelMessageHandler = onDataChannelMessageHandlerSpy;

  responder.onDataChannelHandler(event);

  var msgEvent = 'message event';
  channel.onmessage(msgEvent);

  t.deepEqual(onDataChannelMessageHandlerSpy.args[0], [channel, msgEvent]);
  t.end();
  resetResponder();
});
