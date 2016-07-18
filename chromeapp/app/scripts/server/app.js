/* global WSC, DummyHandler */
'use strict';

// Try to initialize the web server.
function start(host, port) {
  if (!WSC) {
    console.log('Cannot start server, WSC not truthy: ', WSC);
    return;
  }

  var handlers = [
    ['/test.*', DummyHandler]
  ];

  window.httpServer = new WSC.WebApplication({
    host: host,
    port: port,
    handlers: handlers,
    renderIndex: false,
    optCORS: true
  });

  window.httpServer.start();
}
