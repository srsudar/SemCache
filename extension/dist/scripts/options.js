/* globals alert */
'use strict';

console.log('In SemCache options.js');

var evaluation = require('./content-script/cs-evaluation');
var appEval = require('../../../chromeapp/app/scripts/evaluation');
var json2csv = require('json2csv');

var uiPageId = document.querySelector('#pageIdentifier');
var uiNumIterations = document.querySelector('#numIterations');
var uiKey = document.querySelector('#key');

var uiRetrieveKey = document.querySelector('#retrieveKey');

var btnSave = document.querySelector('#save');
var btnStop = document.querySelector('#stop');
var btnGet = document.querySelector('#getResult');

function downloadText(text, fileName) {
  // Based on:
  // https://stackoverflow.com/questions/3665115/
  // create-a-file-in-memory-for-user-to-download-not-through-server
  var element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' +
      encodeURIComponent(text)
  );
  element.setAttribute('download', fileName);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

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
  // appEval.getTimeValues(keyValue)
  //   .then(values => {
  //     if (values === null) {
  //       console.log('no results saved for key: ', keyValue);
  //     } else {
  //       console.log(values);
  //       // And now download a CSV.
  //       var csv = json2csv({data: values, flatten: true});
  //       downloadText(csv, keyValue + '.csv');
  //     }
  //   });
}

function stopExperiment() {
  evaluation.deleteStorageHelperValues();
}

btnSave.addEventListener('click', configureExperiment);
btnStop.addEventListener('click', stopExperiment);
btnGet.addEventListener('click', retrieveKey);
