'use strict';

chrome.runtime.onInstalled.addListener(details => {
  console.log('previousVersion', details.previousVersion);
});

chrome.browserAction.setBadgeText({text: 'SemCache Badge'});

console.log('SemCache: Event Page for Browser Action');
