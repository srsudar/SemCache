'use strict';

exports.genAllParams = function*(num) {
  for (let i = 0; i < num; i++) {
    let href = `http://page.com/${i}`;
    let date = `2017-06-01_${i}`;
    let title = `Title: ${i}`;
    let filePath = `path/to/file_${i}`;
    let favicon = `favicon ${i}`;
    let screenshot = `screenshot ${i}`;
    let mhtml = `blob ${i}`;
    yield {
      captureHref: href,
      captureDate: date,
      title: title,
      filePath: filePath,
      favicon: favicon,
      screenshot: screenshot,
      mhtml: mhtml
    };
  }
};
