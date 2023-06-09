let scheme_1 = null;
let scheme_2 = null;

let organizerListRefresh;
let activityListRefresh;
let locationListRefresh;

let retryCount;
const retryCountMax = 3;
const retryCountdownMax = 5;

let loadingTimeout;
let inProgress;
let stopTriggered;
let showingSample;

let filters;
let coverage;
let proximity;
let day;
let startTime;
let endTime;
let minAge;
let maxAge;
let keywords;

let progress;
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
const storeIngressOrder1ApiColor = '#009ee3';
const storeIngressOrder2ApiColor = '#f6a635';

let feeds = {};
let providers = {};

let storeIngressOrder1;
let storeIngressOrder2;
let storeDataQuality; // This is used to store the results of DQ tests for filtering, regardless of whether or not we have a combined store from multiple feeds
let storeSample; // This is used to store a small sample of data from each run to show users on arrival
let storeCombinedItems; // This is present only if we have valid storeSuperEvent, storeSubEvent and link between them

// These will simply point to storeIngressOrder1 and storeIngressOrder2:
let storeSuperEvent;
let storeSubEvent;

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
let summary = {} // To hold total counts from database

let cp = $("#combineProgress");

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
axios.defaults.headers = {
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Expires': '0',
};
axios.defaults.timeout = 40000; // In ms. Default 0. Increase to wait for longer to receive response. Should be greater than the timeout in app.js which calls out to the actual feed.

// -------------------------------------------------------------------------------------------------

async function execute() {
  if (!inProgress) {
    updateParameters('execute', true); // DT: Is this necessary?
    clear(true);
    inProgress = true; // Here this must come after clear()

    await setStoreIngressOrder1FirstPage();
    await setStoreFeedType(storeIngressOrder1);
    await setStoreIngressOrder2FirstPage();
    await setStoreFeedType(storeIngressOrder2);

    if (storeIngressOrder1.firstPage) {
      console.log(`Started loading storeIngressOrder1: ${storeIngressOrder1.firstPage}`);
      loadingStart();
    }
    else {
      console.error('No valid first page for storeIngressOrder1, can\'t begin');
      $('#execute').prop('disabled', false);
      inProgress = false;
    }
  }
}

// -------------------------------------------------------------------------------------------------

function loadingStart() {
  updateScroll();
  $('#progress').append('<div><img src="images/ajax-loader.gif" alt="Loading"></div>');

  loadingTimeout = setTimeout(
    () => {
      if (inProgress && !stopTriggered) {
        $('#loading-time').fadeIn();
      }
    },
    5000
  );

  try {
    setStoreItems(storeIngressOrder1.firstPage, storeIngressOrder1);
  }
  catch (error) {
    console.error(error.message);
    stop();
    return;
  }
}

// -------------------------------------------------------------------------------------------------

function loadingComplete() {
  clearTimeout(loadingTimeout);
  $('#loading-time').hide();
  $('#progress').append('<div id="DQProgress"</div>');

  let funcs = [
    setStoreSuperEventAndStoreSubEvent,
    setStoreDataQualityItems,
    setStoreDataQualityItemFlags,
    postDataQuality,
  ];

  for (const func of funcs) {
    try {
      func();
    }
    catch (error) {
      console.error(error.message);
      stop();
      return;
    }
  }
}

// -------------------------------------------------------------------------------------------------

function stop() {
  inProgress = false; // Here this must come before clear()
  clear();
  console.warn('Stopped');
}

// -------------------------------------------------------------------------------------------------

