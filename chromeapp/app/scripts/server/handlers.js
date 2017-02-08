/* globals WSC, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate */
'use strict';

var _ = require('underscore');
var api = require('./server-api');
var fileSystem = require('../persistence/file-system');
var fsUtil = require('../persistence/file-system-util');
var binUtil = require('../dnssd/binary-utils').BinaryUtils;
var rtcConnMgr = require('../webrtc/connection-manager');
var webrtcUtil = require('../webrtc/util');
var wrtcResponder = require('../webrtc/responder');

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

      var that = this;

      var bodyStr = binUtil.arrayBufferToString(this.request.body);
      console.log('bodyStr: ' + bodyStr);

      var bodyJson = JSON.parse(bodyStr);

      var pc = new RTCPeerConnection(null, webrtcUtil.optionalCreateArgs);
      pc.onicecandidate = onIceCandidate;
      var remoteDescription = new RTCSessionDescription(bodyJson.description);
      pc.setRemoteDescription(remoteDescription);
      rtcConnMgr.remote = pc;

      bodyJson.iceCandidates.forEach(candidateStr => {
        var candidate = new RTCIceCandidate(candidateStr);
        pc.addIceCandidate(candidate);
      });

      var iceCandidates = [];
      var description = null;
      var doneWithIce = false;

      function onIceCandidate(e) {
        if (e.candidate === null) {
          console.log('Found all candidates');
          doneWithIce = true;
          maybeRespond();
        } else {
          iceCandidates.push(e.candidate);
        }
      }

      function maybeRespond() {
        if (doneWithIce && description) {
          console.log('responding');
          var respJson = {
            description: description,
            iceCandidates: iceCandidates
          };
          var respStr = JSON.stringify(respJson);
          var respBin = binUtil.stringToArrayBuffer(respStr);
          that.write(respBin);
        }
      }

      pc.createAnswer()
      .then(desc => {
        description = desc;
        console.log('responding with description: ', desc);
        pc.setLocalDescription(desc);


        pc.ondatachannel = wrtcResponder.onDataChannelHandler;
        // pc.ondatachannel = webrtcUtil.channelCallback;

        maybeRespond();

        // var descJson = JSON.stringify(desc);
        // var descBin = binUtil.stringToArrayBuffer(descJson);
        // that.write(descBin);
      }, err => {
        console.log('err creating desc: ', err);
      });

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
