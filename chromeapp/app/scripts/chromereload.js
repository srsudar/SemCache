'use strict';

// Reload client for Chrome Apps & Extensions.
// The reload client has a compatibility with livereload.
// WARNING: only supports reload command.

let LIVERELOAD_HOST = 'localhost:';
let LIVERELOAD_PORT = 35729;
let connection = new WebSocket('ws://' + LIVERELOAD_HOST + LIVERELOAD_PORT + '/livereload');

connection.onerror = function (error) {
  console.log('reload connection got error' + JSON.stringify(error));
};

connection.onmessage = function (e) {
  if (e.data) {
    let data = JSON.parse(e.data);
    if (data && data.command === 'reload') {
      chrome.runtime.reload();
    }
  }
};
