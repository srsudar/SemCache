/* globals WSC, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate */
'use strict';

const _ = require('underscore');
const textEncoding = require('text-encoding');

const TextDecoder = require('text-encoding').TextDecoder;
const TextEncoder = require('text-encoding').TextEncoder;

const api = require('./server-api');
const fileSystem = require('../persistence/file-system');
const fsUtil = require('../persistence/file-system-util');
const rtcConnMgr = require('../webrtc/connection-manager');
const wrtcResponder = require('../webrtc/responder');


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
        let encoder = new TextEncoder('utf-8');
        let buffer = encoder.encode(JSON.stringify(response)).buffer;
        this.write(buffer);
        this.finish();
      });
    }
  },
  WSC.BaseHandler.prototype
);

/**
 * Handler for the JSON endpoint listing a digest overview of all pages in the
 * cache.
 */
exports.FullDigestHandler = function() {
  if (!WSC) {
    console.warn('CachedPagesHandler: WSC global object not present');
    return;
  }
  WSC.BaseHandler.prototype.constructor.call(this);
};

_.extend(exports.FullDigestHandler.prototype,
  {
    get: function() {
      api.getResponseForAllPagesDigest()
      .then(response => {
        this.setHeader('content-type', 'text/json');
        let encoder = new TextEncoder('utf-8');
        let buffer = encoder.encode(JSON.stringify(response)).buffer;
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
      let fileName = api.getCachedFileNameFromPath(this.request.path);

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
          let that = this;
          let fileReader = new FileReader();

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

      let that = this;

      let bodyStr = new TextDecoder().decode(this.request.body);
      console.log('bodyStr: ' + bodyStr);

      let bodyJson = JSON.parse(bodyStr);

      let pc = new RTCPeerConnection(null, null);
      pc.onicecandidate = onIceCandidate;
      let remoteDescription = new RTCSessionDescription(bodyJson.description);
      pc.setRemoteDescription(remoteDescription);
      rtcConnMgr.remote = pc;

      bodyJson.iceCandidates.forEach(candidateStr => {
        let candidate = new RTCIceCandidate(candidateStr);
        pc.addIceCandidate(candidate);
      });

      let iceCandidates = [];
      let description = null;
      let doneWithIce = false;

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
          let respJson = {
            description: description,
            iceCandidates: iceCandidates
          };
          let respStr = JSON.stringify(respJson);
          let respBin = new TextEncoder().encode(respStr);
          that.write(respBin);
        }
      }

      pc.createAnswer()
      .then(desc => {
        description = desc;
        console.log('responding with description: ', desc);
        pc.setLocalDescription(desc);


        pc.ondatachannel = wrtcResponder.onDataChannelHandler;

        maybeRespond();
      }, err => {
        console.log('err creating desc: ', err);
      });

    },

    get: function() {
      console.log('IN GET');
      let fileName = api.getCachedFileNameFromPath(this.request.path);

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
          let that = this;
          let fileReader = new FileReader();

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
