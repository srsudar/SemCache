'use strict';

const appMsg = require('../app-bridge/messaging');
const util = require('../util/util');

let swal = null;

let localPageInfo = null;

// IDs for use with templating popups.
exports.idOpenOriginal = 'openOriginal';
exports.idOpenLocal = 'openLocal';
exports.idNetworkPrefix = 'networkLink_';

/**
 * We receive local cpinfos and network cpinfos seperately. For that reason, we
 * are going to cache them here. only create the popup HTML when clicked.
 *
 * This object holds entries like:
 * {
 *   href: {
 *     local: [ CPInfo, CPInfo, ... ],
 *     network: [ CPInfo, CPInfo, ... ]
 *   }
 * }
 */
let hrefToCpInfos = {};

/**
 * Add listeners for buttons in our popups.
 */
exports.addListenersToBtns = function(href) {
  let btns = document.querySelectorAll('button.btn-sem');
  btns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      exports.handleOpenButtonClick(href, e.currentTarget);
    });
  });
};

/**
 * @param {number} idx
 *
 * @return {string} A string for use in an HTML template.
 */
exports.getNetworkButtonIdForIndex = function(idx) {
  return exports.idNetworkPrefix + idx;
};

/**
 * Get the index of the network page from the id of the element. Essentially a
 * reverse mapping for getNetworkButtonIdForIndex().
 *
 * @param {string} id
 *
 * @return {number}
 */
exports.getIndexFromId = function(id) {
  let intStr = id.substr(exports.idNetworkPrefix.length);
  return parseInt(intStr);
};

/**
 * Lazily get the sweetalert2 module. We can't require it on its own,
 * annoyingly, due to an apparent global requirement on document.
 */
exports.getSweetAlert = function() {
  if (!swal) {
    swal = require('sweetalert2');
  }
  return swal;
};

/**
 * Get the cached cpInfos, an object mapping:
 * {
 *   href: {
 *     local: [ CPInfo, CPInfo, ... ],
 *     network: [ CPInfo, CPInfo, ... ]
 *   }
 * }
 */  
exports.getCpInfoState = function() {
  return hrefToCpInfos;
};

/**
 * Return the local CachedPage object. This will have been retrieved from the
 * app. It exists here solely to be cached locally.
 *
 * @return {CachedPage|null} null if the query has not been performed or if the
 * page is not available
 */
exports.getLocalCachedPage = function() {
  return localPageInfo;
};

/**
 * Handler for internal (to the Extension) messages. Should be added via
 * runtime.onMessage.addListener.
 *
 * @param {any} message message from the sender
 * @param {MessageSender} sender
 * @param {function} callback
 */
exports.onMessageHandler = function(message, sender, callback) {
  if (message.type === 'readystateComplete') {
    exports.handleLoadMessage(message, sender, callback);
    return true;
  } else if (message.type === 'queryResult') {
    exports.handleQueryResultMessage(message, sender, callback);
    return false;
  } else if (message.from === 'popup' && message.type === 'queryForPage') {
    exports.handleQueryFromPopup(message, sender, callback);
    return true;
  }
};

exports.handleQueryFromPopup = function(message, sender, callback) {
  callback(exports.getLocalCachedPage());
};

/**
 * Handle a message from the app of type 'queryResult'.
 *
 * @param {any} message the message from the app
 */
exports.handleQueryResultMessage = function(message) {
  if (message.page) {
    console.log('Received positive query: ', message);
    localPageInfo = message.page;
  }
};

/**
 * Handle a message of type 'readystateComplete'
 *
 * @param {any} message from runtime.onMessage
 * @param {MessageSender} sender from runtime.onMessage
 * @param {function} callback from runtime.onMessage
 */
exports.handleLoadMessage = function(message, sender, callback) {
  // Wait for document.readyState to be complete.
  // Send the response object.
  util.getOnCompletePromise()
  .then(() => {
    let response = exports.createLoadResponseMessage();
    console.log('Invoking callback with response: ', response);
    callback(response);
  });
};

exports.createLoadResponseMessage = function() {
  let loadTime = exports.getFullLoadTime();
  return {
    type: 'readystateComplete',
    loadTime: loadTime
  };
};

/**
 * Return the full time it took to load the page.
 *
 * @return {number} the time from navigation start to readyState = 'complete'.
 */
exports.getFullLoadTime = function() {
  let win = util.getWindow();
  let result = win.performance.timing.domComplete -
    win.performance.timing.navigationStart;
  return result;
};

/**
 * Set up the popup for viewing cached versions of the page.
 */
