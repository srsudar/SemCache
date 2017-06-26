'use strict';

const settings = require('../settings');


/**
 * Remove the peerInfo object that represents our own machine.
 *
 * @param {Array.<Object>} peerInfos the peerInfo objects as returned from 
 * browseForSemCacheInstances
 *
 * @return {Promise.<Array.<Object>, Error>}
 */
exports.removeOwnInfo = function(peerInfos) {
  return new Promise(function(resolve, reject) {
    settings.init()
    .then(() => {
      let result = [];
      let ourDomain = settings.getHostName();
      peerInfos.forEach(peerInfo => {
        if (peerInfo.domainName !== ourDomain) {
          result.push(peerInfo);
        }
      });
      resolve(result);
    })
    .catch(err => {
      reject(err);
    });
  });
};

