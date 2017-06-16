'use strict';

/**
 * Objects having to do with our persistence layer. CP stands for 'Cached
 * Page'.
 *
 * The hierarchy is generally as follows:
 *
 * CPInfo: the lightest object. No binaries
 * CPSummary extends CPInfo: wraps the above but also
 *   provides blobs, including the screenshot and the favicon
 * CPDisk extends CachedPageSummary: the heaviest object. Includes the
 *   mhtml blob itself
 */

/**
 * A lightweight representation of a cached page.
 */
class CPInfo {
  /**
   * @param {Object} params
   * @param {string} params.captureHref the full href of the page
   * @param {string|Date} params.captureDate the date or toISOString() results
   *   of the capture date.
   * @param {string} params.title the title of the page
   * @param {string} params.filePath the file path, relative to the directory
   *   where cached files are written, in the file structure.
   */
  constructor({
    captureHref,
    captureDate,
    title,
    filePath=null
  }) {
    this.captureHref = captureHref;
    this.captureDate = captureDate;
    this.title = title;
    this.filePath = filePath;
  }

  /**
   * @return {boolean}
   */
  canBePersisted() {
    return this.filePath !== null &&
      this.captureHref !== null &&
      this.captureDate !== null;
  }

  /**
   * Sort an array of CPInfo objects. Sorts in place using the .sort() method
   * on the array.
   *
   * Sort by captureHref and then by date.
   *
   * @return {undefined}
   */
  static sort(arr) {
    arr.sort((a, b) => {
      var ahref = a.captureHref.toUpperCase();
      var bhref = b.captureHref.toUpperCase();
      if (ahref < bhref) {
        return -1;
      }
      if (ahref > bhref) {
        return 1;
      }
      if (a.captureDate < b.captureDate) {
        return -1;
      }
      if (a.captureDate > b.captureDate) {
        return 1;
      }
      // Equal
      return 0;
    });
  }
}

class CPSummary extends CPInfo {
  /**
   * @param {Object} params
   * @param {??} params.favicon
   * @param {??} params.screenshot
   */
  constructor({
    captureHref,
    captureDate,
    title,
    filePath,
    favicon,
    screenshot
  }) {
    super({
      captureHref: captureHref,
      captureDate: captureDate,
      title: title,
      filePath: filePath
    });
    this.favicon = favicon;
    this.screenshot = screenshot;
  }

  /**
   * Create a copy of the object as a CPInfo.
   *
   * @return {CPInfo}
   */
  asCPInfo() {
    let params = {
      captureHref: this.captureHref,
      captureDate: this.captureDate,
      title: this.title,
      filePath: this.filePath
    };
    return new CPInfo(params);
  }

  /**
   * Create a copy of the object as a CPDisk.
   *
   * @param {??} mhtml
   *
   * @return {CPDisk}
   */
  asCPDisk(mhtml) {
    let params = {
      captureHref: this.captureHref,
      captureDate: this.captureDate,
      title: this.title,
      filePath: this.filePath,
      favicon: this.favicon,
      screenshot: this.screenshot,
      mhtml: mhtml
    };
    return new CPDisk(params);
  }
}

class CPDisk extends CPSummary {
  /**
   * @param {Object} params
   * @param {??} params.mhtml
   */
  constructor({
    captureHref,
    captureDate,
    title,
    filePath,
    favicon,
    screenshot,
    mhtml
  }) {
    super({
      captureHref: captureHref,
      captureDate: captureDate,
      title: title,
      filePath: filePath,
      favicon: favicon,
      screenshot: screenshot
    });
    this.mhtml = mhtml;
  }

  /**
   * Copy the object as a CPSummary. This is largely for subclasses.
   *
   * @return {CPSummary}
   */
  asCPSummary() {
    let params = {
      captureHref: this.captureHref,
      captureDate: this.captureDate,
      title: this.title,
      filePath: this.filePath,
      favicon: this.favicon,
      screenshot: this.screenshot
    };
    return new CPSummary(params);
  }
}

exports.CPInfo = CPInfo;
exports.CPSummary = CPSummary;
exports.CPDisk = CPDisk;