exports.initPopupForAnchor = function(anchor) {
  let absoluteUrl = exports.getAbsoluteUrl(anchor.href);

  let savedState = exports.getCpInfoState()[absoluteUrl];

  if (!savedState) {
    console.log('No saved cpinfos for href! There should be.', absoluteUrl);
    return;
  }

  let local = savedState.local || [];
  let network = savedState.network || [];

  let popupHtml = exports.createPopupHtml(absoluteUrl, local, network);

  let swal = exports.getSweetAlert();

  // Overwite the onclick property to return false so that we don't open the
  // link by default.
  anchor.onclick = () => false;

  anchor.addEventListener('click', function() {
    swal({
      html: popupHtml,
      cancelButtonText: 'Cancel',
      showConfirmButton: false,
      showCancelButton: true,
      showCloseButton: true,
    });

    // Add the listeners separately. This saves us from Chrome's CSP on
    // displaying mhtml pages, which blocks our script when we try to run via
    // the onOpen() function sweet alert provides. This makes me nervous that
    // if sweet alert was ever slow to insert the buttons into the dom we might
    // miss them when attaching listeners, but setTimeout() functions are
    // blocked on mhtml pages. I've never seen this to be a problem, but I
    // worry that it could become a problem.
    exports.addListenersToBtns(absoluteUrl);
  });

};

/**
 * @param {string} href
 * @param {DOMElement} btn The button being clicked
 */
exports.handleOpenButtonClick = function(href, btn) {
  let id = btn.id;
  let savedState = exports.getCpInfoState()[href];
  let cpinfoToOpen = null;
  if (id === exports.idOpenOriginal) {
    // Open the page to the href
    exports.toastMessage('Opening...');
    util.getWindow().location = href;
    return;
  } else if (id === exports.idOpenLocal) {
    // Open the local page. We're assuming only 1.
    cpinfoToOpen = savedState.local[0];
  } else {
    // A network page.
    // Get the index. 
    let idx = exports.getIndexFromId(id);
    cpinfoToOpen = savedState.network[idx];
  }
  console.log('opening');
  let openingDiv = exports.toastMessage('Opening...');
  appMsg.sendMessageToOpenPage(
    'contentscript', cpinfoToOpen.serviceName, cpinfoToOpen.captureHref
  )
  .catch(err => {
    console.log(err);
    openingDiv.remove();
    let errorDiv = exports.toastError(err.body);
    errorDiv.onclick = () => { errorDiv.remove(); }; 
  });
};

exports.addAlertDiv = function(msg) {
  let html =
    `<div style="padding: 5px;">
      <div>
          ${msg}
      </div>
    </div>`;
  let div = document.createElement('div');
  div.id = 'sem-message';
  div.innerHTML = html;
  let body = document.querySelector('body');
  body.appendChild(div);

  // Close on click
  div.onclick = () => { div.remove(); };
  return div;
};

exports.toastMessage = function(msg) {
  let result = exports.addAlertDiv(msg);
  result.classList.add('sem-toast');
  return result;
};

exports.toastError = function(msg) {
  let result = exports.addAlertDiv(msg);
  result.classList.add('sem-error');
  return result;
};

/**
 * @param {boolean} isLocal true if these are local CPInfos, otherwise they are
 * assumed to be on the network
 * @param {Object} urlToPageArr an Object like:
 * {
 *   href: [ CPInfo, ... ]
 * }
 */
exports.saveCpInfoState = function(isLocal, urlToPageArr) {
  // Update our cache state in the content script.
  for (let url of Object.keys(urlToPageArr)) {
    let toSave = urlToPageArr[url];
    let existingInfo = hrefToCpInfos[url];
    if (!existingInfo) {
      existingInfo = {};
      hrefToCpInfos[url] = existingInfo;
    }
    if (isLocal) {
      existingInfo.local = toSave;
    } else {
      existingInfo.network = toSave;
    }
  }
};

/**
 * Annotate links that are locally available.
 *
 * @return {Promise.<undefined, Error>}
 */
