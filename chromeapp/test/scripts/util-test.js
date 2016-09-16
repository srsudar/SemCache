/*jshint esnext:true*/
'use strict';
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var util = require('../../app/scripts/util');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetUtil() {
  delete require.cache[
    require.resolve('../../../app/scripts/util')
  ];
  util = require('../../../app/scripts/util');
}

test('fetchJson invokes promises and resolves', function(t) {
  var url = 'http://ip.jsontest.com';

  var jsonResponse = { foo: 'bar' };
  var responseSpy = {
    json: sinon.stub().resolves(jsonResponse)
  };
  var fetchSpy = sinon.stub().resolves(responseSpy);
  util.fetch = fetchSpy;

  util.fetchJson(url)
  .then(actual => {
    t.deepEqual(actual, jsonResponse);
    t.deepEqual(fetchSpy.args[0], [ url ]);

    t.end();
    resetUtil();
  });
});

test('waitInRange calls random int and wait with result', function(t) {
  var waitTime = 111;
  var randomIntSpy = sinon.stub().returns(waitTime);
  var waitSpy = sinon.stub().resolves();

  util.randomInt = randomIntSpy;
  util.wait = waitSpy;

  var min = 22;
  var max = 333;

  util.waitInRange(min, max)
    .then(() => {
      // + 1 because the call to randomInt is +1 to be inclusive
      t.deepEqual(randomIntSpy.args[0], [min, max + 1]);
      t.deepEqual(waitSpy.args[0], [waitTime]);
      t.end();
      resetUtil();
    });
});
