'use strict';
var Buffer = require('buffer').Buffer;
var test = require('tape');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
require('sinon-as-promised');

var binUtil = require('../../../app/scripts/dnssd/binary-utils').BinaryUtils;
var util = require('../../../app/scripts/persistence/file-system-util');

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function resetUtil() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/file-system-util')
  ];
  util = require('../../../app/scripts/persistence/file-system-util');
}

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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
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
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
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
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
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

  var options = {
    foo: 1,
    bar: '2'
  };
  var name = 'fileName.txt';

  util.getFile(dirEntry, options, name)
  .then(actualEntry => {
    t.deepEqual(getFileStub.args[0][0], name);
    t.deepEqual(getFileStub.args[0][1], options);
    t.equal(actualEntry, fileEntry);
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
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
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
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
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});


test('getDirectory rejects with error', function(t) {
  var getDirectoryStub = sinon.stub();

  var dirEntry = {};
  dirEntry.getDirectory = getDirectoryStub;

  var error = 'error whilst creating dir';

  getDirectoryStub.callsArgWith(3, error);

  var options = {
    foo: 1,
    bar: '2'
  };
  var name = 'erroneousDirName';

  util.getDirectory(dirEntry, options, name)
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
  .catch(actualError => {
    t.deepEqual(getDirectoryStub.args[0][0], name);
    t.deepEqual(getDirectoryStub.args[0][1], options);
    t.equal(actualError, error);
    t.end();
  });
});

test('getMetadata resolves with metadata if success', function(t) {
  var expected = { size: 12345 };

  var getMetadataCB = function(success) {
    success(expected); 
  };

  var entryStub = sinon.stub();
  entryStub.getMetadata = getMetadataCB;

  util.getMetadata(entryStub)
  .then(actual => {
    t.equal(actual, expected);
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('getMetadata rejects on error', function(t) {
  var expected = { err: 'get metadata error' };

  var getMetadataCB = function(successCallback, errorCallback) {
    errorCallback(expected);
  };

  var entryStub = sinon.stub();
  entryStub.getMetadata = getMetadataCB;

  util.getMetadata(entryStub)
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
  });
});

test('getFileFromEntry resolves with file if success', function(t) {
  var expected = { file: 'object' };

  var getFileStub = function(success) {
    success(expected); 
  };

  var entryStub = sinon.stub();
  entryStub.file = getFileStub;

  util.getFileFromEntry(entryStub)
  .then(actual => {
    t.equal(actual, expected);
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('getFileFromEntry rejects on error', function(t) {
  var expected = { err: 'file error' };

  var getFileStub = function(successCallback, errorCallback) {
    errorCallback(expected); 
  };

  var entryStub = sinon.stub();
  entryStub.file = getFileStub;

  util.getFileFromEntry(entryStub)
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
  .catch(actual => {
    t.equal(actual, expected);
    t.end();
  });
});

test('getFileContents resolves with full contents', function(t) {
  var fileReaderStub = sinon.stub();
  util.createFileReader = sinon.stub().returns(fileReaderStub);

  // We write ArrayBuffer objects.
  var buff1 = binUtil.stringToArrayBuffer('Tyrion ');
  var buff2 = binUtil.stringToArrayBuffer('Lannister');
  var expectedResult = Buffer.from('Tyrion Lannister');

  var file = { stubType: 'file' };
  var fileEntry = { stubType: 'fileEntry' };

  util.getFileFromEntry = sinon.stub().withArgs(fileEntry).resolves(file);

  fileReaderStub.readAsArrayBuffer = function(actualFile) {
    t.equal(actualFile, file);
    // And now issue our calls to the events.
    fileReaderStub.onload({ target: { result: buff1 } });
    fileReaderStub.onload({ target: { result: buff2 } });
    fileReaderStub.onloadend();
  };

  util.getFileContents(fileEntry)
  .then(actual => {
    t.deepEqual(actual, expectedResult);
    t.equal(actual.toString(), 'Tyrion Lannister');
    t.end();
    resetUtil();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('getFileContents rejects if Buffer.concat fails', function(t) {
  var fileReaderStub = sinon.stub();
  var expected = { error: 'nope' };

  var file = { stubType: 'file' };
  var fileEntry = { stubType: 'fileEntry' };

  util = proxyquire('../../../app/scripts/persistence/file-system-util', {
    'buffer': {
      Buffer: {
        concat: sinon.stub().throws(expected)
      }
    }
  });
  util.createFileReader = sinon.stub().returns(fileReaderStub);
  util.getFileFromEntry = sinon.stub().withArgs(fileEntry).resolves(file);

  fileReaderStub.readAsArrayBuffer = function(actualFile) {
    t.equal(actualFile, file);
    // And now issue our calls to the events.
    fileReaderStub.onloadend();
  };

  util.getFileContents(fileEntry)
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

test('getFileContents rejects when onerror called', function(t) {
  var fileReaderStub = sinon.stub();
  util.createFileReader = sinon.stub().returns(fileReaderStub);

  var expectedError = { err: 'much wrong' };

  var file = { stubType: 'file' };
  var fileEntry = { stubType: 'fileEntry' };

  util.getFileFromEntry = sinon.stub().withArgs(fileEntry).resolves(file);

  fileReaderStub.readAsArrayBuffer = function(actualFile) {
    t.equal(actualFile, file);
    // And now issue our calls to the events.
    fileReaderStub.onerror({ target: { error: expectedError } });
  };

  util.getFileContents(fileEntry)
  .then(res => {
    t.fail(res);
    t.end();
    resetUtil();
  })
  .catch(actual => {
    t.deepEqual(actual, expectedError);
    t.end();
    resetUtil();
  });
});
