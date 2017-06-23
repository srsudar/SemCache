'use strict';

/**
 * Generate objects mimicking Tab objects.
 */
exports.genTabs = function*(num) {
  for (let i = 0; i < num; i++) {
    let url = `http://foobar.com/page${i}`;
    let id = i;
    let faviconUrl = `faviconurl ${i}`;
    let title = `title ${i}`;

    yield {
      url: url,
      id: id,
      title: title,
      faviconUrl: faviconUrl
    };
  }
};
