'use strict';

var api = require('./popup-api');
var messaging = require('../app-bridge/messaging');

var btnSave = document.getElementById('btn-save');
var btnView = document.getElementById('btn-view');
var spinner = document.getElementById('spinner');
var message = document.getElementById('message');
var timing1 = document.getElementById('timing1');
var timing2 = document.getElementById('timing2');
var divSaveTime = document.getElementById('save-time');
var divLoadTime = document.getElementById('load-time');
var divButtons = document.getElementById('buttons-div');
var divSave = document.getElementById('save-content-div');

// Crazy value to make sure we notice if there are errors.
var saveStart = -10000;
var domCompleteTime = null;

// A local reference to the page.
var cachedPage = null;

function round(num) {
  // Round to two decimal places
  var factor = 100;
  var result = Math.round(num * factor) / factor;
  return result;
}

function finishTiming() {
  var saveEnd = window.performance.now();
  var totalSaveTime = saveEnd - saveStart;

  var totalLoadTime = domCompleteTime;

  console.log('un-rounded totalSaveTime: ', totalSaveTime);
  console.log('un-rounded totalLoadTime: ', totalLoadTime);

  timing1.classList.remove('hide');
  timing2.classList.remove('hide');

  divSaveTime.innerText = round(totalSaveTime);
  divLoadTime.innerText = round(totalLoadTime);

}

function hideSpinner() {
  spinner.classList.add('hide');
}

function handleSuccess() {
  finishTiming();
  message.innerText = 'Page saved!';

  hideSpinner();
}

/**
 * @param {boolean} timedOut if the error is because waiting for the app timed
 * out
 */
function handleError(timedOut) {
  finishTiming();

  if (timedOut) {
    message.innerText = 'Timed out waiting for App';
  } else {
    message.innerText = 'Something went wrong...';
  }
}

function beforeLoadComplete() {
  message.classList.remove('hide');
  message.innerText = 'Page Loading';
}


function afterLoadComplete(msgFromTab) {
  saveStart = window.performance.now();
  domCompleteTime = msgFromTab.loadTime;
  message.innerText = 'Saving';
  api.saveCurrentPage()
    .then(() => {
      handleSuccess();
    })
    .catch(err => {
      console.log(err);
      var timedOut = err === messaging.MSG_TIMEOUT;
      handleError(timedOut);
    });
}

function onSaveClickHandler() {
  // Update the visibility of the elements
  divButtons.classList.add('hide');
  divSave.classList.remove('hide');

  beforeLoadComplete();

  api.waitForCurrentPageToLoad()
  .then(msgFromTab => {
    afterLoadComplete(msgFromTab);
  });
}

function onViewClickHandler() {
  api.openCachedPage(cachedPage.serviceName, cachedPage.captureHref);
}

btnSave.onclick = onSaveClickHandler;
btnView.onclick = onViewClickHandler;

// Update the view button
api.getLocalPageInfo()
.then(page => {
  if (!page || page.length === 0) {
    return;
  }
  cachedPage = page[0];
  btnView.disabled = false;
  btnView.classList.add('btn-success');
})
.catch(err => {
  console.log('Error getting local page info: ', err);
});
