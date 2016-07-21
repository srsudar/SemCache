/* globals Promise */
'use strict';

/**
 * General file system operations.
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
 * @param {DirectoryEntry} dirEntry the directory to contain the new file
 * @param {string} path the name of the file
 * @param {Blob} fileBlob the content to write
 */
exports.write = function(dirEntry, name, fileBlob) {
  console.log('Unimplemented: ', dirEntry, name, fileBlob);
};

