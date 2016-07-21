'use strict';

/**
 * Objects to facilitate use of the file system and hide interactions with the
 * underlying web objects from callers.
 */

exports.File = function File() {
  if (!(this instanceof File)) {
    throw new Error('File must be called with new');
  }

};

exports.Directory = function Directory() {
  if (!(this instanceof Directory)) {
    throw new Error('Directory must be called with new');
  }

};
