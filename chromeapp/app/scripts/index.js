'use strict';

var fs = require('./persistence/file-system');

var extensionBridge = require('extBridge');
extensionBridge.attachListeners();

document.addEventListener('DOMContentLoaded', function() {
  var h1 = document.getElementsByTagName('h1');
  if (h1.length > 0) {
    h1[0].innerText = h1[0].innerText + ' \'Allo';
  }
  var chooseDirButton = document.getElementById('choose_dir');
  chooseDirButton.addEventListener('click', function() {
    fs.promptForDir().then(function(entry) {
      console.log('GOT NEW BASE DIR: ', entry);
      fs.setBaseCacheDir(entry);
    });
  });
}, false);

