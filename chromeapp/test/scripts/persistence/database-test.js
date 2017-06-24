'use strict';
let test = require('tape');
let proxyquire = require('proxyquire');
require('sinon-as-promised');

let database = require('../../../app/scripts/persistence/database');
let objects = require('../../../app/scripts/persistence/objects');

const CPDisk = objects.CPDisk;
const CPInfo = objects.CPInfo;
const CPSummary = objects.CPSummary;

/**
 * Manipulating the object directly leads to polluting the require cache. Any
 * test that modifies the required object should call this method to get a
 * fresh version
 */
function reset() {
  delete require.cache[
    require.resolve('../../../app/scripts/persistence/database')
  ];
  database = require('../../../app/scripts/persistence/database');
}

function proxyquireDatabase(proxies) {
  database = proxyquire(
    '../../../app/scripts/persistence/database', proxies
  );
}

function end(t) {
  if (!t) { throw new Error('You forgot to pass tape'); }
  t.end();
  reset();
}

/**
 * Generator for dummy items from the pagesummary table.
 */
function* genPagesummaryItems(num) {
  for (let i = 0; i < num; i++) {
    let id = i;
    let captureHref = `http://page.com/${id}`;
    let captureDate = `2017-06-01_${id}`;
    let filePath = `path/to/file_${id}`;
    let title = `Title: ${id}`;
    yield { id, captureHref, captureDate, filePath, title };
  }
}

/**
 * Generator for dummy items from the pageblob table.
 */
function* genBlobItems(num) {
  let summaryItems = [...genPagesummaryItems(num)];
  for (let i = 0; i < num; i++) {
    let pagesummaryId = i;
    let favicon = `favicon ${i}`;
    let screenshot = `screenshot ${i}`;
    let captureHref = summaryItems[i].captureHref;
    let captureDate = summaryItems[i].captureDate;
    yield { pagesummaryId, captureDate, captureHref, favicon, screenshot };
  }
}

test('getAsCPInfos correct for single item', function(t) {
  let item = genPagesummaryItems(1).next().value;

  let expected = new CPInfo(item);
  expected = [expected];
  let actual = database.getAsCPInfos(item);

  t.deepEqual(actual, expected);
  end(t);
});

test('getAsCPInfos correct for array', function(t) {
  // Combined with the string interpolation and property value shorthand in the
  // generator (plus the existence of said generator), this might be my
  // favorite function that I have ever written. So terse, so readable.
  let items = [...genPagesummaryItems(5)];

  let expected = items.map(item => new CPInfo(item));
  let actual = database.getAsCPInfos(items);

  t.deepEqual(actual, expected);
  end(t);
});

test('getAsCPSummaryArr correct', function(t) {
  let num = 4;
  let summaryItems = [...genPagesummaryItems(num)];
  // Get one less so that we know we fail gracefully in the case of a missing
  // value.
  let blobItems = [...genBlobItems(num - 1)];

  // We know these are in the same order so we can skip the indexing step
  // required of the real function.
  let expected = summaryItems.map(function(item, i) {
    let blob = blobItems[i] || {};
    return new CPSummary({
      captureHref: item.captureHref,
      captureDate: item.captureDate,
      title: item.title,
      filePath: item.filePath,
      favicon: blob.favicon,
      screenshot: blob.screenshot
    });
  });

  let actual = database.getAsCPSummaryArr(summaryItems, blobItems.reverse());
  t.deepEqual(actual, expected);

  end(t);
});
