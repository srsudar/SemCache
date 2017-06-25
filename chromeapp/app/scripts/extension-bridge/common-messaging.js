'use strict';

/**
 * Common messaging objects for communication between the app and extension.
 *
 * The messages are organized as two types: initiator and responder. An
 * initiator is as follows:
 *
 * {
 *   // The component that initiated the message
 *   from: popup|content|background|app,
 *   // Params for the request itself. Eg if this is an add page to cache
 *   // message, this might be information about the page.
 *   params: {},
 *   // The type of the message.
 *   type: <string>
 * }
 *
 * A responder is as follows:
 * {
 *   // The type of the response. This will generally be something like
 *   // networkQuery-response. The `-response` suffix indicates the type of the
 *   // response.
 *   type: <string>,
 *   // the params of the original request. This allows callers to figure out
 *   // if the response is for them.
 *   params: {},
 *   status: success|error,
 *   // The body of the message. If this is for a local network query, this
 *   // might be information about the message, eg.
 *   body: {}
 * }
 */

exports.initiatorTypes = {
  localQuery: 'localQuery',
  networkQuery: 'networkQuery',
  addPageToCache: 'addPageToCache',
  openPage: 'openPage',
};

exports.responderTypes = {
  localQuery: 'localQuery-result',
  networkQuery: 'networkQuery-result',
  addPageToCache: 'addPageToCache-result',
  openPage: 'openPage-result',
};

exports.statusTypes = {
  success: 'success',
  error: 'error'
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isSuccess = function(msg) {
  return msg && msg.status && msg.status === exports.statusTypes.success;
};

/**
 * @param {Object} msg
 *
 * @return {boolean}
 */
exports.isError = function(msg) {
  return msg && msg.status && msg.status === exports.statusTypes.error;
};

exports.createInitiatorMessage = function(from, type, params) {
  if (![...Object.values(exports.initiatorTypes)].includes(type)) {
    throw new Error('Unrecognized initiator type: ' + type);
  }
  return { from, type, params };
};

exports.createResponderMessage = function(type, status, params, body) {
  if (![...Object.values(exports.responderTypes)].includes(type)) {
    throw new Error('Unrecognized responder type: ' + type);
  }
  return { type, status, params, body };
};

/**
 * @param {string} type
 * @param {Object} params
 * @param {Error|string} error
 */
exports.createResponseError = function(type, params, error) {
  if (error && typeof error !== 'string') {
    // It is an Error
    error = error.message;
  }
  return exports.createResponderMessage(
    type, exports.statusTypes.error, params, error
  );
};

exports.createResponseSuccess = function(type, params, body) {
  return exports.createResponderMessage(
    type, exports.statusTypes.success, params, body
  );
};

/**
 * @param {string} from
 * @param {Object} cpdiskJson
 *
 * @return {Object}
 */
exports.createAddPageMessage = function(from, cpdiskJson) {
  return exports.createInitiatorMessage(
    from, exports.initiatorTypes.addPageToCache, { cachedPage: cpdiskJson }
  );
};

exports.createAddPageResponse = function() {
  return exports.createResponseSuccess(
    exports.responderTypes.addPageToCache, {}, {}
  );
};

exports.createOpenMessage = function(from, serviceName, href) {
  return exports.createInitiatorMessage(
    from, exports.initiatorTypes.openPage, { serviceName, href }
  );
};

exports.createOpenResponse = function(params, body) {
  return exports.createResponseSuccess(
    exports.responderTypes.openPage, params, body
  );
};

exports.createLocalQueryMessage = function(from, urls) {
  return exports.createInitiatorMessage(
    from, exports.initiatorTypes.localQuery, { urls: urls }
  );
};

exports.createLocalQueryResponse = function(params, body) {
  return exports.createResponseSuccess(
    exports.responderTypes.localQuery, params, body
  );
};

exports.createNetworkQueryMessage = function(from, urls) {
  return exports.createInitiatorMessage(
    from, exports.initiatorTypes.networkQuery, { urls: urls }
  );
};

exports.createNetworkQueryResponse = function(params, body) {
  return exports.createResponseSuccess(
    exports.responderTypes.networkQuery, params, body
  );
};
