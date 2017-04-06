/* globals chrome */
'use strict';

exports.onBeforeNavigate = chrome.webNavigation.onBeforeNavigate;

exports.onCompleted = chrome.webNavigation.onCompleted;

exports.onCommitted = chrome.webNavigation.onCommitted;
