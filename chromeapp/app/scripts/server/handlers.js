/* globals WSC */
'use strict';

var _ = require('underscore');
var api = require('./server-api');
var fileSystem = require('../persistence/file-system');
var fsUtil = require('../persistence/file-system-util');
var binUtil = require('../dnssd/binary-utils').BinaryUtils;

/**
 * Handlers for the webserver backing SemCache. The idea for handlers is based
 * on https://github.com/kzahel/web-server-chrome, which is in turn based on
 * Python's Tornado web library, and is the back end for our web server.
 */

/**
 * Handler for the JSON endpoint for listing all pages in the cache.
 */
exports.ListCachedPagesHandler = function() {
  if (!WSC) {
    console.warn('CachedPagesHandler: WSC global object not present');
    return;
  }
  WSC.BaseHandler.prototype.constructor.call(this);
};

_.extend(exports.ListCachedPagesHandler.prototype,
  {
    get: function() {
      api.getResponseForAllCachedPages()
        .then(response => {
          this.setHeader('content-type', 'text/json');
          var encoder = new TextEncoder('utf-8');
          var buffer = encoder.encode(JSON.stringify(response)).buffer;
          this.write(buffer);
          this.finish();
        });
    }
  },
  WSC.BaseHandler.prototype
);

exports.CachedPageHandler = function() {
  if (!WSC) {
    console.warn('CachedPagesHandler: WSC global object not present');
    return;
  }
  WSC.BaseHandler.prototype.constructor.call(this);
};

_.extend(exports.CachedPageHandler.prototype,
  {
    get: function() {
      var fileName = api.getCachedFileNameFromPath(this.request.path);

      fileSystem.getDirectoryForCacheEntries()
        .then(cacheDir => {
          return fsUtil.getFile(
            cacheDir, 
            {
              create: false,
              exclusive: false
            },
            fileName
          );
        })
        .then(fileEntry => {
          fileEntry.file(file => {
            var that = this;
            var fileReader = new FileReader();

            fileReader.onload = function(evt) {
              // set mime types etc?
              that.write(evt.target.result);
            };

            fileReader.onerror = function(evt) {
              console.error('error reading', evt.target.error);
              that.request.connection.close();
            };

            fileReader.readAsArrayBuffer(file);
          });
        })
        .catch(err => {
          console.log('Error reading file: ', err);
        });
    }
  },
  WSC.BaseHandler.prototype
);

exports.WebRtcOfferHandler = function() {
  if (!WSC) {
    console.warn('WebRtcOfferHandler: WSC global object not present');
    return;
  }
  WSC.BaseHandler.prototype.constructor.call(this);
};

_.extend(exports.WebRtcOfferHandler.prototype,
  {
    post: function() {
      console.log('IN POST');
    },

    put: function() {
      console.log('IN PUT');
      console.log(this);
      window.req = this;

      var bodyStr = binUtil.arrayBufferToString(this.request.body);
      console.log('bodyStr: ' + bodyStr);

      var jsonResp = { foo: 'response from PUT' };
      var jsonBin = binUtil.stringToArrayBuffer(JSON.stringify(jsonResp));
      this.write(jsonBin);

    },

    get: function() {
      console.log('IN GET');
      var fileName = api.getCachedFileNameFromPath(this.request.path);

      fileSystem.getDirectoryForCacheEntries()
        .then(cacheDir => {
          return fsUtil.getFile(
            cacheDir, 
            {
              create: false,
              exclusive: false
            },
            fileName
          );
        })
        .then(fileEntry => {
          fileEntry.file(file => {
            var that = this;
            var fileReader = new FileReader();

            fileReader.onload = function(evt) {
              // set mime types etc?
              that.write(evt.target.result);
            };

            fileReader.onerror = function(evt) {
              console.error('error reading', evt.target.error);
              that.request.connection.close();
            };

            fileReader.readAsArrayBuffer(file);
          });
        })
        .catch(err => {
          console.log('Error reading file: ', err);
        });
    }
  },
  WSC.BaseHandler.prototype
);
