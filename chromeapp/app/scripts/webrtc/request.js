'use strict';

/**
 * Request messages for communicating with peers.
 *
 * API:
 * {
 *   id: /uuid/,
 *   type: { list | file },
 *   auth: /some object that can later be used for roles permissions/,
 *   body: {
 *     / depends on the object itself. could be a file path, eg /
 *   }
 * }
 */
