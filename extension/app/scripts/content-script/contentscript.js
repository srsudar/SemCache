'use strict';

console.log('in SemCache contentscriptBundle.js');

// Kind of ugly importing this, but I don't want to duplicate the file yet.
var appEval = require('../../../../chromeapp/app/scripts/evaluation.js');
var api = require('./cs-api');
var runtime = require('../chrome-apis/runtime');
var evaluation = require('./cs-evaluation');
var util = require('../util/util');

window.evaluation = evaluation;

runtime.addOnMessageListener(api.onMessageHandler);

util.getOnCompletePromise()
.then(() => {
  // evaluation.onPageLoadComplete();
  // api.annotateLocalLinks();

  evaluation.getLinkAnnotationKeys()
  .then(obj => {
    if (!obj.isPerformingTrial) {
      console.log('Not performing an annotation trial');
      return;
    }
    console.log(
      'Performing annotation trial',
      obj.currentIteration,
      'of',
      obj.totalIterations
    );

    var start = appEval.getNow();
    var thisMoment = new Date();
    var key = obj.key;
    var toLog = {
      key: key,
      iter: obj.currentIteration,
      numIterations: obj.totalIterations,
      _isoTimeStart: thisMoment.toISOString(),
      _localTimeStart: thisMoment.toLocaleString()
    };
    api.annotateNetworkLocalLinks()
    .then(() => {
      var end = appEval.getNow();
      var totalTime = end - start;
      toLog.totalTime = totalTime;
      return appEval.logTime(key, toLog);
    })
    .then(() => {
      evaluation.annotationIterationCompleted();
    })
    .catch(err => {
      var msg = err.message || 'no error message';
      toLog.error = msg;
      appEval.logTime(key, toLog);
      return Promise.resolve();
    })
    .then(() => {
      evaluation.annotationIterationCompleted();
    });
  });
});
