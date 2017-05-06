'use strict';

console.log('in SemCache contentscriptBundle.js');

var api = require('./cs-api');
var runtime = require('../chrome-apis/runtime');
var evaluation = require('./cs-evaluation');
var util = require('../util/util');

window.evaluation = evaluation;

runtime.addOnMessageListener(api.onMessageHandler);

util.getOnCompletePromise()
  .then(() => {
    evaluation.onPageLoadComplete();
    api.annotateLocalLinks();
    api.annotateNetworkLocalLinks();
  });
