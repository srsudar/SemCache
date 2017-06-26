/* globals alert */
'use strict';

console.log('In SemCache options.js');

const evaluation = require('./content-script/cs-evaluation');
const appEval = require('../../../chromeapp/app/scripts/evaluation');

let uiUrlList = document.querySelector('#urls');
let uiNumIterations = document.querySelector('#numIterations');
let uiKey = document.querySelector('#key');

let uiRetrieveKey = document.querySelector('#retrieveKey');

let btnSave = document.querySelector('#save');
let btnStop = document.querySelector('#stop');
let btnGet = document.querySelector('#getResult');


function configureExperiment() {
  let rawUrls = uiUrlList.value.trim();
  let urls = rawUrls.split('\n');
  console.log('recovered the following URLs: ', urls);
  let numIterations = uiNumIterations.value;
  let key = uiKey.value;

  let intIter = parseInt(numIterations);

  if (!intIter || isNaN(intIter)) {
    alert('invalid number of iterations');
    return;
  }

  evaluation.startSavePageTrial(urls, intIter, key);
}

function retrieveKey() {
  let keyValue = uiRetrieveKey.value;
  appEval.downloadKeyAsCsv(keyValue);
}

function stopExperiment() {
  evaluation.deleteStorageHelperValues();
}

btnSave.addEventListener('click', configureExperiment);
btnStop.addEventListener('click', stopExperiment);
btnGet.addEventListener('click', retrieveKey);
