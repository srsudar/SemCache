/*jshint esnext:true*/
'use strict';

var Buffer = require('buffer/').Buffer;
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var util = require('../../app/scripts/util');

/**
 * A Data URI for a 'hello', in string represntation.
 */
const HELLO_URI_STR = 'data:application/octet-stream;base64,aGVsbG8=';

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetUtil() {
  delete require.cache[
    require.resolve('../../app/scripts/util')
  ];
  util = require('../../app/scripts/util');
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  resetUtil();
}

function helperAssertCanReclaim(t, obj) {
  let expected = Object.assign({}, obj);
  let buff = util.objToBuff(obj);
  let actual = util.buffToObj(buff);

  t.deepEqual(actual, expected);
  end(t);
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('fetchJson rejects with error', function(t) {
  var expected = { error: 'whoops' };
  util.fetch = sinon.stub().rejects(expected);
  util.fetchJson()
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
  .catch(actual => {
    t.equal(actual, expected);
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('getHostFromUrl returns hostname bare hostname', function(t) {
  var url = 'http://www.google.com';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, 'www.google.com');
  t.end();
});

test('getHostFromUrl returns hostname with port', function(t) {
  var url = 'http://123.4.55.6:80';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, '123.4.55.6');
  t.end();
});

test('getHostFromUrl returns hostname with hash', function(t) {
  var url = 'http://pappy.local#foo';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, 'pappy.local');
  t.end();
});

test('getHostFromUrl returns hostname with query param', function(t) {
  var url = 'http://555.444.333.1?uh-oh';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, '555.444.333.1');
  t.end();
});

test('getHostFromUrl returns IP address', function(t) {
  var url = 'http://1.2.3.4';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, '1.2.3.4');
  t.end();
});

test('getHostFromUrl returns IP with all options present', function(t) {
  var url = 'http://8.7.6.5:99#foo?thrice';
  var actual = util.getHostFromUrl(url);
  t.equal(actual, '8.7.6.5');
  t.end();
});

test('getHostFromUrl throws if not a url', function(t) {
  var url = 'nope';
  t.throws(() => { util.getHostFromUrl(url); });
  t.end();
});

test('getPortFromUrl returns port in base case', function(t) {
  var url = 'http://1.2.3.4:88';
  var actual = util.getPortFromUrl(url);
  t.equal(actual, 88);
  t.end();
});

test('getPortFromUrl returns port if path included', function(t) {
  var url = 'http://1.2.3.4:1234/hello/there.html';
  var actual = util.getPortFromUrl(url);
  t.equal(actual, 1234);
  t.end();
});

test('getPortFromUrl returns port if path with all options', function(t) {
  var url = 'http://1.2.3.4:1234#foo?thrice';
  var actual = util.getPortFromUrl(url);
  t.equal(actual, 1234);
  t.end();
});

test('getPortFromUrl throws if no port', function(t) {
  var url = 'http://1.2.3.4';
  t.throws(() => { util.getPortFromUrl(url); });
  t.end();
});

test('getPortFromUrl throws if port not an integer', function(t) {
  var url = 'http://1.2.3.4:hello';
  t.throws(() => { util.getPortFromUrl(url); });
  t.end();
});

test('getPortFromUrl not deceived by later colons', function(t) {
  var url = 'http://1.2.3.4/hello:yes';
  t.throws(() => { util.getPortFromUrl(url); });
  t.end();
});

test('toArray correct for item', function(t) {
  let item = { hey: 'yo' };
  let expected = [item];
  let actual = util.toArray(item);
  t.deepEqual(actual, expected);
  end(t);
});

test('toArray correct for array', function(t) {
  let expected = ['hey', 'ho'];
  let actual = util.toArray(expected);
  t.deepEqual(actual, expected);
  end(t);
});

test('dataToBuff correct', function(t) {
  let data = HELLO_URI_STR;
  let expected = Buffer.from('hello');
  let actual = util.dataToBuff(data);

  t.deepEqual(actual, expected);
  end(t);
});

test('buffToData correct', function(t) {
  let buff = Buffer.from('hello');
  let expected = HELLO_URI_STR;
  let actual = util.buffToData(buff);

  t.deepEqual(actual, expected);
  end(t);
});

test('objToBuff/bufftoObj correct for all JSON', function(t) {
  let obj = {
    hello: 'hey!',
    age: 48
  };

  helperAssertCanReclaim(t, obj);
});

test('objToBuff/bufftoObj correct for all Buffers', function(t) {
  let obj = {
    buff1: Buffer.from('i am buff 1'),
    buff2: Buffer.from('you dont know me')
  };

  helperAssertCanReclaim(t, obj);
});

test('objToBuff/bufftoObj correct for single Buffer', function(t) {
  let obj = {
    buff1: Buffer.from('heyyyy'),
  };

  helperAssertCanReclaim(t, obj);
});

test('objToBuff/bufftoObj correct for mixed properties', function(t) {
  let obj = {
    name: 'sam',
    age: 999,
    buff1: Buffer.from('number 1'),
    buff2: Buffer.from('do you even lift')
  };

  helperAssertCanReclaim(t, obj);
});
