'use strict';
let test = require('tape');
require('sinon-as-promised');

let objects = require('../../../app/scripts/persistence/objects');

let CPInfo = objects.CPInfo;
let CPSummary = objects.CPSummary;
let CPDisk = objects.CPDisk;

function* genAllParams(num) {
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
}

function getSingleParams() {
  return genAllParams(1).next().value;
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
}

function assertCPInfoPropertiesCorrect(t, params, cpinfo) {
  t.deepEqual(cpinfo.captureHref, params.captureHref);
  t.deepEqual(cpinfo.captureDate, params.captureDate);
  t.deepEqual(cpinfo.title, params.title);
  t.deepEqual(cpinfo.filePath, params.filePath);
}

function assertCPSummaryPropertiesCorrect(t, params, cpsummary) {
  t.deepEqual(cpsummary.favicon, params.favicon);
  t.deepEqual(cpsummary.screenshot, params.screenshot);
}

test('CPInfo constructs', function(t) {
  let params = getSingleParams();
  console.log(params);

  let actual = new CPInfo(params);

  assertCPInfoPropertiesCorrect(t, params, actual);
  end(t);
});

test('canBePersisted correct', function(t) {
  let params = getSingleParams();
  let actual = new CPInfo(params);

  // When all valid, this should pass.
  t.true(actual.canBePersisted());

  params.filePath = null;

  actual = new CPInfo(params);
  t.false(actual.canBePersisted());

  params = getSingleParams();
  params.captureHref = null;
  actual = new CPInfo(params);
  t.false(actual.canBePersisted());

  params = getSingleParams();
  params.captureDate = null;
  actual = new CPInfo(params);
  t.false(actual.canBePersisted());

  end(t);
});

test('CPSummary constructs', function(t) {
  let params = getSingleParams();

  let actual = new CPSummary(params);

  assertCPInfoPropertiesCorrect(t, params, actual);
  assertCPSummaryPropertiesCorrect(t, params, actual);
  end(t);
});

test('CPDisk consturcts', function(t) {
  let params = getSingleParams();

  let actual = new CPDisk(params);

  assertCPInfoPropertiesCorrect(t, params, actual);
  assertCPSummaryPropertiesCorrect(t, params, actual);
  t.deepEqual(actual.mhtml, params.mhtml);
  end(t);
});

test('asCPInfo correct', function(t) {
  let params = getSingleParams();

  let cpsummary = new CPSummary(params);
  let actual = cpsummary.asCPInfo();
  let expected = new CPInfo(params);

  t.deepEqual(actual, expected);
  end(t);
});

test('asCPSummary correct', function(t) {
  let params = getSingleParams();

  let cpsummary = new CPDisk(params);
  let actual = cpsummary.asCPSummary();
  let expected = new CPSummary(params);

  t.deepEqual(actual, expected);
  end(t);
});
