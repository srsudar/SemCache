'use strict';

var api = require('./extension-api');

var spinner = document.getElementById('spinner');
var msgSuccess = document.getElementById('msg-success');
var msgError = document.getElementById('msg-error');

function handleSuccess() {
  msgSuccess.classList.remove('hide');

  msgError.classList.add('hide');
  spinner.classList.add('hide');
}

function handleError() {
  msgError.classList.remove('hide');

  spinner.classList.add('hide');
  msgSuccess.classList.add('hide');
}

api.saveCurrentPage()
  .then(() => {
    handleSuccess();
  })
  .catch(err => {
    console.log(err);
    handleError();
  });