exports.annotateLocalLinks = function() {
  return new Promise(function(resolve, reject) {
    let links = exports.getLinksOnPage();
    let urls = Object.keys(links);
    
    appMsg.queryForPagesLocally('contentscript', urls)
    .then(urlToPageArr => {
      // localUrls will be an Object mapping URLs to arrays of locally
      // available pages.
      Object.keys(urlToPageArr).forEach(url => {
        // Save query results
        exports.saveCpInfoState(true, urlToPageArr);

        // Update page state.
        let anchors = links[url];
        anchors.forEach(anchor => {
          exports.annotateAnchorIsLocal(anchor);
          exports.initPopupForAnchor(anchor);
        });
      });
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Annotate links that are available on the network but not in this machine.
 *
 * @return {Promise.<undefined, Error>}
 */
exports.annotateNetworkLocalLinks = function() {
  return new Promise(function(resolve, reject) {
    let links = exports.getLinksOnPage();
    let urls = Object.keys(links);
    
    appMsg.queryForPagesOnNetwork('contentscript', urls)
    .then(urlToInfoArr => {
      // localUrls will be an Object mapping URLs to arrays of locally
      exports.saveCpInfoState(false, urlToInfoArr);

      // available pages.
      Object.keys(urlToInfoArr).forEach(url => {
        let anchors = links[url];
        anchors.forEach(anchor => {
          exports.annotateAnchorIsOnNetwork(anchor);
          exports.initPopupForAnchor(anchor);
        });
      });
      resolve();
    })
    .catch(err => {
      reject(err);
    });
  });
};

/**
 * Get the anchor elements that might be annotated.
 *
 * @return {Object} returns an object like the following:
 * {
 *   url: [ DOMElement, ... ]
 * }
 * This object will contain fully absolute URLs mapped to the DOMElement
 * anchors with that URL as its href attribute.
 */
exports.getLinksOnPage = function() {
  let allAnchors = exports.selectAllLinksWithHrefs();
  let result = {};

  allAnchors.forEach(anchor => {
    // Get the absolute URL.
    let url = exports.getAbsoluteUrl(anchor.href);
    let existingDoms = result[url];
    if (!existingDoms) {
      existingDoms = [];
      result[url] = existingDoms;
    }
    existingDoms.push(anchor);
  });

  return result;
};

/**
 * Get an absolute URL from the raw href from an anchor tag. There are several
 * things to consider here--the href might be relative or absolute, it could
 * lack or contain the scheme, etc. We are going to use the document itself to
 * get around this. Taken from this page:
 *
 * https://stackoverflow.com/questions/14780350/convert-relative-path-to-absolute-using-javascript
 *
 * @param {string} href the href from an anchor tag
 *
 * @return {string} the absolute, canonicalized URL. Ignores the search and
 * hash
 */
exports.getAbsoluteUrl = function(href) {
  let a = document.createElement('a');
  a.href = href;
  let result = a.protocol + '//' + a.host + a.pathname;
  return result;
};

/**
 * Perform a query selection for all links with href attributes.
 *
 * This is a thing wrapper around the document API to facilitate testing.
 *
 * @return {Array<DOMElement}
 */
exports.selectAllLinksWithHrefs = function() {
  return document.querySelectorAll('a[href]');
};

/**
 * @param {string} href
 * @param {CPInfo} localCpinfo
 * @param {Array.<CPInfo>} networkCpinfoArr
 *
 * @return {string} HTML for an alert.
 */
exports.createPopupHtml = function(href, localCpinfo, networkCpinfoArr) {
  let header =
  `<h2 class="swal2-title" id="swal2-title">Cached Versions Available</h2>`;
  let normalLink =
    `<table align="center" id="mainTables" class="table">
     <tbody>
     <tr>
       <td>Open original link</td>
       <td>
         <button id="${exports.idOpenOriginal}"
          class="open-original btn btn-sm btn-sem">
         Go
         </button>
       </td>
     </tr>`;

  let ownLink =
    `<tr>
       <td>View local copy</td>
       <td>
         <button id="${exports.idOpenLocal}"
          class="btn btn-sm open-local btn-sem">
           Open
         </button>
       </td>
     </tr>`;

  // Don't set this if we don't have a local copy.
  if (!localCpinfo || localCpinfo.length === 0) {
    ownLink = '';
  }

  let otherLinks = '';

  for (let i = 0; i < networkCpinfoArr.length; i++) {
    let cpinfo = networkCpinfoArr[i];
    let linkId = exports.getNetworkButtonIdForIndex(i);
    let nextTr =
      `<tr>
        <td>${cpinfo.friendlyName}</td>
        <td>
          <button id="${linkId}" class="btn btn-sm open-network btn-sem">
            Get
          </button>
        </td>
      </tr>`;
    otherLinks += nextTr;
  }

  let footer = `</tbody></table>`;
  let result = header + normalLink + ownLink + otherLinks + footer;
  return result;
};

/**
 * Annotate an individual anchor to indicate that it is available locally. The
 * anchor is annotated in place.
 *
 * @param {DOMElement} anchor an anchor element as returned by
 * document.querySelector
 */
exports.annotateAnchorIsLocal = function(anchor) {
  // We'll style the link using a lightning bolt, known as 'zap'.
  let zap = '\u26A1';
  anchor.innerHTML = anchor.innerHTML + zap;
};

exports.annotateAnchorIsOnNetwork = function(anchor) {
  // We'll style the link using a cloud.
  let cloud = '\u2601';
  anchor.innerHTML = anchor.innerHTML + cloud;
};
