'use strict';

/**
 * Generate objects mimicking Tab objects.
 */
exports.genTabs = function*(num) {
  for (let i = 0; i < num; i++) {
    let url = `http://foobar.com/page${i}`;
    let id = i;
    // Note that this odd uppercase 'I' is correct
    let favIconUrl = `faviconurl ${i}`;
    let title = `title ${i}`;

    yield {
      url: url,
      id: id,
      title: title,
      faviconUrl: favIconUrl
    };
  }
};
