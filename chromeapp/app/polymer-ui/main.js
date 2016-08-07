/* globals chrome, $ */
'use strict';

// Listens for the app launching then creates the window
chrome.app.runtime.onLaunched.addListener(function() {
  var width = 500;
  var height = 300;

  chrome.app.window.create('index.html', {
    id: 'main',
    bounds: {
      width: width,
      height: height,
      left: Math.round((screen.availWidth - width) / 2),
      top: Math.round((screen.availHeight - height)/2)
    }
  });
});

window.dnssd = require('dnssd');
window.dnsc = require('dnsc');
window.dnsSem = require('dnsSem');

function onReady() {
  var $loading = $('#loading-element');
  var appc = require('appController');
  appc.start().
    then(() => {
      var $body = $('body');
      var $app = $('<my-app id="app-element">');
      $loading.remove();
      $body.append($app);
    });
}

$(onReady);
