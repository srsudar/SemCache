/*jshint esnext:true*/
'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var evaluation = require('../../app/scripts/evaluation');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetEvaluation() {
  delete require.cache[
    require.resolve('../../app/scripts/evaluation')
  ];
}

/**
 * Proxyquire the evaluation object with proxies passed as the proxied modules.
 */
function proxyquireEvaluation(proxies) {
  evaluation = proxyquire(
    '../../app/scripts/evaluation',
    proxies
  );
}

test('generateDummyPage incorporates nonce and number', function(t) {
  var index = 123;
  var nonce = 'feefifofum';

  var actual = evaluation.generateDummyPage(index, nonce);

  t.notEqual(actual.captureUrl.indexOf(index), -1);
  t.notEqual(actual.captureUrl.indexOf(nonce), -1);
  t.end();
  resetEvaluation();
});

test('generateDummyPages calls helper and correct size', function(t) {
  var page1 = 'foo';
  var page2 = 'bar';

  var numPages = 2;
  var nonce = 'abcdef';

  var generateDummyPageSpy = sinon.stub();
  generateDummyPageSpy.onCall(0).returns(page1);
  generateDummyPageSpy.onCall(1).returns(page2);
  evaluation.generateDummyPage = generateDummyPageSpy;

  var expected = [page1, page2];
  var actual = evaluation.generateDummyPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPageSpy.args[0], [0, nonce]);
  t.deepEqual(generateDummyPageSpy.args[1], [1, nonce]);
  t.end();
  resetEvaluation();
});

test('getDummyResponseForAllCachedPages calls helpers', function(t) {
  var mdataObj = { md: 'meta' };
  var pages = ['alpha', 'beta'];

  var createMetadatObjSpy = sinon.stub().returns(mdataObj);
  var generateDummyPagesSpy = sinon.stub().returns(pages);

  proxyquireEvaluation({
    './server/server-api': {
      createMetadatObj: createMetadatObjSpy
    }
  });
  evaluation.generateDummyPages = generateDummyPagesSpy;

  var numPages = 5;
  var nonce = 'poobear';

  var expected = {
    metadata: mdataObj,
    cachedPages: pages
  };

  var actual = evaluation.getDummyResponseForAllCachedPages(numPages, nonce);

  t.deepEqual(actual, expected);
  t.deepEqual(generateDummyPagesSpy.args[0], [numPages, nonce]);
  t.end();
  resetEvaluation();
});
