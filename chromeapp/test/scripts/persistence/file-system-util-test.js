'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const binUtil = require('../../../app/scripts/dnssd/binary-utils').BinaryUtils;

let util = require('../../../app/scripts/persistence/file-system-util');


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

function proxyquireUtil(proxies) {
  util = proxyquire(
    '../../../app/scripts/persistence/file-system-util', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  resetUtil();
}

test('listEntries returns all entries', function(t) {
  let readEntriesSpy = sinon.stub();

  let arr1 = ['1stCall_a', '1stCall_b', '1stCall_c'];
  let arr2 = ['2ndCall_1', '2ndCall_2', '2ndCall_2'];
  let arr3 = ['3rdcall_y', '3rdcall_z'];

  let expectedEntries = arr1.concat(arr2).concat(arr3);

  readEntriesSpy.onCall(0).callsArgWith(0, arr1);
  readEntriesSpy.onCall(1).callsArgWith(0, arr2);
  readEntriesSpy.onCall(2).callsArgWith(0, arr3);
  readEntriesSpy.onCall(3).callsArgWith(0, []);

  let dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  let dirEntry = {};
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
  let readEntriesSpy = sinon.stub();

  readEntriesSpy.onCall(0).callsArgWith(0, []);

  let dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  let dirEntry = {};
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
  let readEntriesSpy = sinon.stub();

  let arr1 = ['a', 'b', 'c'];

  let errorMsg = 'there was an error';

  readEntriesSpy.onCall(0).callsArgWith(0, arr1);
  readEntriesSpy.onCall(1).callsArgWith(1, errorMsg);

  let dirReaderSpy = {};
  dirReaderSpy.readEntries = readEntriesSpy;

  let dirEntry = {};
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
  let buff = 'buff';
  let blob = 'blob';

  let buffToBlobStub = sinon.stub();
  buffToBlobStub.withArgs(buff).returns(blob);

  let writerSpy = {};
  let fileBlobArg = null;
  writerSpy.write = function(fileBlobParam) {
    fileBlobArg = fileBlobParam;
    // This indicates success. We're just scratching our own back to simulate
    // the end of a write for testing purposes--i.e. a write finishes
    // immediately.
    writerSpy.onwriteend();
  };

  let fileEntry = {};
  let createWriterSpy = sinon.stub();
  createWriterSpy.callsArgWith(0, writerSpy);
  fileEntry.createWriter = createWriterSpy;

  proxyquireUtil({
    '../util': {
      getBufferAsBlob: buffToBlobStub
    }
  });

  util.writeToFile(fileEntry, buff)
  .then(function() {
    t.equal(fileBlobArg, blob);
    t.end();
  })
  .catch(err => {
    t.fail(err);
    t.end();
    resetUtil();
  });
});

test('writeToFile rejects on error', function(t) {
  let buff = 'erroneous blob';
  let error = 'the error';

  let writerSpy = {};
  let fileBlobArg = null;
  writerSpy.write = function(fileBlobParam) {
    fileBlobArg = fileBlobParam;
    // This indicates success. We're just scratching our own back to simulate
    // the end of a write for testing purposes--i.e. a write finishes
    // immediately.
    writerSpy.onerror(error);
  };

  let fileEntry = {};
  let createWriterSpy = sinon.stub();
  createWriterSpy.callsArgWith(0, writerSpy);
  fileEntry.createWriter = createWriterSpy;

  proxyquireUtil({
    '../util': {
      getBufferAsBlob: sinon.stub()
    }
  });

  util.writeToFile(fileEntry, buff)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.equal(actual, error);
    end(t);
  });
});

test('getFile resolves with entry', function(t) {
  let getFileStub = sinon.stub();

  let dirEntry = {};
  dirEntry.getFile = getFileStub;

  let fileEntry = 'the created file';

  getFileStub.callsArgWith(2, fileEntry);

  let options = {
    foo: 1,
    bar: '2'
  };
  let name = 'fileName.txt';

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
  let getFileStub = sinon.stub();

  let dirEntry = {};
  dirEntry.getFile = getFileStub;

  let error = 'error whilst writing';

  getFileStub.callsArgWith(3, error);

  let options = {foo: 1, bar: '2'};
  let name = 'fileName.txt';

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
  let getDirectoryStub = sinon.stub();

  let dirEntry = {};
  dirEntry.getDirectory = getDirectoryStub;

  let directoryEntry = 'the created dir';

  getDirectoryStub.callsArgWith(2, directoryEntry);

  let options = {foo: 1, bar: '2'};
  let name = 'dirName';

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
  let getDirectoryStub = sinon.stub();

  let dirEntry = {};
  dirEntry.getDirectory = getDirectoryStub;

  let error = 'error whilst creating dir';

  getDirectoryStub.callsArgWith(3, error);

  let options = {
    foo: 1,
    bar: '2'
  };
  let name = 'erroneousDirName';

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
  let expected = { size: 12345 };

  let getMetadataCB = function(success) {
    success(expected); 
  };

  let entryStub = sinon.stub();
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
  let expected = { err: 'get metadata error' };

  let getMetadataCB = function(successCallback, errorCallback) {
    errorCallback(expected);
  };

  let entryStub = sinon.stub();
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
  let expected = { file: 'object' };

  let getFileStub = function(success) {
    success(expected); 
  };

  let entryStub = sinon.stub();
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
  let expected = { err: 'file error' };

  let getFileStub = function(successCallback, errorCallback) {
    errorCallback(expected); 
  };

  let entryStub = sinon.stub();
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
  let fileReaderStub = sinon.stub();
  util.createFileReader = sinon.stub().returns(fileReaderStub);

  // We write ArrayBuffer objects.
  let buff1 = binUtil.stringToArrayBuffer('Tyrion ');
  let buff2 = binUtil.stringToArrayBuffer('Lannister');
  let expectedResult = Buffer.from('Tyrion Lannister');

  let file = { stubType: 'file' };
  let fileEntry = { stubType: 'fileEntry' };

  util.getFileFromEntry = sinon.stub();
  util.getFileFromEntry.withArgs(fileEntry).resolves(file);

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

test('getFileContents rejects when onerror called', function(t) {
  let fileReaderStub = sinon.stub();
  util.createFileReader = sinon.stub().returns(fileReaderStub);

  let expectedError = { err: 'much wrong' };

  let file = { stubType: 'file' };
  let fileEntry = { stubType: 'fileEntry' };

  util.getFileFromEntry = sinon.stub();
  util.getFileFromEntry.withArgs(fileEntry).resolves(file);

  fileReaderStub.readAsArrayBuffer = function(actualFile) {
    t.equal(actualFile, file);
    // And now issue our calls to the events.
    fileReaderStub.onerror({ target: { error: expectedError } });
  };

  util.getFileContents(fileEntry)
  .then(res => {
    t.fail(res);
    end(t);
  })
  .catch(actual => {
    t.deepEqual(actual, expectedError);
    end(t);
  });
});
