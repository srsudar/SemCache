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

test('writeToFile resolves on completion', function(t) {
  var fileBlob = 'blobbity blob';

  var writerSpy = {};
  var fileBlobArg = null;
  writerSpy.write = function(fileBlobParam) {
    fileBlobArg = fileBlobParam;
    // This indicates success. We're just scratching our own back to simulate
    // the end of a write for testing purposes--i.e. a write finishes
    // immediately.
    writerSpy.onwriteend();
  };

  var fileEntry = {};
  var createWriterSpy = sinon.stub();
  createWriterSpy.callsArgWith(0, writerSpy);
  fileEntry.createWriter = createWriterSpy;

  util.writeToFile(fileEntry, fileBlob)
  .then(function() {
    t.equal(fileBlobArg, fileBlob);
    t.end();
  });
});

test('writeToFile rejects on error', function(t) {
  var fileBlob = 'erroneous blob';
  var error = 'the error';

  var writerSpy = {};
  var fileBlobArg = null;
  writerSpy.write = function(fileBlobParam) {
    fileBlobArg = fileBlobParam;
    // This indicates success. We're just scratching our own back to simulate
    // the end of a write for testing purposes--i.e. a write finishes
    // immediately.
    writerSpy.onerror(error);
  };

  var fileEntry = {};
  var createWriterSpy = sinon.stub();
  createWriterSpy.callsArgWith(0, writerSpy);
  fileEntry.createWriter = createWriterSpy;

  util.writeToFile(fileEntry, fileBlob)
  .catch(function(actualError) {
    t.equal(actualError, error);
    t.equal(fileBlobArg, fileBlob);
    t.end();
  });
});

test('getFile resolves with entry', function(t) {
  var getFileStub = sinon.stub();

  var dirEntry = {};
  dirEntry.getFile = getFileStub;

  var fileEntry = 'the created file';

  getFileStub.callsArgWith(2, fileEntry);

  var options = {foo: 1, bar: '2'};
  var name = 'fileName.txt';

  util.getFile(dirEntry, options, name)
  .then(actualEntry => {
    t.deepEqual(getFileStub.args[0][0], name);
    t.deepEqual(getFileStub.args[0][1], options);
    t.equal(actualEntry, fileEntry);
    t.end();
  });
});


test('getFile rejects with error', function(t) {
  var getFileStub = sinon.stub();

  var dirEntry = {};
  dirEntry.getFile = getFileStub;

  var error = 'error whilst writing';

  getFileStub.callsArgWith(3, error);

  var options = {foo: 1, bar: '2'};
  var name = 'fileName.txt';

  util.getFile(dirEntry, options, name)
  .catch(actualError => {
    t.deepEqual(getFileStub.args[0][0], name);
    t.deepEqual(getFileStub.args[0][1], options);
    t.equal(actualError, error);
    t.end();
  });
});

test('getDirectory resolves with entry', function(t) {
  var getDirectoryStub = sinon.stub();

  var dirEntry = {};
  dirEntry.getDirectory = getDirectoryStub;

  var directoryEntry = 'the created dir';

  getDirectoryStub.callsArgWith(2, directoryEntry);

  var options = {foo: 1, bar: '2'};
  var name = 'dirName';

  util.getDirectory(dirEntry, options, name)
  .then(actualEntry => {
    t.deepEqual(getDirectoryStub.args[0][0], name);
    t.deepEqual(getDirectoryStub.args[0][1], options);
    t.equal(actualEntry, directoryEntry);
    t.end();
  });
});


test('getDirectory rejects with error', function(t) {
  var getDirectoryStub = sinon.stub();

  var dirEntry = {};
  dirEntry.getDirectory = getDirectoryStub;

  var error = 'error whilst creating dir';

  getDirectoryStub.callsArgWith(3, error);

  var options = {foo: 1, bar: '2'};
  var name = 'erroneousDirName';

  util.getDirectory(dirEntry, options, name)
  .catch(actualError => {
    t.deepEqual(getDirectoryStub.args[0][0], name);
    t.deepEqual(getDirectoryStub.args[0][1], options);
    t.equal(actualError, error);
    t.end();
  });
});
