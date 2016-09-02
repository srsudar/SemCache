/*jshint esnext:true*/
'use strict';
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var util = require('../../app/scripts/util');

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
  });
});
