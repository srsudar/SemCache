'use strict';

const common = require('../../../app/scripts/extension-bridge/common-messaging');
const putil = require('../persistence/persistence-util');


exports.getAddPageMessage = function(from) {
  from = from || 'popup';
  let cpdiskJson = putil.genCPDisks(1).next().value.toJSON();
  return common.createAddPageMessage(from, cpdiskJson);
};


/**
 * @return {Object} { i: initiator message, r: responder message }
 */
exports.getAddPageMsgs = function() {
  let cpdiskJson = putil.genCPDisks(1).next().value.toJSON();
  let initiator = common.createAddPageMessage('popup', cpdiskJson);
  let responder = common.createAddPageResponse();
  return {
    i: initiator,
    r: responder
  };
};

/**
 * Return a message and matching response for a local query.
 *
 * @return {Object} { i: initiator message, r: responder message }
 */
exports.getLocalQueryMsgs = function() {
  let cpinfos = [...putil.genCPInfos(3)];
  let urls = cpinfos.map(info => info.captureHref);

  let body = {
    [cpinfos[0].captureHref]: [cpinfos[0]],
    [cpinfos[1].captureHref]: [cpinfos[1]],
    [cpinfos[2].captureHref]: [cpinfos[2]],
  };

  let initiator = common.createLocalQueryMessage('popup', urls);
  let responder = common.createLocalQueryResponse({}, body);

  return {
    i: initiator,
    r: responder
  };
};

/**
 * Return a message and matching response for a network query.
 *
 * @return {Object} { i: initiator message, r: responder message }
 */
exports.getNetworkQueryMsgs = function() {
  let cpinfos = [...putil.genCPInfos(3)];
  let urls = cpinfos.map(info => info.captureHref);

  let initiator = common.createNetworkQueryMessage('popup', urls);
  // TODO: need to decide on a body format for these.
  let responder = common.createNetworkQueryResponse({}, cpinfos);

  return {
    i: initiator,
    r: responder
  };
};

/**
 * @return {Object} { i: initiator message, r: responder message }
 */
exports.getOpenMsgs = function() {
  let href = 'http://foo.com';
  let serviceName = 'sam cache._semcache._tcp';
  let initiator = common.createOpenMessage('popup', serviceName, href);
  let responder = common.createOpenResponse({}, {});

  return {
    i: initiator,
    r: responder
  };
};

exports.getPageOpenError = function() {
  return common.createResponseError(
    common.responderTypes.openPage, {}, 'could not open'
  );
};
