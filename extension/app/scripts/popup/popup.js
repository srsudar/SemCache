'use strict';

const api = require('./popup-api');
const messaging = require('../app-bridge/messaging');

const btnSave = document.getElementById('btn-save');
const btnView = document.getElementById('btn-view');
const spinner = document.getElementById('spinner');
const message = document.getElementById('message');
const timing1 = document.getElementById('timing1');
const timing2 = document.getElementById('timing2');
const divSaveTime = document.getElementById('save-time');
const divLoadTime = document.getElementById('load-time');
const divButtons = document.getElementById('buttons-div');
const divSave = document.getElementById('save-content-div');

// Crazy value to make sure we notice if there are errors.
let saveStart = -10000;
let domCompleteTime = null;

// A local reference to the page.
let cachedPage = null;

function round(num) {
  // Round to two decimal places
  let factor = 100;
  let result = Math.round(num * factor) / factor;
  return result;
}

function finishTiming() {
  let saveEnd = window.performance.now();
  let totalSaveTime = saveEnd - saveStart;

  let totalLoadTime = domCompleteTime;

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
      let timedOut = err === messaging.MSG_TIMEOUT;
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
