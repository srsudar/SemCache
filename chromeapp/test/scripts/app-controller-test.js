/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetAppController() {
  delete require.cache[
    require.resolve('../../app/scripts/app-controller')
  ];
}

test('saveMhtmlAndOpen persists and opens', function(t) {
  var fakeEntry = {
    fullPath: 'a full path'
  };
  var addPageStub = sinon.stub().resolves(fakeEntry);
  var sendMessageToOpenSpy = sinon.spy();

  var absPathToBaseDir = '/some/absolute/path/semcachedir';

  var fileUrl = 'file:///some path to the dir';
  var constructFileSchemeUrlSpy = sinon.stub().returns(fileUrl);

  // ADD THE ABSOLUTE PATH TO THE BASE DIRECTORY
  var appc = proxyquire(
    '../../app/scripts/app-controller',
    {
      './persistence/datastore': {
        addPageToCache: addPageStub
      },
      './extension-bridge/messaging': {
        sendMessageToOpenUrl: sendMessageToOpenSpy
      },
      './persistence/file-system': {
        constructFileSchemeUrl: constructFileSchemeUrlSpy
      }
    }
  );
  
  var blob = 'the fake blob';
  var responseStub = sinon.stub();
  responseStub.blob = sinon.stub().resolves(blob);
  
  var fetchStub = sinon.stub().resolves(responseStub);
  appc.fetch = fetchStub;
  appc.getAbsPathToBaseDir = sinon.stub().returns(absPathToBaseDir);

  var captureUrl = 'the capture url';
  var captureDate = 'the date it was captured';
  var accessPath = 'the url to download the mhtml';
  appc.saveMhtmlAndOpen(captureUrl, captureDate, accessPath)
    .then(() => {
      t.equal(sendMessageToOpenSpy.args[0][0], fileUrl); 
      t.end();
      resetAppController();
    });
});
