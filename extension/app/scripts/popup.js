'use strict';

var api = require('./extension-api');

var spinner = document.getElementById('spinner');
var msgSuccess = document.getElementById('msg-success');
var msgError = document.getElementById('msg-error');
var timing = document.getElementById('timing');

// Crazy value to make sure we notice if there are errors.
var saveStart = -10000;

function finishTiming() {
  var saveEnd = window.performance.now();
  var total = saveEnd - saveStart;
  console.log('un-rounded total: ', total);

  // Round to two decimal places
  var factor = 100;
  var rounded = Math.round(total * factor) / factor;

  timing.classList.remove('hide');

  timing.innerText = rounded + ' ms';
}

function handleSuccess() {
  msgSuccess.classList.remove('hide');

  msgError.classList.add('hide');
  spinner.classList.add('hide');
  finishTiming();
}

function handleError() {
  msgError.classList.remove('hide');

  spinner.classList.add('hide');
  msgSuccess.classList.add('hide');
  finishTiming();
}

var saveStart = window.performance.now();

api.saveCurrentPage()
  .then(() => {
    handleSuccess();
  })
  .catch(err => {
    console.log(err);
    handleError();
  });
