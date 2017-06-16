'use strict';

/**
 * This is an integration test for testing the database. Unit tests would
 * require mocking the complex Dexie API and wouldn't confer a lot of
 * confidence. Instead we are going to piggyback on the Polymer tests and run
 * these database integration tests as a Polymer suite.
 */

// We are going to be pretty basic about this. We are going to insert some
// things and then read some things. We will expose an expected and an actual
// so that we can try and have helpful messages in the Polymer assertions.
// expected and actual 

// These are exposed as a global as part of the browserify bundle.
let database = require('db');
let objects = require('persistenceObjs');

const CPDisk = objects.CPDisk;

function* genCPDisks(num) {
  for (let i = 0; i < num; i++) {
    let href = `http://page.com/${i}`;
    let date = `2017-06-01_${i}`;
    let title = `Title: ${i}`;
    let filePath = `path/to/file_${i}`;
    let favicon = `favicon ${i}`;
    let screenshot = `screenshot ${i}`;
    let mhtml = `blob ${i}`;
    yield new CPDisk({
      captureHref: href,
      captureDate: date,
      title: title,
      filePath: filePath,
      favicon: favicon,
      screenshot: screenshot,
      mhtml: mhtml
    });
  }
}

/**
 * @return {Promise}
 */
function clearDatabase() {
  let db = database.getDb();
  return Promise.all([db.pagesummary.clear(), db.pageblobs.clear()]);
}


/**
 * @return {Promise}
 */
function addCachedPagesToDb(num) {
  let cpdisks = [...genCPDisks(num)];

  return Promise.all(cpdisks.map(cpdisk => database.addPageToDb(cpdisk)));
}

function getCPSummaryByHrefHelper(numToInsert, hrefParam, expected) {
  return new Promise(function(resolve) {
    clearDatabase()
    .then(() => {
      return addCachedPagesToDb(numToInsert);
    })
    .then(() => {
      return database.getCPSummariesForHrefs(hrefParam);
    })
    .then(actual => {
      resolve({ actual, expected });
    });
  });
}

/**
 * @return {Promise.<Object(actual, expected), Error>}
 */
function addAndGetAllCPInfos() {
  return new Promise(function(resolve) {
    let num = 5;
    let expected = [...genCPDisks(num)].map(disk => disk.asCPInfo());


    clearDatabase()
    .then(() => {
      return addCachedPagesToDb(num);
    })
    .then(() => {
      // They've been inserted. Query for them.
      return database.getAllCPInfos();
    })
    .then(actual => {
      resolve({ actual, expected });
    });
  });
}

function addAndGetCPSummaries() {
  return new Promise(function(resolve) {
    // We want to have to page twice to make sure the offest works like we
    // expect.
    let num = 6;

    let offset1 = 0;
    let offset2 = 3;
    let numRequested = 3;

    let expectedSummaries = [...genCPDisks(num)]
      .map(disk => disk.asCPSummary());

    let expected = [
      expectedSummaries.slice(offset1, offset1 + numRequested),
      expectedSummaries.slice(offset2, offset2 + numRequested)
    ];

    let actual = [];

    clearDatabase()
    .then(() => {
      return addCachedPagesToDb(num);
    })
    .then(() => {
      return database.getCachedPageSummaries(offset1, numRequested);
    })
    .then(resultSet1 => {
      actual.push(resultSet1);
      return database.getCachedPageSummaries(offset2, numRequested);
    })
    .then(resultSet2 => {
      actual.push(resultSet2);
      resolve({ actual, expected });
    });
  });
}

function addAndGetSingleCPSummary() {
  let num = 25;

  let cpDisks = [...genCPDisks(num)];

  // We want only one.
  let desiredIdx = 12;
  let expected = [cpDisks[desiredIdx].asCPSummary()];

  return getCPSummaryByHrefHelper(num, expected[0].captureHref, expected);
}

function addAndGetMultipleCPSummaries() {
  let num = 100;

  let cpDisks = [...genCPDisks(num)];

  // Take 3 of them.
  let first = cpDisks[0].asCPSummary();
  let second = cpDisks[50].asCPSummary();
  let third = cpDisks[90].asCPSummary();

  let expected = [first, second, third];
  let hrefs = [first.captureHref, third.captureHref, second.captureHref];

  return getCPSummaryByHrefHelper(num, hrefs, expected);
}


// Expose them to our Polymer infrastructure.
window.databaseTests = {
  addAndGetAllCPInfos: addAndGetAllCPInfos,
  clearDatabase: clearDatabase,
  addAndGetCPSummaries: addAndGetCPSummaries,
  addAndGetSingleCPSummary: addAndGetSingleCPSummary,
  addAndGetMultipleCPSummaries: addAndGetMultipleCPSummaries
};
