'use strict';

const objects = require('../../../app/scripts/persistence/objects');

const CPDisk = objects.CPDisk;


exports.genAllParams = function*(num) {
  for (let i = 0; i < num; i++) {
    let href = `http://page.com/${i}`;
    let date = `2017-06-01_${i}`;
    let title = `Title: ${i}`;
    let filePath = `path/to/file_${i}`;
    let favicon = `favicon ${i}`;
    let screenshot = `screenshot ${i}`;
    let mhtml = Buffer.from(`<body>${i}</body>`);
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

exports.genCPDisks = function*(num) {
  let params = exports.genAllParams(num);
  for (let param of params) {
    yield new CPDisk(param);
  }
};

exports.genCPSummaries = function*(num) {
  let disks = exports.genCPDisks(num);
  for (let disk of disks) {
    yield disk.asCPSummary();
  }
};

exports.genCPInfos = function*(num) {
  let disks = exports.genCPDisks(num);
  for (let disk of disks) {
    yield disk.asCPInfo();
  }
};