function clear(execute=false) {
  // console.warn(`${luxon.DateTime.now()} clear`);
  $('#execute').prop('disabled', true);
  $('#clear').prop('disabled', true);
  if (!inProgress) {
    clearForm();
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
    clearTimeout(loadingTimeout);
    $('#loading-time').hide();
    $('#progress').append('<div id="stopping"></div>');
    $('#stopping').append('<p>Stopping ...</p>');
    $('#stopping').append('<img src="images/ajax-loader.gif" alt="Stopping ...">');
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

function clearDisplay() {
  // console.warn(`${luxon.DateTime.now()} clearDisplay`);
  $('#progress').empty();
  $('#loading-time').hide();
  $('#record-limit').hide();
  $('#filterRows').hide();
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
  $("#DQ_filterDates").prop("checked", false);
  $("#DQ_filterActivities").prop("checked", false);
  $("#DQ_filterGeos").prop("checked", false);
  $("#DQ_filterUrls").prop("checked", false);
  $("#organizer-list-selected").val("");
  $("#activity-list-selected").val("");
  $("#location-list-selected").val("");
  $("#Gender").val("");
  $("#Coverage").val("");
}

// -------------------------------------------------------------------------------------------------

function clearGlobals() {
  // console.warn(`${luxon.DateTime.now()} clearGlobals`);
  organizerListRefresh = 0;
  activityListRefresh = 0;
  locationListRefresh = 0;
  retryCount = 0;
  loadingTimeout = null;
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
  store.timeHarvestStart = luxon.DateTime.now();
  store.urls = {};
  store.items = {};
  store.feedType = null; // From the dataset page, not the RPDE feed
  store.itemKind = null; // From the RPDE feed
  store.itemDataType = null; // From the RPDE feed
  store.eventType = null; // Either 'superEvent' or 'subEvent'
  store.firstPageOrigin = null;
  store.firstPage = null;
  store.penultimatePage = null;
  store.lastPage = null;
  store.numPages = 0;
  store.numItems = 0;
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
  // Make a GET request to retrieve the sum values from the server
  $.getJSON('/api/download', function (sampleData) {
    console.log(sampleData);
    // Use the sampleData object as needed
    storeSample.items = sampleData;
    console.log(`Number of sample items: ${Object.keys(storeSample.items).length}`);
    if (Object.keys(storeSample.items).length > 0) {
      $('#progress').append('<h4>Exploring OpenActive Data</h4>');
      $('#progress').append(`The metrics below are based on DQ analysis of ${'x'} out of ${'x'} feeds.</br>`);
      $('#progress').append(`The records shown are drawn from a small sample taken from each feed.</br>`);
      $('#progress').append(`Explore the sample data below or select a provider and feed to press 'Go' to load and view live data.</br>`);
      showingSample = true;
      clearStore(storeDataQuality);
      storeDataQuality.items = Object.values(storeSample.items);
      console.log('Processing sample data');
      setStoreDataQualityItemFlags();
      postDataQuality();
    }
  })
    .catch(error => {
      console.error('Error from sample:', error);
      // Handle the error if needed
    });
}

// -------------------------------------------------------------------------------------------------

function getFilters() {
  filters = {
    organizer: $('#organizer-list-selected').val(),
    activity: $('#activity-list-selected').val(),
    location: $('#location-list-selected').val(),
    DQ_filterActivities: $('#DQ_filterActivities').prop("checked"),
    DQ_filterGeos: $('#DQ_filterGeos').prop("checked"),
    DQ_filterDates: $('#DQ_filterDates').prop("checked"),
    DQ_filterUrls: $('#DQ_filterUrls').prop("checked"),
    coverage: $("#Coverage").val(),
    proximity: $("#Proximity").val(),
    day: $("#Day").val(),
    startTime: $("#StartTime").val(),
    endTime: $("#EndTime").val(),
    minAge: $("#minAge").val(),
    maxAge: $("#maxAge").val(),
    gender: $("#Gender").val(),
    keywords: $("#Keywords").val(),
    relevantActivitySet: getRelevantActivitySet($('#activity-list-selected').val()),
  }
  return filters;
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

//This replaces the loadRPDE function in Nick's original visualiser adaptation
//Note the displaying of results happens in dq.js now, to improve filtering

function setStoreItems(originalUrlStr, store) {

  if (stopTriggered) {throw new Error('Stop triggered');}

  let results = $("#results");
  progress = $("#progress");

  if (store.ingressOrder === 1 && store.numItems === 0) {
    results.empty();
    results.append("<div id='resultsDiv'</div>");
    progress.empty();
    progress.append("<div id='progressDiv1'</div>");
    $("#progressDiv1").append("<div><img src='images/ajax-loader.gif' alt='Loading'></div>");
  }
  else if (store.ingressOrder === 2 && store.numItems === 0) {
    progress.append("<div id='progressDiv2'</div>");
  }

  if (store.ingressOrder === 1) {
    progress = $("#progressDiv1");
  } else {
    progress = $("#progressDiv2");
  }

  let url = setUrlStr(originalUrlStr, store);
  if (!url) {
    throw new Error(`Invalid URL: ${originalUrlStr}`);
  }

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
  axios.get(`/fetch?url=${encodeURIComponent(url)}`)
    .then(response => {
      if (
        response.status === 200 &&
        response.data.hasOwnProperty('items') &&
        response.data.hasOwnProperty('next')
      ) {

        retryCount = 0;
        store.numPages++;
        addApiPanel(url, store.ingressOrder);

        for (const item of response.data.items) {
          store.numItems++;
          // For those records that are 'live' in the feed ...
          if (item.state === 'updated') {
            // Update the store (check against modified dates for existing items):
            if (!store.items.hasOwnProperty(item.id) || (item.modified > store.items[item.id].modified)) {
              store.items[item.id] = item;
              store.urls[item.id] = url;
            }
          }
          // For those records that are no longer 'live' ...
          else if ((item.state === 'deleted') && store.items.hasOwnProperty(item.id)) {
            // Delete any matching items from the store:
            delete store.items[item.id];
            delete store.urls[item.id];
          }
        }

        const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds.toFixed(2);
        if (
          originalUrlStr !== response.data.next &&
          url !== response.data.next &&
          store.numItems < 25000
        ) {
          progress.empty();
          progress.append(`Reading ${store.feedType || ''} feed: <a href='${store.firstPage}' target='_blank'>${store.firstPage}</a></br>`);
          progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems} in ${elapsed} seconds...</br>`);
          store.penultimatePage = url;
          try {
            setStoreItems(response.data.next, store);
          }
          catch (error) {
            console.error(error.message);
            stop();
            return;
          }
        }
        else {
          if (store.numItems === 25000) {
            $('#record-limit').fadeIn();
          }
          progress.empty();
          progress.append(`Reading ${store.feedType || ''} feed: <a href='${store.firstPage}' target='_blank'>${store.firstPage}</a></br>`);
          progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems}; Completed in ${elapsed} seconds. </br>`);

          if (
            response.data.items.length === 0 &&
            store.numFilteredItems === 0 &&
            store.ingressOrder === 1
          ) {
            results.append('<div><p>No results found</p></div>');
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
            console.warn(
              `storeIngressOrder${store.ingressOrder} mismatched content types:\n` +
              `\tfeedType: ${store.feedType}\n` +
              `\titemKind: ${store.itemKind}\n` +
              `\titemDataType: ${store.itemDataType}`
            );
          }

          console.log(`Finished loading storeIngressOrder${store.ingressOrder}`);

          if (
            store.ingressOrder === 1 &&
            storeIngressOrder2.firstPage
          ) {
            console.log(`Started loading storeIngressOrder2: ${storeIngressOrder2.firstPage}`);
            try {
              setStoreItems(storeIngressOrder2.firstPage, storeIngressOrder2);
            }
            catch (error) {
              console.error(error.message);
              stop();
              return;
            }
          }
          else {
            progress.append('<div id="combineProgress"></div>');
            cp = $('#combineProgress');
            cp.text('Processing data feed...');
            cp.append('<div><img src="images/ajax-loader.gif" alt="Loading"></div>');
            sleep(100).then(() => { loadingComplete(); });
          }
        }
      }
    }).catch(error => {
      const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds;
      clearTimeout(loadingTimeout);
      $('#loading-time').hide();
      progress.empty();
      progress.append(`Reading ${store.feedType || ''} feed: <a href='${store.firstPage}' target='_blank'>${store.firstPage}</a></br>`);
      progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems} in ${elapsed} seconds...</br>`);
      progress.append(`API Request failed with message: ${error.message}</br>`);
      // inProgress = false; // Don't enable this here - we must treat the auto-retries of retryRequest() as still in progress in order to get the correct behaviour from clear()

      if (retryCount < retryCountMax) {
        retryCount++;
        retryRequest(url, store);
      }
      else {
        inProgress = false;
        progress.append(`<div>${retryCount} retries automatically attempted. Click to manually retry again.</div>`);
        progress.append('<div><button class="show-error btn btn-success">Retry</button></div>');

        $('.show-error').on('click', function () {
          retryCount++;
          inProgress = true;
          try {
            setStoreItems(url, store);
          }
          catch (error) {
            console.error(error.message);
            stop();
            return;
          }
        });
      }
    });

}

// -------------------------------------------------------------------------------------------------

function retryRequest(url, store) {
  let countdown = retryCountdownMax;
  progress.append(`<div>Retrying (${retryCount} of ${retryCountMax}) in <span id="countdown">${countdown}</span> seconds...</div>`);
  const countdownElement = $('#countdown');
  const countdownInterval = setInterval(() => {
    countdownElement.text(countdown);
    countdown--;
    if (countdown < 0) {
      clearInterval(countdownInterval);
      try {
        setStoreItems(url, store);
      }
      catch (error) {
        console.error(error.message);
        stop();
        return;
      }
    }
  }, 1000);
}

// -------------------------------------------------------------------------------------------------

function setUrlStr(originalUrlStr, store) {

  let urlStr;
  let urlSearchCounter = 0;
  let urlSearchComplete = false;

  while (!urlSearchComplete) {
    if (urlSearchCounter === 0) {
      urlStr = originalUrlStr;
    }
    else if (urlSearchCounter === 1) {
      urlStr = decodeURIComponent(originalUrlStr);
    }
    else if (urlSearchCounter === 2) {
      // e.g. 'https://reports.gomammoth.co.uk/api/OpenData/Leagues?afterTimestamp=0'
      // Next URLs are like '/api/OpenData/Leagues?afterTimestamp=3879824531'
      urlStr = store.firstPageOrigin + originalUrlStr;
    }
    else if (urlSearchCounter === 3) {
      // e.g. 'https://www.goodgym.org/api/happenings'
      // Next URLs are like '%2Fapi%2Fhappenings%3FafterTimestamp%3D2015-01-13+16%3A56%3A14+%2B0000%26afterID%3D28'
      urlStr = store.firstPageOrigin + decodeURIComponent(originalUrlStr);
    }
    else {
      urlSearchComplete = true;
    }

    if (!urlSearchComplete) {
      let urlObj = setUrlObj(urlStr);
      if (urlObj) {
        // if (urlSearchCounter > 0) {
        //   console.warn(`Invalid URL: ${originalUrlStr}\nValid modified URL: ${urlStr}`)
        // }
        if (originalUrlStr === store.firstPage) {
          store.firstPageOrigin = urlObj.origin;
        }
        urlSearchComplete = true;
        return urlStr;
      }
      urlSearchCounter++;
    }
  }

  return null;

}

// -------------------------------------------------------------------------------------------------

function setUrlObj(urlStr) {
  try {
    urlObj = new URL(urlStr);
    return urlObj;
  }
  catch {
    return null;
  }
}

// -------------------------------------------------------------------------------------------------

//Amended to handle embedded / nested superevents
function resolveProperty(item, prop) {
  return item.data && ((item.data.superEvent && item.data.superEvent[prop]) ||
    (item.data.superEvent && item.data.superEvent.superEvent && item.data.superEvent.superEvent[prop]) ||
    (item.data.instanceOfCourse && item.data.instanceOfCourse[prop]) ||
    (item.data.facilityUse && item.data.facilityUse[prop]) ||
    item.data[prop]);
}

// -------------------------------------------------------------------------------------------------

function resolveDate(item, prop) {
  return item.data &&
    (item.data[prop] || (item.data.superEvent && item.data.superEvent.eventSchedule && item.data.superEvent.eventSchedule[prop]));
}

// -------------------------------------------------------------------------------------------------

async function setStoreIngressOrder1FirstPage() {
  // console.warn(`${luxon.DateTime.now()} setStoreIngressOrder1FirstPage`);
  if (storeIngressOrder1FirstPageFromUser) {
    await axios.get(`/fetch?url=${encodeURIComponent(storeIngressOrder1FirstPageFromUser)}`)
      .then(response => {
        storeIngressOrder1.firstPage = (response.status === 200) ? storeIngressOrder1FirstPageFromUser : null;
      })
      .catch(error => {
        console.error(`Error from user URL: ${error.message}`);
      });
  }
  else {
    storeIngressOrder1.firstPage = $('#endpoint').val();
  }
}

// -------------------------------------------------------------------------------------------------

async function setStoreIngressOrder2FirstPage() {
  // console.warn(`${luxon.DateTime.now()} setStoreIngressOrder2FirstPage`);
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
  if (!store.firstPage) {
    store.feedType = null;
    return;
  }
  if (storeIngressOrder1FirstPageFromUser) {
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
}

// -------------------------------------------------------------------------------------------------

function setStoreItemKind(store) {
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
      console.warn(`storeIngressOrder${store.ingressOrder} mixed item kinds: [${uniqueItemKinds}]`);
      break;
  }
}

// -------------------------------------------------------------------------------------------------

function setStoreItemDataType(store) {
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
      console.warn(`storeIngressOrder${store.ingressOrder} mixed item data types: [${uniqueItemDataTypes}]`);
      break;
  }
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

function renderOrganizerList(organizers) {
  organizerListRefresh++;
  let organizerListSelected = $('#organizer-list-selected').val() || '';

  // Note: Removed class "form-control" from the button, as it was messing with the button width. No apparent effect on functionality:
  $('#organizer-list-dropdown').empty();
  $('#organizer-list-dropdown').append(
    `<div id="organizer-list-dropdown-${organizerListRefresh}" class="dropdown hierarchy-select">
        <button id="organizer-list-button" type="button" class="btn btn-secondary dropdown-toggle ml-1 mr-1"  data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
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
    width: '98%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#organizer-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#organizer-list-button").addClass("selected");
      }
      // Note that htmlDataValue is the same as $('#organizer-list-selected').val()
      if (htmlDataValue !== organizerListSelected) {
        console.warn(`Selected organizer for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

function renderActivityList(activities) {
  activityListRefresh++;
  let activityListSelected = $('#activity-list-selected').val() || '';

  // Note: Removed class "form-control" from the button, as it was messing with the button width. No apparent effect on functionality:
  $('#activity-list-dropdown').empty();
  $('#activity-list-dropdown').append(
    `<div id="activity-list-dropdown-${activityListRefresh}" class="dropdown hierarchy-select">
        <button id="activity-list-button" type="button" class="btn btn-secondary dropdown-toggle ml-1 mr-1" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
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
    width: '98%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#activity-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#activity-list-button").addClass("selected");
      }
      // Note that htmlDataValue is the same as $('#activity-list-selected').val()
      if (htmlDataValue !== activityListSelected) {
        console.warn(`Selected activity for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

function renderLocationList(locations) {
  locationListRefresh++;
  let locationListSelected = $('#location-list-selected').val() || '';

  // Note: Removed class "form-control" from the button, as it was messing with the button width. No apparent effect on functionality:
  $('#location-list-dropdown').empty();
  $('#location-list-dropdown').append(
    `<div id="location-list-dropdown-${locationListRefresh}" class="dropdown hierarchy-select">
          <button id="location-list-button" type="button" class="btn btn-secondary dropdown-toggle ml-1 mr-1"  data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
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
    width: '98%',
    // Set initial dropdown state based on the hidden field's initial value:
    initialValueSet: true,
    // Update other elements when a selection is made:
    // Note that $('#location-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
      if (htmlDataValue !== '') {
        $("#location-list-button").addClass("selected");
      }
      // Note that htmlDataValue is the same as $('#location-list-selected').val()
      if (htmlDataValue !== locationListSelected) {
        console.warn(`Selected location for filter: ${htmlDataValue}`);
        postDataQuality();
      }
    }
  });
}

// -------------------------------------------------------------------------------------------------

function renderSchedule(item) {
  if (item.data && item.data.eventSchedule && Array.isArray(item.data.eventSchedule)) {
    return item.data.eventSchedule.filter(x => Array.isArray(x.byDay)).flatMap(x => x.byDay.map(day => `${day.replace(/https?:\/\/schema.org\//, '')} ${x.startTime}`)).join(', ');
  } else {
    return '';
  }
}

// -------------------------------------------------------------------------------------------------

function updateActivityList(activityIds) {
  let activities = scheme_1.generateSubset(Object.keys(activityIds));
  renderActivityList(activities);
}

// -------------------------------------------------------------------------------------------------

function updateOrganizerList(organizers) {
  renderOrganizerList(organizers);
}

// -------------------------------------------------------------------------------------------------

function updateLocationList(locations) {
  renderLocationList(locations);
}

// -------------------------------------------------------------------------------------------------

function getRelevantActivitySet(id) {
  let concept = scheme_1.getConceptByID(id);
  if (concept) {
    return new Set([id].concat(concept.getNarrowerTransitive().map(concept => concept.id)));
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function setJSONTab(itemId, switchTab) {

  if (switchTab) {
    $("#resultTab").removeClass("active");
    $("#resultPanel").removeClass("active");
    $("#jsonTab").addClass("active");
    $("#jsonPanel").addClass("active");
    updateScrollResults();
  }

  document.getElementById('json').innerHTML = "<div id='json-tab-1' class='json-tab-subpanel'></div><div id='json-tab-2' class='json-tab-subpanel'></div>";

  // Output both relevant feeds if combined
  if (
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
      setJSONTabSubPanel(1, storeSuperEvent, storeSuperEventItemId, storeSuperEventItem);
    }
    if (storeSubEventItem) {
      setJSONTabSubPanel(2, storeSubEvent, storeSubEventItemId, storeSubEventItem);
    }
  }
  else if (
    storeIngressOrder1 &&
    storeIngressOrder1.items.hasOwnProperty(itemId)
  ) {
    setJSONTabSubPanel(1, storeIngressOrder1, itemId);
  }
  else if (
    storeIngressOrder2 &&
    storeIngressOrder2.items.hasOwnProperty(itemId)
  ) {
    setJSONTabSubPanel(1, storeIngressOrder2, itemId);
  }

}

// -------------------------------------------------------------------------------------------------

function setJSONTabSubPanel(subPanelNumber, store, itemId, item=null) {
  document.getElementById(`json-tab-${subPanelNumber}`).innerHTML = `
    <div class='flex_row'>
        <h2 class='json-tab-heading'>${store.itemDataType ? store.itemDataType : 'Unknown content type'}</h2>
        <button id='json-tab-${subPanelNumber}-source' class='btn btn-secondary btn-sm json-tab-button'>Source</button>
        <button id='json-tab-${subPanelNumber}-validate' class='btn btn-secondary btn-sm json-tab-button'>Validate</button>
    </div>
    <pre>${JSON.stringify(item ? item : store.items[itemId], null, 2)}</pre>`;
  $(`#json-tab-${subPanelNumber}-source`).on('click', function () {
    window.open(store.urls[itemId], '_blank').focus();
  });
  $(`#json-tab-${subPanelNumber}-validate`).on('click', function () {
    openValidator(item ? item : store.items[itemId]);
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
  let panel = $("#resultsDiv");
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

function addApiPanel(text, storeIngressOrder) {
  let panel = $('#api');
  let color = (storeIngressOrder === 1) ? storeIngressOrder1ApiColor : storeIngressOrder2ApiColor;
  panel
    .add(`<div style='margin:5px; padding: 5px; background-color: ${color};'><a href=${text} target='_blank' class='text-wrap' style='word-wrap: break-word; color: white;'>${text}</a></div>`)
    .appendTo(panel);
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

$('#resultsTab').on('click', function () {
  updateScrollResults();
});

$('#jsonTab').on('click', function () {
  updateScrollResults();
});

$('#apiTab').on('click', function () {
  updateScrollResults();
});

$('#organizerTab').on('click', function () {
  updateScrollResults();
});

$('#locationTab').on('click', function () {
  updateScrollResults();
});

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

  updateScrollResults();
});

// -------------------------------------------------------------------------------------------------

function updateScroll() {
  const element = document.getElementById('progress');
  element.scrollTop = element.scrollHeight;
}

// -------------------------------------------------------------------------------------------------

function updateScrollResults() {
  window.scrollTo({
    top: 480,
    behavior: 'smooth' // You can change this to 'auto' for instant scrolling
  });
}

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
  });
  $("#clear").on("click", function () {
    clear();
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
      setProviders();
    });

}

// -------------------------------------------------------------------------------------------------

function setProviders() {
  // console.warn(`${luxon.DateTime.now()} setProviders: start`);
  $.getJSON('/feeds', function (data) {
    $('#provider').empty();
    // Extract unique providers
    const providers = [...new Set(data.feeds.map(feed => feed.publisherName))];
    // Calculate the combined sum for each unique provider
    const providerSums = providers.map(provider => {
      let combinedSum = 0;
      data.feeds.forEach(feed => {
        if (provider === 'All OpenActive Feeds' && typeof feed.numparent === 'number' && typeof feed.numchild === 'number') {
          combinedSum += feed.numparent + feed.numchild;
        }
        else if (feed.publisherName === provider && typeof feed.numparent === 'number' && typeof feed.numchild === 'number') {
          combinedSum += feed.numparent + feed.numchild;
        }
      });
      return { provider, sum: combinedSum };
    });
    // Sort providers by descending sum, then alphabetically
    providerSums.sort((a, b) => {
      if (b.sum === a.sum) {
        return a.provider.localeCompare(b.provider);
      }
      return b.sum - a.sum;
      // return a.provider.localeCompare(b.provider);
    });
    // Output the sorted providers to HTML
    providerSums.forEach(providerSum => {
      // Round the combinedSum
      const roundedSum = Math.round(providerSum.sum / 500) * 500;
      const formattedSum = roundedSum.toLocaleString() + (roundedSum !== 0 ? '+' : '');
      $('#provider').append(`<option value="${providerSum.provider}">${providerSum.provider} (${formattedSum})</option>`);
    });
  })
    .done(function () {
      // console.warn(`${luxon.DateTime.now()} setProviders: end`);
      setEndpoints();
    });
}

// -------------------------------------------------------------------------------------------------

function setEndpoints() {
  // console.warn(`${luxon.DateTime.now()} setEndpoints: start`);
  $.getJSON('/feeds', function (data) {
    $('#endpoint').empty();
    $.each(data.feeds, function (index, feed) {
      if (feed.publisherName === $('#provider option:selected').val()) {
        $('#endpoint').append(`<option value='${feed.url}'>${feed.type}</option>`);
      }
    });
  })
    .done(function () {
      // console.warn(`${luxon.DateTime.now()} setEndpoints: end`);
      // updateEndpoint();
      setEndpoint();
    });
}

// -------------------------------------------------------------------------------------------------

function setEndpoint() {
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
    updateParameters('endpoint', endpoint);
    clear();
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
