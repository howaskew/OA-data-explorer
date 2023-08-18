let scheme_1 = null;
let scheme_2 = null;

let organizerListRefresh;
let locationListRefresh;
let activityListRefresh;

let retryCount;
const retryCountMax = 3;
let retryCountdown;
const retryCountdownMax = 5;

let loadingTimeout;
let retryInterval;
let inProgress;
let stopTriggered;
let showingSample;

let urlTriggered; // Don't add to clearGlobals(), only relevant for initial page load via setFeeds()
let executeTriggered; // Don't add to clearGlobals(), only relevant for initial page load via setFeeds()

let filters;
let coverage;
let proximity;
let day;
let startTime;
let endTime;
let minAge;
let maxAge;
let keywords;

let chart1;
let chart2;
let chart3;
let chart4;
let chart5a;
let chart5b;
let chart6;
let chart2rendered = false;
let chart3rendered = false;
let chart4rendered = false;
let chart5arendered = false;
let chart5brendered = false;
let chart6rendered = false;
let map;

let activeJSONButton;
const activeJSONButtonColor = '#009ee3';
const inactiveJSONButtonColor = '#6c757d';
const storeIngressOrder1ApiColor = '#74cbf3';
const storeIngressOrder2ApiColor = '#009ee3';

let feeds = {};
let publisherNames = [];

let summary = {}; // To hold total counts from database

let storeIngressOrder1;
let storeIngressOrder2;
let storeDataQuality; // This is used to store the results of DQ tests for filtering, regardless of whether or not we have a combined store from multiple feeds
let storeSample; // This is used to store a small sample of data from each run to show users on arrival
let storeCombinedItems; // This is present only if we have valid storeSuperEvent, storeSubEvent and link between them

// These will simply point to storeIngressOrder1 and storeIngressOrder2:
let storeSuperEvent;
let storeSubEvent;

// These will simply point to the current store and URL being loaded, used for returning to in case of need to retry
let storeCurrent;
let urlOriginalCurrent;

const superEventContentTypesSeries = ['SessionSeries'];
const superEventContentTypesFacility = ['FacilityUse', 'IndividualFacilityUse'];
const superEventContentTypesEvent = ['EventSeries', 'HeadlineEvent'];
const superEventContentTypesCourse = ['CourseInstance'];
const superEventContentTypes = Array.prototype.concat(superEventContentTypesSeries, superEventContentTypesFacility, superEventContentTypesEvent, superEventContentTypesCourse);
const subEventContentTypesSession = ['ScheduledSession', 'ScheduledSessions', 'session', 'sessions'];
const subEventContentTypesSlot = ['Slot', 'Slot for FacilityUse'];
const subEventContentTypesEvent = ['Event', 'OnDemandEvent'];
const subEventContentTypes = Array.prototype.concat(subEventContentTypesSession, subEventContentTypesSlot, subEventContentTypesEvent);

const seriesUrlParts = [
  'session-series',
  'sessionseries',
];
const facilityUrlParts = [
  'individual-facility-uses',
  'individual-facilityuses',
  'individualfacility-uses',
  'individualfacilityuses',
  'individual-facility-use',
  'individual-facilityuse',
  'individualfacility-use',
  'individualfacilityuse',
  'facility-uses',
  'facilityuses',
  'facility-use',
  'facilityuse',
];
const sessionUrlParts = [
  'scheduled-sessions',
  'scheduledsessions',
  'scheduled-session',
  'scheduledsession',
];
const slotUrlParts = [
  'slots',
  'slot',
  'facility-use-slots',
  'facility-use-slot',
  'facility-uses/events',
  'facility-uses/event',
];

let storeIngressOrder1FirstPageFromUser = null; // Don't add this to clearGlobals(), let it be exclusively controlled by $('#user-url').on('change', ()=>{}).
let endpoint = undefined; // This is null for the case of showing all OpenActive feeds, so undefined is useful and distinct. Don't add this to clearGlobals(), let it be exclusively controlled by setEndpoint().
let type; // This may be the feedType, itemDataType or itemKind, depending on availability
let link; // Linking variable between super-event and sub-event feeds

let message;
let messageStopTriggered = 'Stopping ...';
let messageStopEnacted = 'Stop enacted';
let messageStopDone = 'Stopped';
let messageId;
let messageIdProgress;

let progressIndicator = "<img src='images/ajax-loader.gif' alt='In progress'>";
$('#progress-indicator').append(progressIndicator);

// -------------------------------------------------------------------------------------------------

// Axios

// Info on 'response' and 'error' from:
// - https://axios-http.com/docs/res_schema
// - https://www.sitepoint.com/axios-beginner-guide/

// The 'response' object has the following properties:
// - request (object): the actual XMLHttpRequest object (when running in a browser).
// - config (object): the original request configuration.
// - status (number): the HTTP code returned from the server.
// - statusText (string): the HTTP status message returned by the server.
// - headers (object): all the headers sent back by the server.
// - data (object): the payload returned from the server. By default, Axios expects JSON and will parse this back into a JavaScript object for you.

// The 'error' object will contain at least some of the following properties:
// - request (object): the actual XMLHttpRequest object (when running in a browser).
// - config (object): the original request configuration.
// - response (object): the response object (if received) as described above.
// - message (string): the error message text.

// Note that with axios, if getting a remote URL directly then there may be issues due to sending the
// request from the client-side herein, and extra steps will be required to sort out CORS policy details
// (try it and see). However, we are going via our /fetch endpoint in the app.js server, so we don't
// experience this issue in the current setup. See here for details:
// - https://stackoverflow.com/questions/54212220/how-to-fix-access-to-xmlhttprequest-has-been-blocked-by-cors-policy-redirect-i

// Disable client-side caching. Note that according to some sources, even this approach may still have
// issues with routers, firewalls and proxies not honouring the settings. The only fool-proof method
// may be a random string suffix on the URL, but that has issues when we actually do want to cache
// on the server-side, and would require steps to remove the random suffix. Stick with this succinct
// approach for now until as and when it clearly doesn't work. See here for details:
// - https://stackoverflow.com/questions/49263559/using-javascript-axios-fetch-can-you-disable-browser-cache#comment132084883_69342671
// - https://stackoverflow.com/questions/61224287/how-to-force-axios-to-not-cache-in-get-requests
// - https://thewebdev.info/2021/11/18/how-to-disable-browser-cache-with-javascript-axios/

// If the original headers are needed in order to later revert to or test against, use this approach
// instead of the live approach:
// let axiosDefaultsHeadersOriginal = JSON.parse(JSON.stringify(axios.defaults.headers));
// let axiosDefaultsHeadersModified = {
//   'Cache-Control': 'no-cache',
//   'Pragma': 'no-cache',
//   'Expires': '0',
// };
// axios.defaults.headers = axiosDefaultsHeadersModified;
axios.defaults.headers = {
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Expires': '0',
};
axios.defaults.timeout = 40000; // In ms. Default 0. Increase to wait for longer to receive response. Should be greater than the timeout in app.js which calls out to the actual feed.

// Use this to test access to another client-side localhost instance. It will only work if a permissive
// CORS policy has been set in the other instance, or with the original Axios headers set herein:
// axios.get('http://localhost:5050/some-page').then(response => console.log(response.data));

// -------------------------------------------------------------------------------------------------

// messageIn can be a string or an array. The array option is to allow a different message to be printed
// to the user console than the dev console, if desired. The first element will go to the user console,
// and the last element will go to the dev console. If a string is given instead of an array, then
// both messages are the same. In all cases, messages are always printed to the user console but only
// printed to the dev console if echoInDevConsole is true.
function setLogMessage(messageIn, messageType, echoInDevConsole=false) {

  // This global variable can be used to track and modify a particular user console message after it
  // has been printed, if need be. It is returned from this function for that purpose, primarily intended
  // for changing the colour of the status dot when status changes.
  messageId++;

  if (typeof messageIn === 'string') {
    messageIn = [messageIn];
  }

  if (messageType === 'heading') {
    messageOut = `<div id='log-message-${messageId}' class='top left-right log-heading'>${messageIn[0]}</div>`;
  }
  else {
    messageOut = `<div id='log-message-${messageId}' class='left-right'><span id='log-dot-${messageId}' class='log-dot log-dot-${messageType}'></span>${messageIn[0]}</div>`;
  }

  $('#log').append(messageOut);
  $('#log').scrollTop($('#log')[0].scrollHeight);

  if (echoInDevConsole) {
    switch (messageType) {
      case ('heading'):
        console.warn(messageIn[messageIn.length-1]);
        break;
      case ('warn'):
        console.warn(messageIn[messageIn.length-1]);
        break;
      case ('error'):
        console.warn(messageIn[messageIn.length-1]);
        break;
      default:
        console.log(messageIn[messageIn.length-1]);
        break;
    }
  }

  return messageId;
}

// -------------------------------------------------------------------------------------------------

function updateLogMessage(messageIdCurrent, messageTypeIn, messageTypeOut) {
  $(`#log-dot-${messageIdCurrent}`).removeClass(`log-dot-${messageTypeIn}`).addClass(`log-dot-${messageTypeOut}`);
}

// -------------------------------------------------------------------------------------------------

