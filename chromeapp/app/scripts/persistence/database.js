'use strict';

const Dexie = require('dexie');

const objects = require('./objects');

const CPInfo = objects.CPInfo;
const CPSummary = objects.CPSummary;


exports.DB_NAME = 'semcache-database';

let db = null;

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 20;

/**
 * @return {Dexie} the Dexie database
 */
exports.getDb = function() {
  if (!db) {
    db = new Dexie(exports.DB_NAME);
    db.version(1).stores({
      // Holds the top lite version of the page.
      // captureHref is the primary key.
      // &filePath because it must be unique.
      pagesummary: `captureHref, captureDate, &filePath, title`,
      // Holds the heavier information, bigger objects
      pageblobs: `captureHref, captureDate`
    });
  }
  return db;
};

/**
 * @param {CPInfo}
 *
 * @return {Promise}
 */
exports.addPageToDb = function(cp) {
  return new Promise(function(resolve, reject) {
    if (!cp.canBePersisted()) {
      reject(new Error('Page cannot be persisted'));
    }
    const db = exports.getDb();
    db.transaction('rw', db.pagesummary, db.pageblobs, function() {
      return db.pagesummary.put({
          captureHref: cp.captureHref,
          captureDate: cp.captureDate,
          title: cp.title,
          filePath: cp.filePath
      })
      .then(captureHref => {
        return db.pageblobs.put({
          captureHref: captureHref,
          favicon: cp.favicon,
          screenshot: cp.screenshot
        });
      });
    })
    .then(() => {
      resolve();
    });
  });
};

/**
 * @param {Array<Object>|Object} items item as returned by Dexie.Table.each()
 *
 * @return {Array.<CPInfo>}
 */
exports.getAsCPInfos = function(items) {
  if (!Array.isArray(items)) {
    items = [items];
  }
  return items.map(item => {
    return new CPInfo({
      captureHref: item.captureHref,
      captureDate: item.captureDate,
      title: item.title,
      filePath: item.filePath
    });
  });
};

/**
 * @param {Array<items>} summaryItems Array of items as from the pagesummary
 * table
 * @param {Array<items>} blobItems Array of items as from the pageblobs table
 *
 * @return {Array<CPSummary>} Array of CPSummary objects. This will be ordered
 * according to the summaryItems array. Corresponding missing blobItems are
 * permitted.
 */
exports.getAsCPSummaryArr = function(summaryItems, blobItems) {
  let idToBlob = blobItems.reduce(function(partial, blobItem) {
    partial[blobItem.captureHref] = blobItem;
    return partial;
  }, {});
  
  let result = summaryItems.map(item => {
    let blob = idToBlob[item.captureHref] || {};
    let params = {
      captureHref: item.captureHref,
      captureDate: item.captureDate,
      title: item.title,
      filePath: item.filePath,
      favicon: blob.favicon,
      screenshot: blob.screenshot
    };
    return new CPSummary(params);
  });

  return result;
};

/**
 * @return {Promise.<Array.<CPInfo>, Error>}
 */
exports.getAllCPInfos = function() {
  return new Promise(function(resolve) {
    let db = exports.getDb();
    let result = null;
    db.transaction('r', db.pagesummary, function() {
      db.pagesummary.toArray(itemArr => {
        result = exports.getAsCPInfos(itemArr);
      });
    })
    .then(() => {
      resolve(result);
    });
  });
};

/**
 * Return the CPSummary objects that match the given hrefs.
 *
 * @param {string|Array<string>} hrefs hrefs of the pages in question
 * 
 * @return {Promise.<Array<CPSummary>, Error>}
 */
exports.getCPSummariesForHrefs = function(hrefs) {
  return new Promise(function(resolve) {
    if (!Array.isArray(hrefs)) {
      hrefs = [hrefs];
    }
    let result = null;
    db.transaction('r', db.pagesummary, db.pageblobs, function() {
      let summaryItems = null;
      db.pagesummary
        .where('captureHref')
        .anyOf(hrefs)
        .toArray()
      .then(summariesArr => {
        summaryItems = summariesArr;
        CPInfo.sort(summaryItems);
        let captureHrefs = summaryItems.map(item => item.captureHref);
        return db.pageblobs
          .where('captureHref')
          .anyOf(captureHrefs)
          .toArray();
      })
      .then(pageblobArr => {
        result = exports.getAsCPSummaryArr(summaryItems, pageblobArr);
      });
    })
    .then(() => {
      resolve(result);
    });
  });
};

/**
 * The number of results is limited by default because it is an expensive
 * operation.
 *
 * @param {Object} params
 * @param {integer} params.offset
 * @param {integer} params.numDesired
 *
 * @return {Promise.<Array.<CPSummary>, Error>}
 */
exports.getCachedPageSummaries = function(offset, numDesired) {
  if (offset === undefined || offset === null) {
    offset = DEFAULT_OFFSET;
  }
  if (numDesired === undefined || numDesired === null) {
    numDesired = DEFAULT_LIMIT;
  }
  return new Promise(function(resolve) {
    const db = exports.getDb();

    let summaryItems = null;
    let result = null;
    db.transaction('r', db.pagesummary, db.pageblobs, function() {
      db.pagesummary
        .orderBy('captureHref')
        .offset(offset)
        .limit(numDesired)
        .toArray()
      .then(summariesArr => {
        summaryItems = summariesArr;
        let summaryHrefs = summaryItems.map(item => item.captureHref);
        return db.pageblobs.where('captureHref').anyOf(summaryHrefs).toArray();
      })
      .then(pageblobArr => {
        result = exports.getAsCPSummaryArr(summaryItems, pageblobArr);
      });
    })
    .then(() => {
      resolve(result);
    });
  });
};
