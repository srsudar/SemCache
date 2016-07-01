var test = require('tape');
var bu = require('../../../app/scripts/dnssd/binary-utils');
var rr = require('../../../app/scripts/dnssd/byte-array');
var rr = require('../../../app/scripts/dnssd/chromeUdp');
var rr = require('../../../app/scripts/dnssd/dns-codes');
var rr = require('../../../app/scripts/dnssd/dns-packet');
var rr = require('../../../app/scripts/dnssd/dns-record');
var rr = require('../../../app/scripts/dnssd/dns-resource-record');
var rr = require('../../../app/scripts/dnssd/dns-sd');
var rr = require('../../../app/scripts/dnssd/dns-utils');
var rr = require('../../../app/scripts/dnssd/event-target');
var rr = require('../../../app/scripts/dnssd/ip-utils');

test('test this', function(t) {
  t.doesNotThrow(function() {
    console.log('hello');
  });
  t.end();
});

