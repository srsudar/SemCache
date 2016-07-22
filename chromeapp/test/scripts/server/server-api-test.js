'use strict';
var test = require('tape');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
require('sinon-as-promised');

var api = require('../../../app/scripts/server/server-api');

test('getAccessUrlForCachedPage outputs correct url', function(t) {
  var fullPath = 'www.example.com_somedate';

  // TODO: For now we are hard-coding in the host and port, which we'll later
  // have to inject in
  var expected = 'http://127.0.0.1:8081/pages/' + fullPath;
  var actual = api.getAccessUrlForCachedPage(fullPath);

  t.equal(expected, actual);
  t.end();
});

