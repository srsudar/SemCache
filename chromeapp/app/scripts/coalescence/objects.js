'use strict';

/**
 * Objects relevant to coalescence between instances on the local network.
 */

/**
 * This object represents a cached page that is available on the local network.
 * It is related but not identical to the CachedPage object in the persistence
 * module, incorporating a notion of probabilistic availability.
 *
 * There are several considerations when interacting with a coalesced page. The
 * first is that the page can exist in several states. In SemCache this is
 * referred to as availability.
 *
 * If the page is available on the local machine, we are certain that the page
 * exists and that a request to open that page will succeed (assuming the page
 * isn't deleted after a query is made, that there are no errors, etc). 
 *
 * If another peer responds that they have the page, we are certain that the
 * page exists at the time of the query, but we are not sure that an eventual
 * fetch will succeed. Perhaps when an attempt to open the page is made the
 * client will have left the network, or an error will occur because the
 * network goes down.
 *
 * It is also possible that set inclusion (and thus local availability) is a
 * probabilistic operation, eg if Bloom filters are used to lower network
 * traffic.
 *
 * We refer to the first state as "available". Both the second states we will
 * lump together to refer to as "probable". The third state is simply
 * "unavailable".
 *
 * These states might not be important to the caller, but we want to provide
 * the information all the same.
 *
 * @param {String} availability A string enum representing various types of
 * availability on the local network. This is expected to be on of "available",
 * meaning access is highly available (eg on the local machine) and access will
 * succeed. "probable" means that the page was likely available at the time of
 * the query. This uncertainty might stem from the potential the machine will
 * leave the network by the time the page is requested or because inclusion was
 * determined to do a probabilistic operation like a Bloom filter. The last
 * option is "unavailable", indicating that a cached copy of the page is not
 * available.
 * @param {Object} queryInfo information about the query of the page. This
 * might include the URL, etc
 * @param {Object} accessInfo information about how to access the page. If this
 * is a locally available page, this might be a CachedPage object from the
 * persistence module, eg. Otherwise it will depend on the type of
 * availability.
 *
 * @constructor
 */
exports.NetworkCachedPage = function NetworkCachedPage(
  availability,
  queryInfo,
  accessInfo
) {
  if (!(this instanceof NetworkCachedPage)) {
    throw new Error('NetworkCachedPage must be called with new');
  }
  this.availability = availability;
  this.queryInfo = queryInfo;
  this.accessInfo = accessInfo;
};

/**
 * Create a Digest object from a list of pages saved on a peer. This
 * associates information about the peer as well as access information.
 *
 * @constructor
 */
exports.Digest = function Digest(peerInfo, pageInfos) {
  if (!(this instanceof Digest)) {
    throw new Error('Digest must be called with new');
  }
  this.peerInfo = peerInfo;

  // Now process the pageInfos.
  this.digestInfo = {};
  pageInfos.forEach(pageInfo => {
    this.digestInfo[pageInfo.url] = pageInfo.captureDate;
  });
};

/**
 * Query the digest to see if the page contains the given URL.
 *
 * @param {string} url
 *
 * @return {string|null} null if the digest does not contain the page,
 * otherwise the timestamp of the page
 */
exports.Digest.prototype.performQueryForPage = function(url) {
  var captureDate = this.digestInfo[url];
  if (captureDate) {
    return captureDate;
  } else {
    return null;
  }
};
