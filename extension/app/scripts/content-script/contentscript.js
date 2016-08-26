'use strict';

console.log('in SemCache contentscriptBundle.js');

var api = require('./cs-api');
var runtime = require('../chrome-apis/runtime');

runtime.addOnMessageListener(api.onMessageHandler);
