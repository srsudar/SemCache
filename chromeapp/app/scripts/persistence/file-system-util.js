/* globals Promise */
'use strict';

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
 * @return {Promise} Promise that resolves with an Array of Entry objects
 * that are the contents of the directory
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
 * @return {Promise} Promise that resolves when the write is complete or
 * rejects with an error
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
 * @param {object} options object to pass to getFile function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise} Promise that resolves with the FileEntry or rejects with
 * an error
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
 * @param {object} options object to pass to getDirectory function
 * @param {string} name the file name in dirEntry
 *
 * @return {Promise} Promise that resolves with the DirectoryEntry or rejects
 * with an error
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
