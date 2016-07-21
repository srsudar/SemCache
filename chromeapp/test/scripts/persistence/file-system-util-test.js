'use strict';
var test = require('tape');
var sinon = require('sinon');
require('sinon-as-promised');

var util = require('../../../app/scripts/persistence/file-system-util');

test('listEntries returns all entries', function(t) {
  var readEntriesSpy = sinon.stub();

  var arr1 = ['1stCall_a', '1stCall_b', '1stCall_c'];
  var arr2 = ['2ndCall_1', '2ndCall_2', '2ndCall_2'];
  var arr3 = ['3rdcall_y', '3rdcall_z'];

  var expectedEntries = arr1.concat(arr2).concat(arr3);

  readEntriesSpy.onCall(0).callsArgWith(0, arr1);
  readEntriesSpy.onCall(1).callsArgWith(0, arr2);
  readEntriesSpy.onCall(2).callsArgWith(0, arr3);
  readEntriesSpy.onCall(3).callsArgWith(0, []);

  var dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  var dirEntry = {};
  dirEntry.createReader = sinon.stub().returns(dirReaderSpy);

  util.listEntries(dirEntry)
  .then(entries => {
    t.deepEqual(entries, expectedEntries);
    t.end();
  });
});

test('listEntries returns empty Array if no entries', function(t) {
  var readEntriesSpy = sinon.stub();

  readEntriesSpy.onCall(0).callsArgWith(0, []);

  var dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  var dirEntry = {};
  dirEntry.createReader = sinon.stub().returns(dirReaderSpy);

  util.listEntries(dirEntry)
  .then(entries => {
    t.deepEqual(entries, []);
    t.end();
  });
});

test('listEntries catches if error callback invoked', function(t) {
  var readEntriesSpy = sinon.stub();

  var arr1 = ['a', 'b', 'c'];

  var errorMsg = 'there was an error';

  readEntriesSpy.onCall(0).callsArgWith(0, arr1);
  readEntriesSpy.onCall(1).callsArgWith(1, errorMsg);

  var dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  var dirEntry = {};
  dirEntry.createReader = sinon.stub().returns(dirReaderSpy);

  util.listEntries(dirEntry)
  .catch(err => {
    t.deepEqual(err, errorMsg);
    t.end();
  });
});
