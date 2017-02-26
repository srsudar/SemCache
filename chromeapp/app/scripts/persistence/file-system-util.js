/* globals Promise */
'use strict';

var Buffer = require('buffer/').Buffer;

/**
 * General file system operations on top of the web APIs.
 */

/*
 * This code is based on the Mozilla and HTML5Rocks examples shown here:
 * https://developer.mozilla.org/en/docs/Web/API/DirectoryReader
 */
function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

/**
 * @param {DirectoryEntry} dirEntry the directory to list
 *
 * @return {Promise.<Array.<Entry>, Error>} Promise that resolves with an Array
 * of Entry objects that are the contents of the directory
 */
exports.listEntries = function(dirEntry) {
  // This code is based on the Mozilla and HTML5Rocks examples shown here:
  // https://developer.mozilla.org/en/docs/Web/API/DirectoryReader
  var dirReader = dirEntry.createReader();
  var entries = [];

  return new Promise(function(resolve, reject) {

    // Keep calling readEntries() until no more results are returned.
    var readEntries = function() {
      dirReader.readEntries (function(results) {
        if (!results.length) {
          resolve(entries.sort());
        } else {
          entries = entries.concat(toArray(results));
          readEntries();
        }
      }, function(err) {
        reject(err);
      });
    };

    readEntries();
  });
};

/**
 * @param {FileEntry} fileEntry the file that will be written to
 * @param {Blob} fileBlob the content to write
 *
 * @return {Promise.<undefined, Error>} Promise that resolves when the write is
 * complete or rejects with an error
 */
exports.writeToFile = function(fileEntry, fileBlob) {
  return new Promise(function(resolve, reject) {
    fileEntry.createWriter(function(fileWriter) {

      fileWriter.onwriteend = function() {
        resolve();
      };

      fileWriter.onerror = function(err) {
        reject(err);
      };

      fileWriter.write(fileBlob);
    });
  });
};

/**
 * A Promise-ified version of DirectoryEntry.getFile().
 *
 * @param {DirectoryEntry} dirEntry the parent directory
 * @param {Object} options object to pass to getFile function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise.<FileEntry, Error>} Promise that resolves with the
 * FileEntry or rejects with an error
 */
exports.getFile = function(dirEntry, options, name) {
  return new Promise(function(resolve, reject) {
    dirEntry.getFile(name, options, function(fileEntry) {
      resolve(fileEntry);
    },
    function(err) {
      reject(err);
    });
  });
};

/**
 * A Promise-ified version of DirectoryEntry.getDirectory().
 *
 * @param {DirectoryEntry} dirEntry the parent directory
 * @param {Object} options object to pass to getDirectory function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise.<DirectoryEntry, Error>} Promise that resolves with the
 * DirectoryEntry or rejects with an error
 */
exports.getDirectory = function(dirEntry, options, name) {
  return new Promise(function(resolve, reject) {
    dirEntry.getDirectory(name, options, function(dirEntry) {
      resolve(dirEntry);
    },
    function(err) {
      reject(err);
    });
  });
};

/**
 * @param {FileSystemEntry} entry
 *
 * @return {Promise.<Metadata, Error>} Promise that resolves with the size of
 * the file or rejects with an Error
 */
exports.getMetadata = function(entry) {
  return new Promise(function(resolve, reject) {
    entry.getMetadata(
      function success(metadata) {
        resolve(metadata);
      },
      function error(err) {
        reject(err); 
      }
    );
  });
};

/**
 * Promise-ified wrapper around the FileSystemFileEntry.file() method.
 *
 * @param {FileSystemFileEntry} fileEntry
 *
 * @return {Promise.<File, Error>} Promise that resolves with the File or
 * rejects with an Error
 */
exports.getFileFromEntry = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    fileEntry.file(
      function success(file) {
        resolve(file);
      },
      function error(err) {
        reject(err); 
      }
    );
  });
};

/**
 * Retrieves the binary contents of a file.
 *
 * @param {FileEntry} fileEntry the fileEntry for which you want the contents
 *
 * @return {Promise.<Buffer, Error>} Promise that resolves with a Buffer object
 * containing the binary content of the file or rejects with an Error.
 */
exports.getFileContents = function(fileEntry) {
  return new Promise(function(resolve, reject) {
    // Array of Buffers that we write chunks to as we receive them.
    var chunks = [];
    exports.getFileFromEntry(fileEntry)
    .then(file => {
      var fileReader = exports.createFileReader();

      fileReader.onload = function(evt) {
        // We want to push Buffers, not ArrayBuffers.
        var arrayBuffer = evt.target.result;
        chunks.push(Buffer.from(arrayBuffer));
      };

      fileReader.onloadend = function() {
        try {
          var result = Buffer.concat(chunks);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      fileReader.onerror = function(evt) {
        console.error('error reading ', evt.target.error);
        reject(evt.target.error);
      };

      fileReader.readAsArrayBuffer(file);
    })
    .catch(err => {
      reject(err);
    });
  }); 
};

/**
 * Exposed for testing.
 *
 * @return {FileReader} result of a straight call to new FileReader()
 */
exports.createFileReader = function() {
  return new FileReader();
};
