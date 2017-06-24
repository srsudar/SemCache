'use strict';
let proxyquire = require('proxyquire');
let sinon = require('sinon');
let test = require('tape');
require('sinon-as-promised');

let objects = require('../../../app/scripts/persistence/objects');
let putil = require('./persistence-util');

let CPInfo = objects.CPInfo;
let CPSummary = objects.CPSummary;
let CPDisk = objects.CPDisk;

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/objects')
  ];
  objects = require('../../../app/scripts/persistence/objects');
  CPInfo = objects.CPInfo;
  CPSummary = objects.CPSummary;
  CPDisk = objects.CPDisk;
}

function proxyquireObjects(proxies) {
  objects = proxyquire(
    '../../../app/scripts/persistence/objects', proxies
  );
  CPInfo = objects.CPInfo;
  CPSummary = objects.CPSummary;
  CPDisk = objects.CPDisk;
}

function getSingleParams() {
  return putil.genAllParams(1).next().value;
}


function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
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

test('CPInfo.asJSON and fromJSON correct', function(t) {
  let expected = putil.genCPInfos(1).next().value;

  let json = expected.asJSON();
  let actual = CPInfo.fromJSON(json);

  t.deepEqual(actual, expected);
  end(t);
});

test('CPSummary.asJSON and fromJSON correct', function(t) {
  let expected = putil.genCPSummaries(1).next().value;
  
  let json = expected.asJSON();
  let actual = CPSummary.fromJSON(json);

  t.deepEqual(actual, expected);
  end(t);
});

test('CPDisk.asJSON correct', function(t) {
  let params = getSingleParams();
  let dataUrl = 'data: blob';

  let buffToDataStub = sinon.stub();
  buffToDataStub.withArgs(params.mhtml).returns(dataUrl);

  proxyquireObjects({
    '../util': {
      buffToData: buffToDataStub
    }
  });

  let cp = new CPDisk(params);
  let expected = {
    captureHref: params.captureHref,
    captureDate: params.captureDate,
    title: params.title,
    filePath: params.filePath,
    screenshot: params.screenshot,
    favicon: params.favicon,
    mhtml: dataUrl
  };

  let actual = cp.asJSON();
  t.deepEqual(actual, expected);
  end(t);
});

test('CPDisk.asBuffer and fromBuffer correct', function(t) {
  // Taking an integration test approach here to avoid trying to assert things
  // about the Buffer itself.
  let expected = [...putil.genCPDisks(1)][0];
  
  let buff = putil.genCPDisks(1).next().value.asBuffer();
  let actual = CPDisk.fromBuffer(buff);

  t.deepEqual(actual, expected);
  end(t);
});

test('CPDisk.fromJSON correct', function(t) {
  let params = getSingleParams();
  let expected = new CPDisk(params);

  // Swap the mhtml buff for a blob.
  let dataUrl = 'data: blob';
  let mhtml = params.mhtml;
  params.mhtml = dataUrl;

  let dataToBuffStub = sinon.stub();
  dataToBuffStub.withArgs(dataUrl).returns(mhtml);

  proxyquireObjects({
    '../util': {
      dataToBuff: dataToBuffStub
    }
  });

  let actual = CPDisk.fromJSON(params);
  t.deepEqual(actual, expected);
  end(t);
});

test('CPSummary constructs', function(t) {
  let params = getSingleParams();

  let actual = new CPSummary(params);

  assertCPInfoPropertiesCorrect(t, params, actual);
  assertCPSummaryPropertiesCorrect(t, params, actual);
  end(t);
});

test('CPDisk constructs', function(t) {
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

test('asDPDisk correct', function(t) {
  let params = getSingleParams();

  let expected = new CPDisk(params);
  let cpsummary = new CPSummary(params);

  let actual = cpsummary.asCPDisk(params.mhtml);
  t.deepEqual(actual, expected);

  end(t);
});
