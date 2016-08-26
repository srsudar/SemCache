/*jshint esnext:true*/
'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var util = require('../../../app/scripts/util/util.js');

function proxyquireUtil(proxies) {
  util = proxyquire('../../../app/scripts/util/util.js', proxies);
}

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetUtil() {
  delete require.cache[
    require.resolve('../../../app/scripts/util/util.js')
  ];
  util = require('../../../app/scripts/util/util.js');
}

test('getOnCompletePromise resolves if already complete', function(t) {
  var doc = {};
  doc.readyState = 'complete';
  doc.addEventListener = sinon.stub();
  var getDocumentSpy = sinon.stub().returns(doc);
  util.getDocument = getDocumentSpy;

  util.getOnCompletePromise()
    .then(() => {
      t.end();
      resetUtil();
    });
});

test('getOnCompletePromise resolves after complete', function(t) {
  var doc = {};
  doc.readyState = 'interactive';
  var addEventListenerSpy = sinon.stub();
  doc.addEventListener = addEventListenerSpy;
  var getDocumentSpy = sinon.stub().returns(doc);

  util.getDocument = getDocumentSpy;

  util.getOnCompletePromise()
    .then(() => {
      t.equal(addEventListenerSpy.args[0][0], 'readystatechange');
      t.end();
      resetUtil();
    });

  // The promise is waiting. Retrieve the event listener and invoke it.
  doc.readyState = 'complete';
  var checkState = addEventListenerSpy.args[0][1];
  checkState();
});

test('getActiveTab returns 0th tab from tabs API', function(t) {
  var tabs = ['foo', 'bar'];
  var expectedQueryArg = { currentWindow: true, active: true };
  var querySpy = sinon.stub().withArgs(expectedQueryArg).resolves(tabs);

  proxyquireUtil({
    '../chrome-apis/tabs': {
      query: querySpy
    }
  });

  util.getActiveTab()
    .then(actual => {
      t.deepEqual(actual, tabs[0]);
      t.end();
      resetUtil();
    });

});
