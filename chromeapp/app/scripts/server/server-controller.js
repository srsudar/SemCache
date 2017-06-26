/* global WSC, DummyHandler */
'use strict';

const api = require('./server-api');
const handlers = require('./handlers');
const evalHandlers = require('./evaluation-handler');

function startServer(host, port, endpointHandlers) {
  window.httpServer = new WSC.WebApplication({
    host: host,
    port: port,
    handlers: endpointHandlers,
    renderIndex: false,
    optCORS: true,
    optAllInterfaces: true
  });

  window.httpServer.start();
}

/**
 * Stop the web server.
 */
exports.stop = function() {
  if (!WSC) {
    console.log('cannot stop server, WSC not truthy: ', WSC);
  }
  window.httpServer.stop();
};

/**
 * Start the web server.
 */
exports.start = function(host, port) {
  if (!WSC) {
    console.log('Cannot start server, WSC not truthy: ', WSC);
    return;
  }

  let endpoints = api.getApiEndpoints();

  let endpointHandlers = [
    [
      endpoints.listPageCache,
      handlers.ListCachedPagesHandler
    ],
    [
      '/test.*',
      DummyHandler
    ],
    [
      endpoints.pageCache,
      handlers.CachedPageHandler
    ],
    [
      endpoints.pageDigest,
      handlers.FullDigestHandler
    ],
    [
      endpoints.evalListPages,
      evalHandlers.EvaluationHandler
    ],
    [
      endpoints.receiveWrtcOffer,
      handlers.WebRtcOfferHandler
    ]
  ];

  startServer(host, port, endpointHandlers);
};