async function execute() {
  if (!inProgress) {
    clear(true);
    inProgress = true; // Here this must come after clear()
    $('#progress-indicator').show();

    setLogMessage('Preparing', 'heading', true);
    await setStoreIngressOrder1FirstPage();
    await setStoreFeedType(storeIngressOrder1);
    await setStoreIngressOrder2FirstPage();
    await setStoreFeedType(storeIngressOrder2);

    if (storeIngressOrder1.firstPage) {
      loadingStart();
    }
    else {
      setLogMessage('Feed-1 has no valid first page, can\'t begin', 'error', true);
      $('#execute').prop('disabled', false);
      $('#progress-indicator').hide();
      inProgress = false;
    }
  }
}

// -------------------------------------------------------------------------------------------------

function loadingStart() {
  updateScroll();

  loadingTimeout = setTimeout(
    () => {
      if (inProgress && !stopTriggered) {
        $('#loading-time').fadeIn();
      }
    },
    5000
  );

  setLogMessage('Loading', 'heading', true);
  try {
    setStoreItems(storeIngressOrder1.firstPage, storeIngressOrder1);
  }
  catch (error) {
    setLogMessage(error.message, 'error', true);
    stop();
    return;
  }
}

// -------------------------------------------------------------------------------------------------

function loadingComplete() {
  clearTimeout(loadingTimeout);
  $('#loading-time').hide();
  $('#resultTab').text('Live Data');
  $('#dq-label').fadeIn();
  $('.explainer').fadeIn();

  let funcs = [
    setStoreSuperEventAndStoreSubEvent,
    setStoreDataQualityItems,
    setStoreDataQualityItemFlags,
    postDataQuality,
  ];

  setLogMessage('Analysing', 'heading', true);
  for (const func of funcs) {
    try {
      func();
    }
    catch (error) {
      setLogMessage(error.message, 'error', true);
      stop();
      return;
    }
  }
}

// -------------------------------------------------------------------------------------------------

function stop() {
  $('#progress-indicator').hide();
  inProgress = false; // Here this must come before clear()
  if (stopTriggered) {
    setLogMessage(messageStopDone, 'warn', true);
    clear();
  }
  else {
    $('#execute').prop('disabled', false);
    $('#clear').prop('disabled', false);
  }
}

// -------------------------------------------------------------------------------------------------

function clear(execute = false) {
  // console.warn(`${luxon.DateTime.now()} clear`);
  $('#execute').prop('disabled', true);
  $('#clear').prop('disabled', true);
  if (!inProgress) {
    clearForm();
    clearRetry();
    clearDisplay();
    clearFilters();
    clearGlobals();
    // Here we only allow for non-undefined and non-null endpoints, coming from the cases of a user-URL
    // or a menu-URL, and not including the case of showing all OpenActive feeds which gives a null endpoint:
    if (endpoint) {
      $('#execute').prop('disabled', execute);
      $('#clear').prop('disabled', false);
    }
    else {
      showSample();
    }
  }
  else {
    stopTriggered = true;
    setLogMessage(messageStopTriggered, 'warn', true);

    clearTimeout(loadingTimeout);
    $('#loading-time').hide();

    if (retryInterval) {
      clearInterval(retryInterval);
      // We have this message as 'error' rather than 'warn' as in general stop triggered is handled as a
      // caught error:
      setLogMessage(messageStopEnacted, 'error', true);
      stop();
      return;
    }
  }
}

// -------------------------------------------------------------------------------------------------

function clearForm() {
  // Here we allow for the case of showing all OpenActive feeds which gives a null endpoint:
  if (endpoint !== undefined) {
    window.history.replaceState('', '', `${window.location.href.split('?')[0]}?endpoint=${endpoint}`);
  }
  else {
    // We shouldn't actually have a case when we're here from the endpoint being undefined. If we do, then
    // the following command will cause a refresh of the window and therefore the variables too. However,
    // if the condition that led to the endpoint being undefined was in the initial page setup, then we
    // will return here, refresh, and continue as such indefinitely. Check setEndpoint() for issues.
    window.location.search = '';
  }
}

// -------------------------------------------------------------------------------------------------

function clearRetry() {
  // console.warn(`${luxon.DateTime.now()} clearRetry`);
  retryCount = 0;
  retryCountdown = retryCountdownMax;
  $('#loading-error').hide();
  $('#loading-error-message').empty();
  $('#retry-auto').show();
  $('#retry-manual').hide();
  $('#retry').hide();
  $('#retryCount').text(retryCount);
  $('#retryCountAuto').text(retryCount + 1);
  $('#retryCountMax').text(retryCountMax);
  $('#retryCountdown').text(retryCountdown);
}

// -------------------------------------------------------------------------------------------------

function clearDisplay() {
  // console.warn(`${luxon.DateTime.now()} clearDisplay`);
  $('#log').empty();
  $('#progress-indicator').hide();
  $('#record-limit').hide();
  $('#loading-time').hide();
  $('#filter-menus').hide();
  $('#filter-switches').hide();
  $('#output').hide();
  $('#tabs').hide();
  clearCharts();
  clearTabs();
}

// -------------------------------------------------------------------------------------------------

function clearCharts() {
  // console.warn(`${luxon.DateTime.now()} clearCharts`);
  if (chart1) { try { chart1.destroy(); } catch { } }
  if (chart2 && chart2rendered) { try { chart2.destroy(); } catch { } }
  if (chart3 && chart3rendered) { try { chart3.destroy(); } catch { } }
  if (chart4 && chart4rendered) { try { chart4.destroy(); } catch { } }
  if (chart5a && chart5arendered) { try { chart5a.destroy(); } catch { } }
  if (chart5b && chart5brendered) { try { chart5b.destroy(); } catch { } }
  if (chart6 && chart6rendered) { try { chart6.destroy(); } catch { } }
}

// -------------------------------------------------------------------------------------------------

function clearTabs() {
  // console.warn(`${luxon.DateTime.now()} clearTabs`);
  $("#results").empty();
  $("#json").empty();
  $("#api").empty();
  $("#organizer").empty();
  $("#location").empty();
  $("#map").empty();
}

// -------------------------------------------------------------------------------------------------

function clearFilters() {
  // console.warn(`${luxon.DateTime.now()} clearFilters`);
  $("#organizer-list-selected").val("");
  $("#location-list-selected").val("");
  $("#activity-list-selected").val("");
  $("#Keywords").val("");
  $("#Day").val("");
  $("#StartTime").val("");
  $("#EndTime").val("");
  $("#Coverage").val("");
  $("#Proximity").val("");
  $("#Gender").val("");
  $("#minAge").val("");
  $("#maxAge").val("");
  $("#DQ_filterActivities").prop("checked", false);
  $("#DQ_filterGeos").prop("checked", false);
  $("#DQ_filterDates").prop("checked", false);
  $("#DQ_filterUrls").prop("checked", false);
}

// -------------------------------------------------------------------------------------------------

function clearGlobals() {
  // console.warn(`${luxon.DateTime.now()} clearGlobals`);
  message = '';
  messageId = 0;
  messageIdProgress = null;
  organizerListRefresh = 0;
  locationListRefresh = 0;
  activityListRefresh = 0;
  loadingTimeout = null;
  retryInterval = null;
  inProgress = false;
  stopTriggered = false;
  showingSample = false;
  storeIngressOrder1 = {
    ingressOrder: 1,
  };
  storeIngressOrder2 = {
    ingressOrder: 2,
  };
  storeDataQuality = {};
  storeSample = {};
  storeCombinedItems = [];
  storeSuperEvent = null;
  storeSubEvent = null;
  storeCurrent = null;
  urlOriginalCurrent = '';
  type = null;
  link = null;
  clearStore(storeIngressOrder1);
  clearStore(storeIngressOrder2);
  clearStore(storeDataQuality);
  clearStore(storeSample);
}

// -------------------------------------------------------------------------------------------------

function clearStore(store) {
  // console.warn(`${luxon.DateTime.now()} clearStore`);
  store.timeHarvestStart = null;
  store.items = {};
  store.urls = {};
  store.firstPageOrigin = null;
  store.firstPage = null;
  store.penultimatePage = null;
  store.lastPage = null;
  store.numPages = 0;
  store.numItems = 0;
  store.feedType = null; // From the dataset page, not the RPDE feed
  store.itemKind = null; // From the RPDE feed
  store.itemDataType = null; // From the RPDE feed
  store.eventType = null; // Either 'superEvent' or 'subEvent'
}

// -------------------------------------------------------------------------------------------------

