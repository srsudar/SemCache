/* globals alert */
'use strict';

console.log('In SemCache options.js');

var evaluation = require('./content-script/cs-evaluation');
var appEval = require('../../../chromeapp/app/scripts/evaluation');

var uiPageId = document.querySelector('#pageIdentifier');
var uiNumIterations = document.querySelector('#numIterations');
var uiKey = document.querySelector('#key');

var uiRetrieveKey = document.querySelector('#retrieveKey');

var btnSave = document.querySelector('#save');
var btnStop = document.querySelector('#stop');
var btnGet = document.querySelector('#getResult');


function configureExperiment() {
  var pageId = uiPageId.value;
  var numIterations = uiNumIterations.value;
  var key = uiKey.value;

  var intIter = parseInt(numIterations);

  if (!intIter || isNaN(intIter)) {
    alert('invalid number of iterations');
    return;
  }

  evaluation.startSavePageTrial(pageId, intIter, key);
}

function retrieveKey() {
  var keyValue = uiRetrieveKey.value;
  appEval.downloadKeyAsCsv(keyValue);
}

function stopExperiment() {
  evaluation.deleteStorageHelperValues();
}

btnSave.addEventListener('click', configureExperiment);
btnStop.addEventListener('click', stopExperiment);
btnGet.addEventListener('click', retrieveKey);
