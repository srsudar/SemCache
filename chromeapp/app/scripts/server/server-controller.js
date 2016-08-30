/* global WSC, DummyHandler */
'use strict';

var api = require('./server-api');
var handlers = require('./handlers');
var evalHandlers = require('./evaluation-handler');

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

  var endpoints = api.getApiEndpoints();

  var endpointHandlers = [
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
      '/eval/list_pages*',
      evalHandlers.EvaluationHandler
    ]
  ];

  startServer(host, port, endpointHandlers);
};