function clearCache(store) {
  for (const url of [store.penultimatePage, store.lastPage]) {
    if (url) {
      // By default, axios serializes JavaScript objects in the body to JSON via JSON.stringify(), so we
      // don't need to explicitly use JSON.stringify() as with the 'fetch' package. See here for details:
      // - https://axios-http.com/docs/urlencoded
      axios.post(
        '/api/cache/clear',
        {
          url: `/fetch?url=${encodeURIComponent(url)}`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
        .then(response => {
          console.log(response.data);
        })
        .catch(error => {
          console.error(error.message);
        });
    }
  }
}

// -------------------------------------------------------------------------------------------------

function showSample() {
  getSummary();

  $('#resultTab').text('Sample Data');
  $('#dq-label').hide();
  $('#filter-switches').fadeOut();
  $('.explainer').fadeOut();

  $.getJSON('/api/get-sample', function (sampleData) {
    storeSample.items = sampleData;
    console.log(`Number of sample items: ${Object.keys(storeSample.items).length}`);
    if (Object.keys(storeSample.items).length > 0) {
      showingSample = true;

      const sampleUrls = new Set();
      Object.keys(storeSample.items).forEach(id => {
        const sampleUrlsCurrent = id.split('http').slice(1,3).map(url => 'http' + url.trim());
        sampleUrlsCurrent.forEach(url => sampleUrls.add(url));
      });

      setLogMessage('Exploring OpenActive Data', 'heading');
      setLogMessage(`The counts shown below are based on DQ analysis of the first 25,000 items of ${sampleUrls.size} feeds.`, 'warn');
      setLogMessage('The sample data shown below is drawn from a very small sample of 5 records taken from each feed.', 'warn');
      setLogMessage('Explore the sample data or select a data provider and data type then press \'Go\' to load and view live data.', 'warn');

      clearStore(storeDataQuality);
      // The sort operation here shuffles the items into a random order, just to present different results
      // to the user each time:
      storeDataQuality.items = Object.values(storeSample.items).sort(() => Math.random() - 0.5);
      console.log('Processing sample data');
      setStoreDataQualityItemFlags();
      postDataQuality();
    }
  })
    .catch(error => {
      console.error('Error from sample:', error);
    });
}

// -------------------------------------------------------------------------------------------------

function getFilters() {
  filters = {
    organizerName: $('#organizer-list-selected').val(),
    locationName: $('#location-list-selected').val(),
    activityName: $('#activity-list-selected').val(),
    relevantActivitySet: getRelevantActivitySet($('#activity-list-selected').val()),
    keywords: $('#Keywords').val(),
    day: $('#Day').val(),
    startTime: $('#StartTime').val(),
    endTime: $('#EndTime').val(),
    coverage: $('#Coverage').val(),
    proximity: $('#Proximity').val(),
    gender: $('#Gender').val(),
    minAge: $('#minAge').val(),
    maxAge: $('#maxAge').val(),
    DQ_filterActivities: $('#DQ_filterActivities').prop('checked'),
    DQ_filterGeos: $('#DQ_filterGeos').prop('checked'),
    DQ_filterDates: $('#DQ_filterDates').prop('checked'),
    DQ_filterUrls: $('#DQ_filterUrls').prop('checked'),
  }
}

// -------------------------------------------------------------------------------------------------

function enableFilters() {
  document.getElementById("DQ_filterActivities").disabled = false;
  document.getElementById("DQ_filterGeos").disabled = false;
  document.getElementById("DQ_filterDates").disabled = false;
  document.getElementById("DQ_filterUrls").disabled = false;
}

// -------------------------------------------------------------------------------------------------

function disableFilters() {
  document.getElementById("DQ_filterActivities").disabled = true;
  document.getElementById("DQ_filterGeos").disabled = true;
  document.getElementById("DQ_filterDates").disabled = true;
  document.getElementById("DQ_filterUrls").disabled = true;
}

// -------------------------------------------------------------------------------------------------

// This replaces the loadRPDE function in Nick's original visualiser adaptation
// Note the displaying of results happens in dq.js now, to improve filtering

function setStoreItems(urlOriginal, store) {

  if (stopTriggered) { throw new Error(messageStopEnacted); }

  // If we are retrying following an error, then arguments are not given to this function and we use
  // the latest that were in use instead:
  if (!urlOriginal) {
    urlOriginal = urlOriginalCurrent;
  }
  else {
    urlOriginalCurrent = urlOriginal;
  }

  if (!store) {
    store = storeCurrent;
  }
  else if (
    store.numPages === 0 &&
    retryCount === 0
  ) {
    storeCurrent = store;
    store.timeHarvestStart = luxon.DateTime.now();
    setLogMessage([
      `Feed-${store.ingressOrder}: ${store.feedType || ''} <a href='${store.firstPage}' target='_blank'>${store.firstPage}</a>`,
      `Feed-${store.ingressOrder}: ${store.feedType || ''} ${store.firstPage}`], 'done', true);
  }

  let url = setUrl(urlOriginal, store);
  if (!url) { throw new Error(`Invalid URL: ${urlOriginal}`); }

  // Note that the following commented example does not work as intended, as 'url' is a special
  // parameter name and becomes the actual URL of the GET request, so it doesn't end up going to
  // '/fetch?url=xxx' at all. Would have to rename the 'url' parameter to something else, and adjust
  // in app.js too, otherwise just stick to the live method unless this method is really needed for
  // some reason later on:
  // axios.get(
  //   '/fetch',
  //   {
  //     params: {
  //       url: ${encodeURIComponent(url)},
  //     },
  //   }
  // )
  axios.get(url.includes('localhost') ? url : `/fetch?url=${encodeURIComponent(url)}`)
    .then(response => {

      if (retryCount > 0) {
        clearRetry();
      }

      if (store.numPages === 0) {
        messageIdProgress = setLogMessage(`Loaded <span id='numPages${store.ingressOrder}'>0</span> pages, containing <span id='numItems${store.ingressOrder}'>0</span> items, in <span id='timeTaken${store.ingressOrder}'>0.00</span> seconds ...`, 'busy');
        addApiPanel(`Feed-${store.ingressOrder}`, store.ingressOrder, true);
      }

      store.numPages++;
      addApiPanel(url, store.ingressOrder);

      if (response?.data?.items) {
        for (const item of response.data.items) {
          // This is intentionally not decremented on item delete from the store, it is the count of all items
          // encountered in the feed, not the count of items in the store at any one time:
          store.numItems++;
          // For those records that are 'live' in the feed ...
          if (item.state === 'updated') {
            // Update the store (check against modified dates for existing items):
            if (!store.items.hasOwnProperty(item.id) || (item.modified > store.items[item.id].modified)) {
              store.items[item.id] = item;
              store.urls[item.id] = url;
            }
          }
          // For those records that are no longer 'live' in the feed ...
          else if ((item.state === 'deleted') && store.items.hasOwnProperty(item.id)) {
            // Delete any matching items from the store:
            delete store.items[item.id];
            delete store.urls[item.id];
          }
        }
      }

      const timeTaken = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds.toFixed(2);
      $(`#numPages${store.ingressOrder}`).text(store.numPages);
      $(`#numItems${store.ingressOrder}`).text(store.numItems);
      $(`#timeTaken${store.ingressOrder}`).text(timeTaken);

      if (
        typeof response?.data?.next === 'string' &&
        response.data.next.length > 0 &&
        response.data.next !== urlOriginal &&
        response.data.next !== url &&
        store.numItems < 25000
      ) {
        store.penultimatePage = url;
        try {
          setStoreItems(response.data.next, store);
        }
        catch (error) {
          setLogMessage(error.message, 'error', true);
          stop();
          return;
        }
      }
      else {
        if (store.numItems === 25000) {
          $('#record-limit').fadeIn();
        }

        store.lastPage = url;
        clearCache(store);
        setStoreItemKind(store);
        setStoreItemDataType(store);

        if (
          store.feedType !== store.itemKind ||
          store.feedType !== store.itemDataType ||
          store.itemKind !== store.itemDataType
        ) {
          message = `Feed-${store.ingressOrder} mismatched content types:<br>` +
            `&emsp;&emsp;feed type: ${store.feedType}<br>` +
            `&emsp;&emsp;item kind: ${store.itemKind}<br>` +
            `&emsp;&emsp;item data type: ${store.itemDataType}`;
          setLogMessage([message, message.replace('<br>', '\n').replace('&emsp;&emsp;', '\t')], 'warn', true);
        }

        updateLogMessage(messageIdProgress, 'busy', 'done');

        if (
          store.ingressOrder === 1 &&
          storeIngressOrder2.firstPage
        ) {
          try {
            setStoreItems(storeIngressOrder2.firstPage, storeIngressOrder2);
          }
          catch (error) {
            setLogMessage(error.message, 'error', true);
            stop();
            return;
          }
        }
        else {
          sleep(100).then(() => { loadingComplete(); });
        }
      }

    })
    .catch(error => {
      if (retryCount === 0) {
        clearTimeout(loadingTimeout);
        $('#loading-time').hide();
        $('#loading-error-message').text(error.message);
      }
      else if (retryCount === retryCountMax) {
        $('#retry-auto').hide();
        $('#retry-manual').show();
        $('#retry').show();
      }

      if (retryCount < retryCountMax) {
        retryAuto();
      }
      else {
        $('#retryCount').text(retryCount);
        $('#retry').prop('disabled', false);
        $('#progress-indicator').hide();
        inProgress = false;
      }
    });

}

// -------------------------------------------------------------------------------------------------

function retryAuto() {
  retryInterval = setInterval(() => {
    if (retryCount === 0) {
      $('#loading-error').show();
    }
    if (retryCountdown === retryCountdownMax) {
      $('#retryCountAuto').text(retryCount + 1);
    }
    if (retryCountdown > 0) {
      $('#retryCountdown').text(retryCountdown);
      retryCountdown--;
    }
    else {
      clearInterval(retryInterval);
      retryInterval = null;
      retryCountdown = retryCountdownMax;
      retryCount++;
      try {
        setStoreItems();
      }
      catch (error) {
        setLogMessage(error.message, 'error', true);
        stop();
        return;
      }
    }
  }, 1000);
}

// -------------------------------------------------------------------------------------------------

function retry() {
  $('#retry').prop('disabled', true);
  retryCount++;
  inProgress = true;
  $('#progress-indicator').show();
  try {
    setStoreItems();
  }
  catch (error) {
    setLogMessage(error.message, 'error', true);
    stop();
    return;
  }
}

// -------------------------------------------------------------------------------------------------

function setUrl(urlOriginal, store) {
  let url;
  let urlSearchCounter = 0;
  let urlSearchComplete = false;

  while (!urlSearchComplete) {
    if (urlSearchCounter === 0) {
      url = urlOriginal;
    }
    else if (urlSearchCounter === 1) {
      url = decodeURIComponent(urlOriginal);
    }
    else if (urlSearchCounter === 2) {
      // e.g. 'https://reports.gomammoth.co.uk/api/OpenData/Leagues?afterTimestamp=0'
      // Next URLs are like '/api/OpenData/Leagues?afterTimestamp=3879824531'
      url = store.firstPageOrigin + urlOriginal;
    }
    else if (urlSearchCounter === 3) {
      // e.g. 'https://www.goodgym.org/api/happenings'
      // Next URLs are like '%2Fapi%2Fhappenings%3FafterTimestamp%3D2015-01-13+16%3A56%3A14+%2B0000%26afterID%3D28'
      url = store.firstPageOrigin + decodeURIComponent(urlOriginal);
    }
    else {
      urlSearchComplete = true;
    }

    if (!urlSearchComplete) {
      let urlObj = setUrlObj(url);
      if (urlObj) {
        // if (urlSearchCounter > 0) {
        //   console.warn(`Invalid URL: ${urlOriginal}\nValid modified URL: ${url}`)
        // }
        if (urlOriginal === store.firstPage) {
          store.firstPageOrigin = urlObj.origin;
        }
        urlSearchComplete = true;
        return url;
      }
      urlSearchCounter++;
    }
  }

  return null;
}

// -------------------------------------------------------------------------------------------------

function setUrlObj(url) {
  try {
    urlObj = new URL(url);
    return urlObj;
  }
  catch {
    return null;
  }
}

// -------------------------------------------------------------------------------------------------

// Amended to handle embedded / nested superevents
function resolveProperty(item, prop) {
  return item.data && (
    (item.data.superEvent && item.data.superEvent[prop]) ||
    (item.data.superEvent && item.data.superEvent.superEvent && item.data.superEvent.superEvent[prop]) ||
    (item.data.instanceOfCourse && item.data.instanceOfCourse[prop]) ||
    (item.data.facilityUse && item.data.facilityUse[prop]) ||
    item.data[prop]
  );
}

// -------------------------------------------------------------------------------------------------

function resolveDate(item, prop) {
  return item.data &&
    (item.data[prop] || (item.data.superEvent && item.data.superEvent.eventSchedule && item.data.superEvent.eventSchedule[prop]));
}

// -------------------------------------------------------------------------------------------------

async function setStoreIngressOrder1FirstPage() {
  // console.warn(`${luxon.DateTime.now()} setStoreIngressOrder1FirstPage`);
  let messageIdCurrent = setLogMessage(`Feed-1 URL: <span id='storeIngressOrder1FirstPage'>${progressIndicator}</span>`, 'busy');

  if (storeIngressOrder1FirstPageFromUser) {
    await axios.get(storeIngressOrder1FirstPageFromUser.includes('localhost') ? storeIngressOrder1FirstPageFromUser : `/fetch?url=${encodeURIComponent(storeIngressOrder1FirstPageFromUser)}`)
      .then(response => {
        storeIngressOrder1.firstPage = (response.status === 200) ? storeIngressOrder1FirstPageFromUser : null;
      })
      .catch(error => {
        setLogMessage(`Error from user URL: ${error.message}`, 'error', true);
      });
  }
  else {
    storeIngressOrder1.firstPage = $('#endpoint').val();
  }

  $(`#storeIngressOrder1FirstPage`).empty();
  $(`#storeIngressOrder1FirstPage`).append(storeIngressOrder1.firstPage ? `<a href='${storeIngressOrder1.firstPage}' target='_blank'>${storeIngressOrder1.firstPage}</a>` : 'None');
  updateLogMessage(messageIdCurrent, 'busy', storeIngressOrder1.firstPage ? 'done' : 'warn');
}

// -------------------------------------------------------------------------------------------------

async function setStoreIngressOrder2FirstPage() {
  // console.warn(`${luxon.DateTime.now()} setStoreIngressOrder2FirstPage`);
  let messageIdCurrent = setLogMessage(`Feed-2 URL: <span id='storeIngressOrder2FirstPage'>${progressIndicator}</span>`, 'busy');

  if (superEventContentTypesSeries.includes(storeIngressOrder1.feedType)) {
    await setStoreIngressOrder2FirstPageHelper(seriesUrlParts, sessionUrlParts);
  }
  else if (subEventContentTypesSession.includes(storeIngressOrder1.feedType)) {
    await setStoreIngressOrder2FirstPageHelper(sessionUrlParts, seriesUrlParts);
  }
  else if (superEventContentTypesFacility.includes(storeIngressOrder1.feedType)) {
    await setStoreIngressOrder2FirstPageHelper(facilityUrlParts, slotUrlParts);
  }
  else if (subEventContentTypesSlot.includes(storeIngressOrder1.feedType)) {
    await setStoreIngressOrder2FirstPageHelper(slotUrlParts, facilityUrlParts);
  }
  else {
    storeIngressOrder2.firstPage = null;
  }

  $(`#storeIngressOrder2FirstPage`).empty();
  $(`#storeIngressOrder2FirstPage`).append(storeIngressOrder2.firstPage ? `<a href='${storeIngressOrder2.firstPage}' target='_blank'>${storeIngressOrder2.firstPage}</a>` : 'None');
  updateLogMessage(messageIdCurrent, 'busy', storeIngressOrder2.firstPage ? 'done' : 'warn');
}

// -------------------------------------------------------------------------------------------------

async function setStoreIngressOrder2FirstPageHelper(feedType1UrlParts, feedType2UrlParts) {
  // console.warn(`${luxon.DateTime.now()} setStoreIngressOrder2FirstPageHelper`);
  for (const feedType1UrlPart of feedType1UrlParts) {
    if (storeIngressOrder1.firstPage.includes(feedType1UrlPart)) {
      for (const feedType2UrlPart of feedType2UrlParts) {
        // If the sets of URL parts have been properly defined, then we should never have a match here. If
        // we did, then without this check we would get the same URL for storeIngressOrder1 and storeIngressOrder2,
        // which would be problematic:
        if (feedType1UrlPart !== feedType2UrlPart) {
          let storeIngressOrder2FirstPage = storeIngressOrder1.firstPage.replace(feedType1UrlPart, feedType2UrlPart);
          if (storeIngressOrder1FirstPageFromUser) {
            // We expect that a number of URL combinations may be made before a success is had, so we don't
            // worry about catching errors here:
            await axios.get(`/fetch?url=${encodeURIComponent(storeIngressOrder2FirstPage)}`)
              .then(response => {
                storeIngressOrder2.firstPage = (response.status === 200) ? storeIngressOrder2FirstPage : null;
              });
            if (storeIngressOrder2.firstPage) {
              return;
            }
          }
          else {
            if (storeIngressOrder2FirstPage in feeds) {
              storeIngressOrder2.firstPage = storeIngressOrder2FirstPage;
              return;
            }
          }
        }
      }
    }
  }
}

// -------------------------------------------------------------------------------------------------

async function setStoreFeedType(store) {
  // console.warn(`${luxon.DateTime.now()} setStoreFeedType`);
  let messageIdCurrent = setLogMessage(`Feed-${store.ingressOrder} type: <span id='storeIngressOrder${store.ingressOrder}FeedType'>${progressIndicator}</span>`, 'busy');

  if (!store.firstPage) {
    store.feedType = null;
  }
  else if (storeIngressOrder1FirstPageFromUser) {
    if (seriesUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'SessionSeries';
    }
    else if (sessionUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'ScheduledSession';
    }
    else if (facilityUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'FacilityUse';
    }
    else if (slotUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'Slot';
    }
    else {
      store.feedType = null;
    }
  }
  else {
    store.feedType = feeds[store.firstPage].type || null;
  }

  $(`#storeIngressOrder${store.ingressOrder}FeedType`).text(store.feedType || 'None');
  updateLogMessage(messageIdCurrent, 'busy', store.feedType ? 'done' : 'warn');
}

// -------------------------------------------------------------------------------------------------

function setStoreItemKind(store) {
  let messageIdCurrent = setLogMessage(`Feed-${store.ingressOrder} item kind: <span id='storeIngressOrder${store.ingressOrder}ItemKind'>${progressIndicator}</span>`, 'busy');

  let itemKinds = Object.values(store.items).map(item => {
    if (typeof item.kind === 'string') {
      return item.kind;
    }
  })
    .filter(itemKind => itemKind);

  let uniqueItemKinds = [...new Set(itemKinds)];

  switch (uniqueItemKinds.length) {
    case 0:
      store.itemKind = null;
      break;
    case 1:
      store.itemKind = uniqueItemKinds[0];
      break;
    default:
      store.itemKind = 'mixed';
      setLogMessage(`Feed-${store.ingressOrder} has mixed item kinds: [${uniqueItemKinds}]`, 'warn', true);
      break;
  }

  $(`#storeIngressOrder${store.ingressOrder}ItemKind`).text(store.itemKind || 'None');
  updateLogMessage(messageIdCurrent, 'busy', store.itemKind ? 'done' : 'warn');
}

// -------------------------------------------------------------------------------------------------

function setStoreItemDataType(store) {
  let messageIdCurrent = setLogMessage(`Feed-${store.ingressOrder} item data type: <span id='storeIngressOrder${store.ingressOrder}ItemDataType'>${progressIndicator}</span>`, 'busy');

  let itemDataTypes = Object.values(store.items).map(item => {
    if (item.data) {
      if (typeof item.data.type === 'string') {
        return item.data.type;
      }
      else if (typeof item.data['@type'] === 'string') {
        return item.data['@type'];
      }
    }
  })
    .filter(itemDataType => itemDataType);

  let uniqueItemDataTypes = [...new Set(itemDataTypes)];

  switch (uniqueItemDataTypes.length) {
    case 0:
      store.itemDataType = null;
      break;
    case 1:
      store.itemDataType = uniqueItemDataTypes[0];
      break;
    default:
      store.itemDataType = 'mixed';
      setLogMessage(`Feed-${store.ingressOrder} has mixed item data types: [${uniqueItemDataTypes}]`, 'warn', true);
      break;
  }

  $(`#storeIngressOrder${store.ingressOrder}ItemDataType`).text(store.itemDataType || 'None');
  updateLogMessage(messageIdCurrent, 'busy', store.itemDataType ? 'done' : 'warn');
}

// -------------------------------------------------------------------------------------------------

function setOrganizers(organizers) {
  organizerListRefresh++;
  let organizerListSelected = $('#organizer-list-selected').val() || '';

  // Note: Removed classes [form-control, ml-1, mr-1] from the button, as they were messing with the button width. No apparent effect on functionality:
  $('#organizer-list-dropdown').empty();
  $('#organizer-list-dropdown').append(
    `<div id="organizer-list-dropdown-${organizerListRefresh}" class="dropdown hierarchy-select">
        <button id="organizer-list-button" type="button" class="btn btn-secondary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        </button>
        <div class="dropdown-menu" aria-labelledby="organizer-list-button">
            <div class="hs-searchbox">
                <input type="text" class="form-control" autocomplete="off">
            </div>
            <div class="hs-menu-inner">
                <a class="dropdown-item" data-value="" data-level="1" data-default-selected="" href="#">Show All</a>
            </div>
        </div>
        <input id="organizer-list-selected" name="organizer-list-selected" readonly="readonly" aria-hidden="true" type="hidden"/>
    </div>`);
  $('#organizer-list-selected').val(organizerListSelected);

  // Render the organizer list in a format HierarchySelect will understand:
  $(`#organizer-list-dropdown-${organizerListRefresh} .hs-menu-inner`).append(
    Object.keys(organizers).map(organizerName =>
      $('<a/>', {
        'class': 'dropdown-item',
        'data-value': organizerName,
        'data-level': 1,
        'href': '#',
        'text': organizerName
      })
    )
  );

  $(`#organizer-list-dropdown-${organizerListRefresh}`).hierarchySelect({
    width: '100%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#organizer-list-selected').val() is set automatically by HierarchySelect upon selection
    // Note that $('#organizer-list-selected').val() is the same as htmlDataValue
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#organizer-list-button").addClass("selected");
      }
      if (htmlDataValue !== organizerListSelected) {
        console.warn(`Selected organizer for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

function setLocations(locations) {
  locationListRefresh++;
  let locationListSelected = $('#location-list-selected').val() || '';

  // Note: Removed classes [form-control, ml-1, mr-1] from the button, as they were messing with the button width. No apparent effect on functionality:
  $('#location-list-dropdown').empty();
  $('#location-list-dropdown').append(
    `<div id="location-list-dropdown-${locationListRefresh}" class="dropdown hierarchy-select">
          <button id="location-list-button" type="button" class="btn btn-secondary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          </button>
          <div class="dropdown-menu" aria-labelledby="location-list-button">
              <div class="hs-searchbox">
                  <input type="text" class="form-control" autocomplete="off">
              </div>
              <div class="hs-menu-inner">
                  <a class="dropdown-item" data-value="" data-level="1" data-default-selected="" href="#">Show All</a>
              </div>
          </div>
          <input id="location-list-selected" name="location-list-selected" readonly="readonly" aria-hidden="true" type="hidden"/>
      </div>`);
  $('#location-list-selected').val(locationListSelected);

  // Render the location list in a format HierarchySelect will understand:
  $(`#location-list-dropdown-${locationListRefresh} .hs-menu-inner`).append(
    Object.keys(locations).map(locationName =>
      $('<a/>', {
        'class': 'dropdown-item',
        'data-value': locationName,
        'data-level': 1,
        'href': '#',
        'text': locationName
      })
    )
  );

  $(`#location-list-dropdown-${locationListRefresh}`).hierarchySelect({
    width: '100%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#location-list-selected').val() is set automatically by HierarchySelect upon selection
    // Note that $('#location-list-selected').val() is the same as htmlDataValue
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#location-list-button").addClass("selected");
      }
      if (htmlDataValue !== locationListSelected) {
        console.warn(`Selected location for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

function setActivities(activities) {
  activityListRefresh++;
  let activityListSelected = $('#activity-list-selected').val() || '';

  // Note: Removed classes [form-control, ml-1, mr-1] from the button, as they were messing with the button width. No apparent effect on functionality:
  $('#activity-list-dropdown').empty();
  $('#activity-list-dropdown').append(
    `<div id="activity-list-dropdown-${activityListRefresh}" class="dropdown hierarchy-select">
        <button id="activity-list-button" type="button" class="btn btn-secondary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        </button>
        <div class="dropdown-menu" aria-labelledby="activity-list-button">
            <div class="hs-searchbox">
                <input type="text" class="form-control" autocomplete="off">
            </div>
            <div class="hs-menu-inner">
                <a class="dropdown-item" data-value="" data-level="1" data-default-selected="" href="#">Show All</a>
            </div>
        </div>
        <input id="activity-list-selected" name="activity-list-selected" readonly="readonly" aria-hidden="true" type="hidden"/>
    </div>`);
  $('#activity-list-selected').val(activityListSelected);

  // Render the activity list in a format HierarchySelect will understand:
  $(`#activity-list-dropdown-${activityListRefresh} .hs-menu-inner`).append(renderTree(activities.getTopConcepts(), 1, []));

  $(`#activity-list-dropdown-${activityListRefresh}`).hierarchySelect({
    width: '100%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#activity-list-selected').val() is set automatically by HierarchySelect upon selection
    // Note that $('#activity-list-selected').val() is the same as htmlDataValue
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#activity-list-button").addClass("selected");
      }
      if (htmlDataValue !== activityListSelected) {
        console.warn(`Selected activity for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

// The hierarchy code is based on https://neofusion.github.io/hierarchy-select/
// Using source files:
// - https://neofusion.github.io/hierarchy-select/v2/dist/hierarchy-select.min.js
// - https://neofusion.github.io/hierarchy-select/v2/dist/hierarchy-select.min.css
// - https://www.openactive.io/skos.js/dist/skos.min.js

function renderTree(concepts, level, output) {
  // Recursively .getNarrower() on concepts
  concepts.forEach(function (concept) {
    let label = concept.prefLabel;
    let hidden = '';
    // Include altLabels (e.g. Group Cycling) to make them visible to the user
    if (concept.altLabel && concept.altLabel.length > 0) {
      label = label + ' / ' + concept.altLabel.join(' / ')
    }
    // Include hiddenLabels (e.g. 5aside) as hidden so they will still match search terms
    if (concept.hiddenLabel && concept.hiddenLabel.length > 0) {
      hidden = concept.hiddenLabel.join(' / ')
    }

    // Use jQuery to escape all values when outputting HTML
    output.push($('<a/>', {
      'class': 'dropdown-item',
      'data-value': concept.id,
      'data-level': level,
      'data-hidden': hidden,
      'href': '#',
      'text': label
    }));

    let narrower = concept.getNarrower();
    if (narrower) {
      renderTree(narrower, level + 1, output);
    }
  });
  return output;
}

// -------------------------------------------------------------------------------------------------

// function renderSchedule(item) {
//   if (item.data && item.data.eventSchedule && Array.isArray(item.data.eventSchedule)) {
//     return item.data.eventSchedule.filter(x => Array.isArray(x.byDay)).flatMap(x => x.byDay.map(day => `${day.replace(/https?:\/\/schema.org\//, '')} ${x.startTime}`)).join(', ');
//   } else {
//     return '';
//   }
// }

// -------------------------------------------------------------------------------------------------

function getRelevantActivitySet(id) {
  let concept = scheme_1.getConceptByID(id);
  if (concept) {
    return new Set([id].concat(concept.getNarrowerTransitive().map(concept => concept.id)));
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function setJSONTab(itemId, item, switchTab) {

  if (switchTab) {
    $("#resultTab").removeClass("active");
    $("#resultPanel").removeClass("active");
    $("#jsonTab").addClass("active");
    $("#jsonPanel").addClass("active");
    // updateScrollResults();
  }

  document.getElementById('json').innerHTML = "<div id='json-tab-1' class='json-tab-subpanel'></div><div id='json-tab-2' class='json-tab-subpanel'></div>";

  if (
    showingSample &&
    item
  ) {
    setJSONTabSubPanel(1, item, null);
  }
  else if (
    storeSuperEvent &&
    storeSubEvent &&
    link &&
    storeSubEvent.items.hasOwnProperty(itemId)
  ) {
    const storeSubEventItemId = itemId;
    const storeSubEventItem = storeSubEvent.items[storeSubEventItemId];
    const storeSuperEventItemId = String(storeSubEventItem.data[link]).split('/').at(-1);
    const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem =>
      String(storeSuperEventItem.id).split('/').at(-1) === storeSuperEventItemId ||
      String(storeSuperEventItem.data.id).split('/').at(-1) === storeSuperEventItemId || // BwD facilityUse/slot
      String(storeSuperEventItem.data['@id']).split('/').at(-1) === storeSuperEventItemId
    );
    if (storeSuperEventItem) {
      setJSONTabSubPanel(1, storeSuperEventItem, storeSuperEvent?.urls?.[storeSuperEventItemId]);
    }
    if (storeSubEventItem) {
      setJSONTabSubPanel(2, storeSubEventItem, storeSubEvent?.urls?.[storeSubEventItemId]);
    }
  }
  else if (
    storeIngressOrder1 &&
    storeIngressOrder1.items.hasOwnProperty(itemId)
  ) {
    setJSONTabSubPanel(1, storeIngressOrder1.items[itemId], storeIngressOrder1?.urls?.[itemId]);
  }
  else if (
    storeIngressOrder2 &&
    storeIngressOrder2.items.hasOwnProperty(itemId)
  ) {
    setJSONTabSubPanel(1, storeIngressOrder2.items[itemId], storeIngressOrder2?.urls?.[itemId]);
  }

}

// -------------------------------------------------------------------------------------------------

function setJSONTabSubPanel(subPanelNumber, item, url) {
  document.getElementById(`json-tab-${subPanelNumber}`).innerHTML = `
    <div class='flex_row'>
        <h2 class='json-tab-heading'>${item?.data?.type || item?.kind || 'Unknown content type'}</h2>
        <button id='json-tab-${subPanelNumber}-source' class='btn btn-secondary btn-sm json-tab-button'>Source</button>
        <button id='json-tab-${subPanelNumber}-validate' class='btn btn-secondary btn-sm json-tab-button'>Validate</button>
    </div>
    <pre>${JSON.stringify(item, null, 2)}</pre>`;
  if (url) {
    $(`#json-tab-${subPanelNumber}-source`).on('click', function () {
      window.open(url, '_blank').focus();
    });
  }
  else {
    $(`#json-tab-${subPanelNumber}-source`).hide();
  }
  $(`#json-tab-${subPanelNumber}-validate`).on('click', function () {
    openValidator(item);
  });
}

// -------------------------------------------------------------------------------------------------

function openValidator(item) {
  const jsonString = JSON.stringify(item.data, null, 2);
  const url = `https://validator.openactive.io/#/json/${Base64.encodeURI(jsonString)}`;
  const win = window.open(url, "_blank", "height=800,width=1200");
  win.focus();
}

// -------------------------------------------------------------------------------------------------

function addResultsPanel() {
  let panel = $("#results");
  panel.append(
    '<div class="row">' +
    '   <div class="col-md-1 col-sm-2 text-truncate">ID</div>' +
    '   <div class="col text-truncate">Name</div>' +
    '   <div class="col text-truncate">Activity</div>' +
    '   <div class="col text-truncate">Start</div>' +
    '   <div class="col text-truncate">End</div>' +
    '   <div class="col text-truncate">Location</div>' +
    '   <div class="col text-truncate">&nbsp;</div>' +
    '</div>'
  );
}

// -------------------------------------------------------------------------------------------------

function addApiPanel(text, storeIngressOrder, isHeading=false) {
  let panel = $('#api');
  if (isHeading) {
    panel.append(
      `<div class='api' style='background-color: ${(storeIngressOrder === 1) ? storeIngressOrder1ApiColor : storeIngressOrder2ApiColor}; color: white; text-align: center;'><h4 style='margin: 0;'>${text}</h4></div>`
    );
  }
  else {
    panel.append(
      `<div class='api' style='background-color: ${(storeIngressOrder === 1) ? storeIngressOrder1ApiColor : storeIngressOrder2ApiColor};'>` +
      `   <a href=${text} target='_blank' class='text-wrap' style='word-wrap: break-word; color: white;'>${text}</a>` +
      `</div>`
    );
  }
}

// -------------------------------------------------------------------------------------------------

function addOrganizerPanel(organizers) {
  let panel = $("#organizer");
  panel.append(
    '<div class="row">' +
    '   <div class="col text-truncate">Name</div>' +
    '   <div class="col text-truncate">URL</div>' +
    '   <div class="col text-truncate">Email</div>' +
    '   <div class="col text-truncate">Phone</div>' +
    '</div>'
  );
  for (const [organizerName, organizerInfo] of Object.entries(organizers)) {
    panel.append(
      `<div class='row rowhover'>` +
      `   <div class='col text-truncate'>${organizerName}</div>` +
      `   <div class='col text-truncate'>${organizerInfo.url.length > 1 ? '[' : ''}${organizerInfo.url.map(x => `<a href='${x}' target='_blank'>${x}</a>`).join(', ')}${organizerInfo.url.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${organizerInfo.email.length > 1 ? '[' : ''}${organizerInfo.email.map(x => `<a href='mailto:${x}' target='_blank'>${x}</a>`).join(', ')}${organizerInfo.email.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${organizerInfo.telephone.length > 1 ? '[' : ''}${organizerInfo.telephone.join(', ')}${organizerInfo.telephone.length > 1 ? ']' : ''}</div>` +
      `</div>`
    );
  }
}

// -------------------------------------------------------------------------------------------------

function addLocationPanel(locations) {
  let panel = $("#location");
  panel.append(
    '<div class="row">' +
    '   <div class="col text-truncate">Name</div>' +
    '   <div class="col text-truncate">URL</div>' +
    '   <div class="col text-truncate">Email</div>' +
    '   <div class="col text-truncate">Phone</div>' +
    '   <div class="col text-truncate">Address</div>' +
    '   <div class="col text-truncate">PostCode</div>' +
    '   <div class="col text-truncate">Coords</div>' +
    '</div>'
  );
  for (const [locationName, locationInfo] of Object.entries(locations)) {
    panel.append(
      `<div class='row rowhover'>` +
      `   <div class='col text-truncate'>${locationName}</div>` +
      `   <div class='col text-truncate'>${locationInfo.url.length > 1 ? '[' : ''}${locationInfo.url.map(x => `<a href='${x}' target='_blank'>${x}</a>`).join(', ')}${locationInfo.url.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${locationInfo.email.length > 1 ? '[' : ''}${locationInfo.email.map(x => `<a href='mailto:${x}' target='_blank'>${x}</a>`).join(', ')}${locationInfo.email.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${locationInfo.telephone.length > 1 ? '[' : ''}${locationInfo.telephone.join(', ')}${locationInfo.telephone.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${locationInfo.streetAddress.length > 1 ? '[' : ''}${locationInfo.streetAddress.join(', ')}${locationInfo.streetAddress.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${locationInfo.postalCode.length > 1 ? '[' : ''}${locationInfo.postalCode.join(', ')}${locationInfo.postalCode.length > 1 ? ']' : ''}</div>` +
      `   <div class='col text-truncate'>${locationInfo.coordinates.length > 1 ? '[' : ''}${locationInfo.coordinates.map(x => `[${x.map(y => y.toFixed(6)).join(', ')}]`).join(', ')}${locationInfo.coordinates.length > 1 ? ']' : ''}</div>` +
      `</div>`
    );
  }
}

// -------------------------------------------------------------------------------------------------

function addMapPanel(locations) {
  // Read the Tile Usage Policy of OpenStreetMap (https://operations.osmfoundation.org/policies/tiles/) if you’re going to use the tiles in production
  // HA - We are following guidance but should keep an eye on usage / demand on server

  if (map) {
    map.off();
    map.remove();
  }

  map = L.map('map', {
    maxZoom: 17,
    zoomSnap: 0.1,
    scrollWheelZoom: false,
    attributionControl: false,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> - <a href="https://www.openstreetmap.org/fixthemap">Improve this map <a/>'
  }).addTo(map);

  L.control.attribution({
    position: 'topright'
  }).addTo(map);

  for (const [locationName, locationInfo] of Object.entries(locations)) {
    for (const coordinates of locationInfo.coordinates) {
      const marker = L.marker(coordinates).addTo(map);

      marker.bindPopup(
        `<b>${locationName}</b><br>` +
        `<table>` +
        `  <tr>` +
        `    <td>URL:</td>` +
        `    <td>${locationInfo.url.length > 1 ? '[' : ''}${locationInfo.url.map(x => `<a href='${x}' target='_blank'>${x}</a>`).join(', ')}${locationInfo.url.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `  <tr>` +
        `    <td>Email:</td>` +
        `    <td>${locationInfo.email.length > 1 ? '[' : ''}${locationInfo.email.map(x => `<a href='mailto:${x}' target='_blank'>${x}</a>`).join(', ')}${locationInfo.email.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `  <tr>` +
        `    <td>Phone:</td>` +
        `    <td>${locationInfo.telephone.length > 1 ? '[' : ''}${locationInfo.telephone.join(', ')}${locationInfo.telephone.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `  <tr>` +
        `    <td>Address:</td>` +
        `    <td>${locationInfo.streetAddress.length > 1 ? '[' : ''}${locationInfo.streetAddress.join(', ')}${locationInfo.streetAddress.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `  <tr>` +
        `    <td>PostCode:</td>` +
        `    <td>${locationInfo.postalCode.length > 1 ? '[' : ''}${locationInfo.postalCode.join(', ')}${locationInfo.postalCode.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `  <tr>` +
        `    <td>Coords:</td>` +
        `    <td>${locationInfo.coordinates.length > 1 ? '[' : ''}${locationInfo.coordinates.map(x => `[${x.map(y => y.toFixed(6)).join(', ')}]`).join(', ')}${locationInfo.coordinates.length > 1 ? ']' : ''}</td>` +
        `  </tr>` +
        `</table>`);
    }
  }

}

// -------------------------------------------------------------------------------------------------

// Handle nav tabs smooth to fill page

// $('#resultsTab').on('click', function () {
//   updateScrollResults();
// });
//
// $('#jsonTab').on('click', function () {
//   updateScrollResults();
// });
//
// $('#apiTab').on('click', function () {
//   updateScrollResults();
// });
//
// $('#organizerTab').on('click', function () {
//   updateScrollResults();
// });
//
// $('#locationTab').on('click', function () {
//   updateScrollResults();
// });

// As well as the live code below, these variants also work:
//   $('body').on('click', '#mapTab', function() {
//   $('body').on('show.bs.tab', '#mapTab', function() {
//   $('#mapTab').on('click', function () {
// See here for details:
// - https://getbootstrap.com/docs/5.0/components/navs-tabs/
$('#mapTab').on('show.bs.tab', function () {
  L.Util.requestAnimFrame(map.invalidateSize, map, !1, map._container);

  // Calculate the bounds for the marker layer
  var markerBounds = L.latLngBounds();
  for (const locationInfo of Object.values(storeDataQuality.filteredItemsUniqueLocations)) {
    for (const coordinates of locationInfo.coordinates) {
      markerBounds.extend(coordinates);
    }
  }

  // Zoom and pan the map to fit the marker bounds
  setTimeout(function () {
    map.fitBounds(markerBounds, { padding: [50, 50] });
  }, 100); // Delay the fitBounds to ensure markers plotted

  // updateScrollResults();
});

// -------------------------------------------------------------------------------------------------

function updateScroll() {
  const element = document.getElementById('log');
  element.scrollTop = element.scrollHeight;
}

// -------------------------------------------------------------------------------------------------

// DT: Not sure if we need this now, disabled as was giving scroll behaviour that may not be so
// desirable for all users.

// function updateScrollResults() {
//   window.scrollTo({
//     top: 480,
//     behavior: 'smooth' // You can change this to 'auto' for instant scrolling
//   });
// }

// -------------------------------------------------------------------------------------------------

const getUrlParameter = function getUrlParameter(sParam) {
  let sPageURL = window.location.search.substring(1),
    sURLVariables = sPageURL.split('&'),
    sParameterName,
    i;
  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
    }
  }
};

// -------------------------------------------------------------------------------------------------

function updateURLParameter(url, param, paramVal) {
  let TheAnchor;
  let newAdditionalURL = "";
  let tempArray = url.split("?");
  let baseURL = tempArray[0];
  let additionalURL = tempArray[1];
  let temp = "";

  if (additionalURL) {
    let tmpAnchor = additionalURL.split("#");
    let TheParams = tmpAnchor[0];
    TheAnchor = tmpAnchor[1];
    if (TheAnchor)
      additionalURL = TheParams;
    tempArray = additionalURL.split("&");
    for (let i = 0; i < tempArray.length; i++) {
      if (tempArray[i].split('=')[0] !== param) {
        newAdditionalURL += temp + tempArray[i];
        temp = "&";
      }
    }
  }
  else {
    let tmpAnchor = baseURL.split("#");
    let TheParams = tmpAnchor[0];
    TheAnchor = tmpAnchor[1];
    if (TheParams)
      baseURL = TheParams;
  }

  if (TheAnchor)
    paramVal += "#" + TheAnchor;

  const rows_txt = temp + "" + param + "=" + paramVal;
  return baseURL + "?" + newAdditionalURL + rows_txt;
}

// -------------------------------------------------------------------------------------------------

// noinspection SpellCheckingInspection
function updateParameters(parm, parmVal) {
  window.history.replaceState('', '', updateURLParameter(window.location.href, parm, parmVal));
}

// -------------------------------------------------------------------------------------------------

// function updateProvider() {
//   provider = $('#provider option:selected').val();
//   clearDisplay();
//   // Replicating setEndpoints, without the page reset
//   $.getJSON('/feeds', function (data) {
//     $('#endpoint').empty();
//     $.each(data.feeds, function (index, feed) {
//       if (feed.publisherName === provider) {
//         $('#endpoint').append(`<option value='${feed.url}'>${feed.type}</option>`);
//       }
//     });
//   })
//   .done(function () {
//     endpoint = $('#endpoint').val();
//     updateEndpoint();
//   });
// }

// -------------------------------------------------------------------------------------------------

// function updateEndpoint() {
//
//   clearDisplay();
//   clearFilters();
//
//   provider = $("#provider option:selected").text();
//   endpoint = $("#endpoint").val();
//
//   console.log('endpoint 1' + endpoint)
//
//   updateParameters("endpoint", endpoint);
//   clearForm(endpoint);
//
//   if (endpoint === "") {
//     $("#execute").prop('disabled', 'disabled');
//   }
//   else {
//     $("#execute").prop('disabled', false);
//   }
//
//   $("#user-url").val(endpoint);
//
// }

// -------------------------------------------------------------------------------------------------

//function updateEndpointUpdate() {
//  if (endpoint !== "") {
//    $("#execute").prop('disabled', false);
//  }
//  if (endpoint === "") {
//    $("#execute").prop('disabled', 'disabled');
//  }
//}

// -------------------------------------------------------------------------------------------------


function updateDQ_filterActivities() {
  filters.DQ_filterActivities = $("#DQ_filterActivities").prop("checked");
  postDataQuality();
}

// -------------------------------------------------------------------------------------------------

function updateDQ_filterGeos() {
  filters.DQ_filterGeos = $("#DQ_filterGeos").prop("checked");
  postDataQuality();
}

// -------------------------------------------------------------------------------------------------

function updateDQ_filterDates() {
  filters.DQ_filterDates = $("#DQ_filterDates").prop("checked");
  postDataQuality();
}

// -------------------------------------------------------------------------------------------------

function updateDQ_filterUrls() {
  filters.DQ_filterUrls = $("#DQ_filterUrls").prop("checked");
  postDataQuality();
}

// -------------------------------------------------------------------------------------------------

function updateCoverage() {
  coverage = $("#Coverage").val();
  updateParameters("coverage", coverage);
}

// -------------------------------------------------------------------------------------------------

function updateProximity() {
  proximity = $("#Proximity").val();
  updateParameters("proximity", proximity);
}

// -------------------------------------------------------------------------------------------------

function updateDay() {
  day = $("#Day").val();
  updateParameters("day", day);
}

// -------------------------------------------------------------------------------------------------

function updateStartTime() {
  startTime = $("#StartTime").val();
  updateParameters("startTime", startTime);
}

// -------------------------------------------------------------------------------------------------

function updateEndTime() {
  endTime = $("#EndTime").val();
  updateParameters("endTime", endTime);
}

// -------------------------------------------------------------------------------------------------

function updateMinAge() {
  minAge = $("#minAge").val();
  updateParameters("minAge", minAge);
}

// -------------------------------------------------------------------------------------------------

function updateMaxAge() {
  maxAge = $("#maxAge").val();
  updateParameters("maxAge", maxAge);
}

// -------------------------------------------------------------------------------------------------

function updateKeywords() {
  keywords = $("#Keywords").val();
  updateParameters("keywords", keywords);
}

// -------------------------------------------------------------------------------------------------

function getSummary() {
  // Make a GET request to retrieve the sum values from the server
  $.getJSON('/sum', function (response) {
    //console.log(`numParent: ${response.sum1}`);
    //console.log(`numChild: ${response.sum2}`);
    //console.log(`DQ_validActivity: ${response.sum3}`);
    summary = response;
  })
    .fail(function (error) {
      console.error('Error retrieving sum values:', error);
    });
}

// -------------------------------------------------------------------------------------------------

function setPage() {
  // console.warn(`${luxon.DateTime.now()} setPage: start`);

  $("#provider").on("change", function () {
    // console.warn(`${luxon.DateTime.now()} change #provider`);
    setEndpoints();
  })
  $("#endpoint").on("change", function () {
    // console.warn(`${luxon.DateTime.now()} change #endpoint`);
    // updateEndpoint();
    setEndpoint();
  });
  $("#user-url").on("change", function () {
    // console.warn(`${luxon.DateTime.now()} change #user-url`);
    storeIngressOrder1FirstPageFromUser = !($("#user-url").val().trim() in feeds) ? $("#user-url").val().trim() : null;
    // if (storeIngressOrder1FirstPageFromUser) {
    //   updateUserUrl();
    // }
    // else if (!$('#endpoint').val()) {
    //   setProviders();
    // }
    setEndpoint();
  });

  $("#execute").on("click", function () {
    execute();
    // Useful for toggling hidden element visibility when testing:
    // let element = 'loading-error';
    // if ($(`#${element}`).is(':visible')) {$(`#${element}`).hide();} else {$(`#${element}`).show();}
  });
  $("#clear").on("click", function () {
    clear();
    // Useful for toggling hidden element visibility when testing:
    // let element = 'retry';
    // if ($(`#${element}`).is(':visible')) {$(`#${element}`).hide();} else {$(`#${element}`).show();}
  });
  $('#retry').on('click', function () {
    retry();
  });

  $("#DQ_filterActivities").on("change", function () {
    updateDQ_filterActivities();
  });
  $("#DQ_filterGeos").on("change", function () {
    updateDQ_filterGeos();
  });
  $("#DQ_filterDates").on("change", function () {
    updateDQ_filterDates();
  });
  $("#DQ_filterUrls").on("change", function () {
    updateDQ_filterUrls();
  });

  $("#Coverage").on("change", function () {
    updateCoverage();
  });
  $("#Proximity").on("change", function () {
    updateProximity();
  });
  $("#Day").on("change", function () {
    updateDay();
  });
  $("#StartTime").on("change", function () {
    updateStartTime();
  });
  $("#EndTime").on("change", function () {
    updateEndTime();
  });
  $("#minAge").on("change", function () {
    updateMinAge();
  });
  $("#maxAge").on("change", function () {
    updateMaxAge();
  });
  $("#Keywords").on("change", function () {
    updateKeywords();
  });

  // if (getUrlParameter("endpoint") !== undefined) {
  //   $("#endpoint").val(getUrlParameter("endpoint"));
  //   $.getJSON("/feeds", function (data) {
  //     $.each(data.feeds, function (index, feed) {
  //       if (feed.url === $("#endpoint option:selected").val()) {
  //         // config = feed; //Config was used in OpenReferral - but not now?
  //       }
  //     });
  //   })
  //     .done(function () {
  //       if (($('#endpoint').val() || $('#user-url').val()) !== '') {
  //         $("#execute").prop('disabled', false);
  //       }
  //       else {
  //         $("#Vocabulary").prop('disabled', true);
  //         $("#TaxonomyTerm").prop('disabled', true);
  //         $("#execute").prop('disabled', false);
  //       }
  //       if (getUrlParameter("execute") === 'true' && inProgress !== true) {
  //         runForm();
  //       }
  //     });
  // }
  // else {
  //   //updateParameters("endpoint", $("#endpoint").val());
  //   //setEndpoints();
  // }

  // console.warn(`${luxon.DateTime.now()} setPage: end`);
}

// -------------------------------------------------------------------------------------------------

function setFeeds() {
  // console.warn(`${luxon.DateTime.now()} setFeeds: start`);
  $.getJSON('/feeds', function (data) {
    $.each(data.feeds, function (index, feed) {
      feeds[feed.url] = feed;
    });
  })
    .done(function () {
      // console.warn(`${luxon.DateTime.now()} setFeeds: end`);
      publisherNames = [...new Set(Object.values(feeds).map(feed => feed.publisherName))];
      urlTriggered = (getUrlParameter('endpoint') !== '') && (getUrlParameter('endpoint') in feeds);
      executeTriggered = getUrlParameter('execute') === 'true';
      setProviders();
    });
}

// -------------------------------------------------------------------------------------------------

function setProviders(dqTriggered=false) {
  // console.warn(`${luxon.DateTime.now()} setProviders: start`);
  $.getJSON('/api/get-dqsummaries', function (dqsummaries) {
    $('#provider').empty();

    const publisherSums = publisherNames.map(publisherName => {
      let publisherSumParentChild = 0;
      dqsummaries.forEach(dqsummary => {
        const feedUrl = dqsummary.id.split(' ')[0];
        if (
          feedUrl in feeds && // The database may contain publishers from previous runs that aren't in the current /feeds, so only use those that are
          ( publisherName === 'All OpenActive Feeds' ||
            publisherName === feeds[feedUrl].publisherName )
        ) {
          publisherSumParentChild += dqsummary.numparent + dqsummary.numchild;
        }
      });
      return { name: publisherName, sum: publisherSumParentChild };
    });

    // Sort publishers by descending sum, then alphabetically
    publisherSums.sort((a, b) => {
      if (b.sum === a.sum) {
        return a.name.localeCompare(b.name);
      }
      else {
        return b.sum - a.sum;
      }
      // return a.name.localeCompare(b.name);
    });

    // Output the sorted publishers to HTML
    publisherSums.forEach(publisherSum => {
      // Round the publisherSums
      const publisherSumRounded = Math.round(publisherSum.sum / 100) * 100;
      const publisherSumFormatted = publisherSumRounded.toLocaleString() + (publisherSumRounded !== 0 ? '+' : '');
      $('#provider').append(`<option value="${publisherSum.name}">${publisherSum.name} (${publisherSumFormatted})</option>`);
    });
  })
    .done(function () {
      // console.warn(`${luxon.DateTime.now()} setProviders: end`);
      if (
        getUrlParameter('endpoint') !== 'null' &&
        (dqTriggered || urlTriggered)
      ) {
        $('#provider').val(feeds[getUrlParameter('endpoint')].publisherName);
      }
      if (!dqTriggered) {
        setEndpoints();
      }
    });
}

// -------------------------------------------------------------------------------------------------

function setEndpoints() {
  //console.warn(`${luxon.DateTime.now()} setEndpoints: start`);
  $('#endpoint').empty();
  Object.values(feeds).forEach(feed => {
    if (feed.publisherName === $('#provider option:selected').val()) {
      $('#endpoint').append(`<option value='${feed.url}'>${feed.type}</option>`);
    }
  });
  // console.warn(`${luxon.DateTime.now()} setEndpoints: end`);
  // updateEndpoint();
  setEndpoint();
}

// -------------------------------------------------------------------------------------------------

function setEndpoint() {

  if (urlTriggered) {
    urlTriggered = false;
    endpoint = getUrlParameter('endpoint');
    $('#endpoint').val(endpoint);
    $('#user-url').val(endpoint);
    clear();
    if (executeTriggered) {
      executeTriggered = false;
      execute();
    }
    return;
  }

  // console.warn(`${luxon.DateTime.now()} setEndpoint: start`);
  endpoint = undefined;

  if (storeIngressOrder1FirstPageFromUser) {
    endpoint = storeIngressOrder1FirstPageFromUser;
    $('#provider').empty();
    $('#endpoint').empty();
  }
  else if ($('#provider').val() === 'All OpenActive Feeds') {
    endpoint = null;
  }
  else if ($('#endpoint').val()) {
    endpoint = $('#endpoint').val();
  }

  if (endpoint !== undefined) {
    $('#user-url').val(endpoint);
    if (getUrlParameter('execute') === 'true') {
      execute();
    }
    else {
      updateParameters('endpoint', endpoint);
      clear();
    }
  }
  else {
    // We don't have a user-URL or a menu-URL if we previously had a user-URL (which removed the menu-URLS)
    // that was then removed itself i.e. completely deleted, or changed into one of the menu-URLs which
    // are regarded as invalid user-URLs. In this case, we need to reset the provider and endpoint menus,
    // which will then re-trigger this function too:
    setProviders();
  }
  // console.warn(`${luxon.DateTime.now()} setEndpoint: end`);
}

// -------------------------------------------------------------------------------------------------

// function updateEndpoint() {
//   console.warn(`${luxon.DateTime.now()} updateEndpoint: start`);
//   endpoint = $('#endpoint').val();
//   $('#user-url').val(endpoint);
//   updateParameters('endpoint', endpoint);
//   clear();
//   console.warn(`${luxon.DateTime.now()} updateEndpoint: end`);
// }

// -------------------------------------------------------------------------------------------------

// function updateUserUrl() {
//   console.warn(`${luxon.DateTime.now()} updateUserUrl: start`);
//   endpoint = storeIngressOrder1FirstPageFromUser;
//   $('#provider').empty();
//   $('#endpoint').empty();
//   updateParameters('endpoint', endpoint);
//   clear();
//   console.warn(`${luxon.DateTime.now()} updateUserUrl: end`);
// }

// -------------------------------------------------------------------------------------------------

$(function () {
  // Note: this file should be copied to your server on a nightly cron and served from there
  $.getJSON('https://openactive.io/activity-list/activity-list.jsonld', function (data) {
    // Use SKOS.js to read the file (https://www.openactive.io/skos.js/)
    scheme_1 = new skos.ConceptScheme(data);

    //renderActivityList(scheme_1);

    // Note: use the below to set dropdown value elsewhere if necessary
    //$('.activity-list-dropdown').setValue("https://openactive.io/activity-list#72d19892-5f55-4e9c-87b0-a5433baa49c8");
  });
});

// -------------------------------------------------------------------------------------------------

$(function () {
  // Note: this file should be copied to your server on a nightly cron and served from there
  $.getJSON('https://openactive.io/facility-types/facility-types.jsonld', function (data) {
    // Use SKOS.js to read the file (https://www.openactive.io/skos.js/)
    scheme_2 = new skos.ConceptScheme(data);
  });
});

// -------------------------------------------------------------------------------------------------

$(function () {
  console.warn(`${luxon.DateTime.now()} Reload: start`);
  $('#execute').prop('disabled', true);
  $('#clear').prop('disabled', true);
  setPage();
  setFeeds();
});
