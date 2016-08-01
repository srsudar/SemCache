/* globals $ */
'use strict';

var fileSystem = require('fileSystem');
var extensionBridge = require('extBridge');

extensionBridge.attachListeners();

document.addEventListener('DOMContentLoaded', function() {
  var h1 = document.getElementsByTagName('h1');
  if (h1.length > 0) {
    h1[0].innerText = h1[0].innerText + ' \'Allo';
  }
  var chooseDirButton = document.getElementById('choose_dir');
  chooseDirButton.addEventListener('click', function() {
    fileSystem.promptForDir().then(function(entry) {
      console.log('GOT NEW BASE DIR: ', entry);
      fileSystem.setBaseCacheDir(entry);
    });
  });
}, false);

function clearContainer() {
  var $container = $('#content-container');
  $container.children().hide();
}

function initUi() {

}

$(function() {
  console.log('SETTING UP READY BUSINESS');

  initUi();
});
