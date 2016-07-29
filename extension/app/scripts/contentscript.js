'use strict';

console.log('SemCache: Content script');

// console.log('trying current tab');

// chrome.tabs.getCurrent(function(tab) {
//   console.log(tab);
// });

console.log('trying query tab');
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
  console.log(tabs);
  console.log(tabs[0]);
});