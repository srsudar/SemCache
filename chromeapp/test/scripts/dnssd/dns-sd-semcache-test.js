'use strict';
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');

test('registerSemCache calls dnssd.register with correct args', function(t) {
  // This function should just call through to dns-sd.
  var registerMock = sinon.spy();
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {register: registerMock}
  });

  var name = 'Fancy SemCache';
  var port = 1234;

  dnssdSem.registerSemCache(name, port);

  // Verify register was called with the correct arguments.
  t.equal(registerMock.firstCall.args[0], name);
  t.equal(registerMock.firstCall.args[1], dnssdSem.getSemCacheServiceString());
  t.equal(registerMock.firstCall.args[2], port);

  t.end();
});

test('registerSemCache returns dnssd.register result', function(t) {
  // This function should just call through to dns-sd.
  var returnResult = 'foobar';
  var registerMock = sinon.stub().returns(returnResult);
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {register: registerMock}
  });

  var actualReturn = dnssdSem.registerSemCache('myname', 1111);
  t.equal(actualReturn, returnResult);

  t.end();
});

test('browseForSemCacheInstances calls browse with correct args', function(t) {
  // This function should just call through to dns-sd.
  var browseMock = sinon.spy();
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {browse: browseMock}
  });

  dnssdSem.browseForSemCacheInstances();

  // Verify register was called with the correct arguments.
  t.equal(browseMock.firstCall.args[0], dnssdSem.getSemCacheServiceString());

  t.end();
});

test('browseForSemCacheInstances returns dnssd.browse result', function(t) {
  // This function should just call through to dns-sd.
  var returnResult = 'manyinstances';
  var browseMock = sinon.stub().returns(returnResult);
  var dnssdSem = proxyquire('../../../app/scripts/dnssd/dns-sd-semcache', {
    './dns-sd': {browse: browseMock}
  });

  var actualReturn = dnssdSem.browseForSemCacheInstances();
  t.equal(actualReturn, returnResult);

  t.end();
});
