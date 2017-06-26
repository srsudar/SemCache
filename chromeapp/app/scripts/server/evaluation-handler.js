/* globals WSC, _, TextEncoder */
'use strict';

const evaluation = require('../evaluation');

/**
 * A handler to generate responses to a mock list_pages endpoint.
 */

exports.EvaluationHandler = function(request) {
  WSC.BaseHandler.prototype.constructor.call(this);
};

_.extend(exports.EvaluationHandler.prototype, {
  get: function() {
    let numPages = this.get_argument('numPages');
    let nonce = this.get_argument('nonce');
    numPages = numPages || 1;
    nonce = nonce || 'useNonceArg';

    let result = evaluation.getDummyResponseForAllCachedPages(numPages, nonce);
    this.setHeader('content-type','text/json');
    let encoder = new TextEncoder('utf-8');
    let buf = encoder.encode(JSON.stringify(result)).buffer;
    this.write(buf);
    this.finish();
  }
}, WSC.BaseHandler.prototype);
