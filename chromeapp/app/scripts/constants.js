'use strict';

const SELF_SERVICE_SHORTCUT = '_SELF_INSTANCE_NAME_';

/**
 * This is used to represent our own cache's service name. When fully
 * registered via mDNS, an instance name is something like
 * 'sam cache._semcache._tcp.local'. This string is an alias that allows us to
 * refer to our own cache without needing to interact with the network
 * machinery in any way.
 */
exports.SELF_SERVICE_SHORTCUT = SELF_SERVICE_SHORTCUT;
