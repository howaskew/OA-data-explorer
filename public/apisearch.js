let endpoint;
let provider;

let scheme_1 = null;
let scheme_2 = null;

let organizerListRefresh;
let activityListRefresh;
let locationListRefresh;

let loadingTimeout;
let loadingStarted;
let loadingDone;

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
let map;

let activeJSONButton;
const activeJSONButtonColor = 'DeepSkyBlue';
const inactiveJSONButtonColor = 'DarkGray';

let feeds = {};
let providers = {};

let storeIngressOrder1 = {
  ingressOrder: 1,
};
let storeIngressOrder2 = {
  ingressOrder: 2,
};
let storeDataQuality = {}; // This is used to store the results of DQ tests for filtering, regardless of whether or not we have a combined store from multiple feeds
let storeCombinedItems; // This is present only if we have valid storeSuperEvent, storeSubEvent and link between them

// These will simply point to storeIngressOrder1 and storeIngressOrder2:
let storeSuperEvent;
let storeSubEvent;

// These may be the feedType or the itemDataType, depending on conditions:
let storeSuperEventContentType;
let storeSubEventContentType;

let superEventFeedTypes = ['SessionSeries', 'FacilityUse', 'IndividualFacilityUse'];
let subEventFeedTypes = ['ScheduledSession', 'Slot', 'Event', 'OnDemandEvent'];

let sessionSeriesUrlParts = [
  'session-series',
  'sessionseries',
];
let scheduledSessionUrlParts = [
  'scheduled-sessions',
  'scheduledsessions',
  'scheduled-session',
  'scheduledsession',
];
let facilityUseUrlParts = [
  'facility-uses',
  'facilityuses',
  'facility-use',
  'facilityuse',
];
let individualFacilityUseUrlParts = [
  'individual-facility-uses',
  'individual-facilityuses',
  'individualfacility-uses',
  'individualfacilityuses',
  'individual-facility-use',
  'individual-facilityuse',
  'individualfacility-use',
  'individualfacilityuse',
];
let slotUrlParts = [
  'slots',
  'slot',
];

let storeIngressOrder1FirstPageFromUser;
let link; // Linking variable between super-event and sub-event feeds

let cp = $("#combineProgress");

// -------------------------------------------------------------------------------------------------

function clearGlobals() {
  organizerListRefresh = 0;
  activityListRefresh = 0;
  locationListRefresh = 0;
  loadingTimeout = null;
  loadingStarted = null;
  loadingDone = false;
  clearStore(storeIngressOrder1);
  clearStore(storeIngressOrder2);
  clearStore(storeDataQuality);
  storeCombinedItems = [];
  storeSuperEvent = null;
  storeSubEvent = null;
  storeSuperEventContentType = null;
  storeSubEventContentType = null;
  storeIngressOrder1FirstPageFromUser = null;
  link = null;
}

clearGlobals();

// -------------------------------------------------------------------------------------------------

function clearStore(store) {
  store.timeHarvestStart = luxon.DateTime.now();
  store.urls = {};
  store.items = {};
  store.feedType = null; // From the dataset page, not the RPDE feed
  store.itemKind = null; // From the RPDE feed
  store.itemDataType = null; // From the RPDE feed
  store.firstPage = null;
  store.lastPage = null;
  store.numPages = 0;
  store.numItems = 0;
  store.numFilteredItems = 0;
  store.showMap = null;
  store.filteredItemsUniqueOrganizers = null;
  store.filteredItemsUniqueLocations = null;
  store.filteredItemsUniqueActivities = null;
  store.filteredItemsUniqueParentIds = null;
  store.filteredItemsUniqueDates = null;
}

// -------------------------------------------------------------------------------------------------

function clearFilters() {
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

function clearURLParameters(endpoint) {
  let tempArray = window.location.href.split("?");
  let baseURL = tempArray[0];
  return baseURL + "?endpoint=" + endpoint;
}

// -------------------------------------------------------------------------------------------------

function clearForm(endpoint) {
  if (endpoint) {
    window.history.replaceState('', '', window.location.href.split("?")[0] + "?endpoint=" + endpoint);
  }
  else {
    window.location.search = "";
  }
  clearDisplay();
}

// -------------------------------------------------------------------------------------------------

function clearDisplay() {
  $("#progress").empty();
  $("#filterRows").hide();
  $("#tabs").hide();
  clearCharts();
  clearTabs();
}

// -------------------------------------------------------------------------------------------------

function clearCharts() {
  if (chart1) { chart1.destroy(); }
  if (chart2) { chart2.destroy(); }
  if (chart3) { chart3.destroy(); }
  if (chart4) { chart4.destroy(); }
  if (chart5a) { chart5a.destroy(); }
  if (chart5b) { chart5b.destroy(); }
  if (chart6) { chart6.destroy(); }
}

// -------------------------------------------------------------------------------------------------

function clearTabs() {
  $("#results").empty();
  $("#json").empty();
  $("#api").empty();
  $("#organizer").empty();
  $("#location").empty();
  $("#map").empty();
}

// -------------------------------------------------------------------------------------------------

function clearCache(store) {
  // Call the clear cache endpoint with URL parameter
  fetch('/api/clear-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: store.lastPage })
  })
    .then(response => {
      return response.text();
    })
    .then(data => {
      console.log(data);
    })
    .catch(error => {
      console.log(error);
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

//This replaces the loadRPDE function in Nick's original visualiser adaptation
//Note the displaying of results happens in dq.js now, to improve filtering

function setStoreItems(url, store) {

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

  $.ajax({
    async: true,
    type: 'GET',
    url: '/fetch?url=' + encodeURIComponent(url),
    timeout: 30000
  })
    .done(async function (page) {

      store.numPages++;
      addApiPanel(url, store.ingressOrder);

      $.each(page.content ? page.content : page.items, function (_, item) {

        // Processing each item on the page returned from the API

        store.numItems++; // Count total number of records returned

        // For those records that are 'live' in the feed...
        if (item.state === 'updated') {
          //Update the store (check against modified dates for existing items)
          if (!store.items.hasOwnProperty(item.id) || (item.modified > store.items[item.id].modified)) {
            store.items[item.id] = item;
            store.urls[item.id] = url;
          }
        }
        // For those records that are no longer 'live'...
        else if ((item.state === 'deleted') && store.items.hasOwnProperty(item.id)) {
          //Delete any matching items from the store
          delete store.items[item.id];
          delete store.urls[item.id];
        }
      });

      let pageNo = page.number ? page.number : page.page;
      let firstPage = "";
      if (page.first === true) {
        firstPage = "disabled='disabled'";
      }

      let lastPage = "";
      if (page.last === true) {
        lastPage = "disabled='disabled'";
      }

      //postResults(store, filters);

      const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds.toFixed(2);
      if (url !== page.next && store.numItems < 25000) {
        progress.empty();
        progress.append("Reading " + store.feedType + " feed: <a href='" + store.firstPage + "' target='_blank'>" + store.firstPage + "</a></br>");
        progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems} in ${elapsed} seconds...</br>`);
        setStoreItems(page.next, store);
      }
      else {
        if (store.numItems >= 25000) {
          $("#record-limit").fadeIn();
        }
        progress.empty();
        progress.append("Reading " + store.feedType + " feed: <a href='" + store.firstPage + "' target='_blank'>" + store.firstPage + "</a></br>");
        progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems}; Completed in ${elapsed} seconds. </br>`);

        if (page.items.length === 0 && store.numFilteredItems === 0 && store.ingressOrder === 1) {
          results.append("<div><p>No results found</p></div>");
        }

        store.lastPage = url;
        clearCache(store);
        setStoreItemKind(store);
        setStoreItemDataType(store);

        // console.log(`feedType: ${store.feedType}`);
        // console.log(`itemKind: ${store.itemKind}`);
        // console.log(`itemDataType: ${store.itemDataType}`);

        if (
          (store.feedType !== store.itemKind) ||
          (store.feedType !== store.itemDataType) ||
          (store.itemKind !== store.itemDataType)
        ) {
          console.warn(
            `Mismatched content types:\n` +
            `  feedType: ${store.feedType}\n` +
            `  itemKind: ${store.itemKind}\n` +
            `  itemDataType: ${store.itemDataType}`
          );
        }

        console.log(`Finished loading storeIngressOrder${store.ingressOrder}`);

        if (store.ingressOrder === 1 && storeIngressOrder2.firstPage && link) {
          console.log(`Started loading storeIngressOrder2: ${storeIngressOrder2.firstPage}`);
          setStoreItems(storeIngressOrder2.firstPage, storeIngressOrder2);
        }
        else {
          progress.append("<div id='combineProgress'></div>");
          cp = $("#combineProgress");
          cp.text("Processing data feed...");
          cp.append("<div><img src='images/ajax-loader.gif' alt='Loading'></div>");
          sleep(100).then(() => { loadingComplete(); });
        }
      }
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
      const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds;
      $("#loading-time").hide();
      progress.empty();
      progress.append("Reading " + store.feedType + " feed: <a href='" + store.firstPage + "' target='_blank'>" + store.firstPage + "</a></br>");
      progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems} in ${elapsed} seconds...</br>`);
      progress.append("API Request failed with status: " + jqXHR.status + " - " + jqXHR.statusText + " " + errorThrown);
      progress.append('<div><button class="show-error btn btn-success">Retry</button></div>');
      $(".show-error").on("click", function () {
        setStoreItems(url, store);;
      });
    });
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
    ((item.data.superEvent && item.data.superEvent.eventSchedule && item.data.superEvent.eventSchedule[prop]) ||
      item.data[prop]);
}

// -------------------------------------------------------------------------------------------------

function setStoreIngressOrder1FirstPage() {
  if (storeIngressOrder1FirstPageFromUser) {
    let page = $.ajax({
      async: false,
      type: 'GET',
      url: '/fetch?url=' + encodeURIComponent(storeIngressOrder1FirstPageFromUser),
      timeout: 30000
    });
    storeIngressOrder1.firstPage = (page.status === 200) ? storeIngressOrder1FirstPageFromUser : null;
  }
  else {
    storeIngressOrder1.firstPage = $("#endpoint").val();
  }
}

// -------------------------------------------------------------------------------------------------

function setStoreIngressOrder2FirstPage() {
  switch (storeIngressOrder1.feedType) {
    case 'SessionSeries':
      setStoreIngressOrder2FirstPageHelper(sessionSeriesUrlParts, scheduledSessionUrlParts);
      break;
    case 'ScheduledSession':
      setStoreIngressOrder2FirstPageHelper(scheduledSessionUrlParts, sessionSeriesUrlParts);
      break;
    case 'FacilityUse':
      setStoreIngressOrder2FirstPageHelper(facilityUseUrlParts, slotUrlParts);
      break;
    case 'IndividualFacilityUse':
      setStoreIngressOrder2FirstPageHelper(individualFacilityUseUrlParts, slotUrlParts);
      break;
    case 'Slot':
      setStoreIngressOrder2FirstPageHelper(slotUrlParts, facilityUseUrlParts.concat(individualFacilityUseUrlParts));
      break;
    default:
      storeIngressOrder2.firstPage = null;
      break;
  }
}

// -------------------------------------------------------------------------------------------------

function setStoreIngressOrder2FirstPageHelper(feedType1UrlParts, feedType2UrlParts) {
  for (const feedType1UrlPart of feedType1UrlParts) {
    if (storeIngressOrder1.firstPage.includes(feedType1UrlPart)) {
      for (const feedType2UrlPart of feedType2UrlParts) {
        // If the sets of URL parts have been properly defined, then we should never have a match here. If
        // we did, then without this check we would get the same URL for storeIngressOrder1 and storeIngressOrder2,
        // which would be problematic:
        if (feedType1UrlPart !== feedType2UrlPart) {
          let storeIngressOrder2FirstPage = storeIngressOrder1.firstPage.replace(feedType1UrlPart, feedType2UrlPart);
          if (storeIngressOrder1FirstPageFromUser) {
            let page = $.ajax({
              async: false,
              type: 'GET',
              url: '/fetch?url=' + encodeURIComponent(storeIngressOrder2FirstPage),
              timeout: 30000
            });
            if (page.status === 200) {
              storeIngressOrder2.firstPage = storeIngressOrder2FirstPage;
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

function setStoreFeedType(store) {
  if (!store.firstPage) {
    store.feedType = null;
    return;
  }
  if (storeIngressOrder1FirstPageFromUser) {
    if (sessionSeriesUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'SessionSeries';
    }
    else if (scheduledSessionUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'ScheduledSession';
    }
    else if (facilityUseUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'FacilityUse';
    }
    else if (individualFacilityUseUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'IndividualFacilityUse';
    }
    else if (slotUrlParts.map(x => store.firstPage.includes(x)).includes(true)) {
      store.feedType = 'Slot';
    }
    else {
      store.feedType = null;
    }
  }
  else {
    store.feedType = feeds[store.firstPage].hasOwnProperty('type') ? feeds[store.firstPage].type : null;
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
      break;
  }
}

// -------------------------------------------------------------------------------------------------

function loadingStart() {
  $("#tabs").hide();
  $("#record-limit").hide();
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
  }
  loadingTimeout = setTimeout(loadingTakingTime, 5000);
  loadingStarted = true;
  loadingDone = false;
}

// -------------------------------------------------------------------------------------------------

function loadingTakingTime() {
  if (!loadingDone) {
    $("#loading-time").fadeIn();
  }
}

// -------------------------------------------------------------------------------------------------

function loadingComplete() {

  loadingStarted = null;
  loadingDone = true;

  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }

  $("#loading-time").hide();
  progress.append(`<div id='DQProgress'</div>`);

  setStoreDataQualityItems();
  setStoreDataQualityItemFlags();
  //console.log(storeDataQuality);

  $("#tabs").fadeIn("slow");

  postDataQuality();
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
    let hidden = "";
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
      'href': "#",
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

  // Render the organizer list in a format the HierarchySelect will understand
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
    // Set initial dropdown state based on the hidden field's initial value
    initialValueSet: true,
    // Update other elements when a selection is made
    // Note that $('#organizer-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
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
    `<div id="activity-list-dropdown-${activityListRefresh}" class="dropdown">
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

  // Render the activity list in a format the HierarchySelect will understand
  $(`#activity-list-dropdown-${activityListRefresh} .hs-menu-inner`).append(renderTree(activities.getTopConcepts(), 1, []));

  $(`#activity-list-dropdown-${activityListRefresh}`).hierarchySelect({
    width: '98%',
    // Set initial dropdown state based on the hidden field's initial value
    initialValueSet: true,
    // Update other elements when a selection is made
    // Note that $('#activity-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
      let concept = activities.getConceptByID(htmlDataValue);
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

  // Render the location list in a format the HierarchySelect will understand
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
    // Set initial dropdown state based on the hidden field's initial value
    initialValueSet: true,
    // Update other elements when a selection is made
    // Note that $('#location-list-selected').val() is set automatically by HierarchySelect upon selection
    onChange: function (htmlDataValue) {
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

function updateActivityList(activitiesObj) {
  let activities = scheme_1.generateSubset(Object.keys(activitiesObj));
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
    storeSuperEvent && Object.keys(storeSuperEvent.items).length > 0 &&
    storeSubEvent && Object.keys(storeSubEvent.items).length > 0 &&
    link &&
    storeSubEvent.feedType !== null
  ) {
    const storeSubEventItem = storeSubEvent.items[itemId];
    const storeSuperEventItemId = String(storeSubEventItem.data[link]).split('/').at(-1);
    const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem => String(storeSuperEventItem.id).split('/').at(-1) === storeSuperEventItemId);

    if (storeSuperEventItem) {
      document.getElementById('json-tab-1').innerHTML = `
        <div class='flex_row'>
            <h2 class='json-tab-heading'>${storeSuperEvent.itemDataType}</h2>
            <button id='json-tab-1-source' class='btn btn-secondary btn-sm json-tab-button'>Source</button>
            <button id='json-tab-1-validate' class='btn btn-secondary btn-sm json-tab-button'>Validate</button>
        </div>
        <pre>${JSON.stringify(storeSuperEventItem, null, 2)}</pre>`;
      $('#json-tab-1-source').on('click', function () {
        window.open(storeSuperEvent.urls[storeSuperEventItemId], '_blank').focus();
      });
      $('#json-tab-1-validate').on('click', function () {
        openValidator(storeSuperEventItem);
      });
    }

    document.getElementById('json-tab-2').innerHTML = `
      <div class='flex_row'>
          <h2 class='json-tab-heading'>${storeSubEvent.itemDataType}</h2>
          <button id='json-tab-2-source' class='btn btn-secondary btn-sm json-tab-button'>Source</button>
          <button id='json-tab-2-validate' class='btn btn-secondary btn-sm json-tab-button'>Validate</button>
      </div>
      <pre>${JSON.stringify(storeSubEventItem, null, 2)}</pre>`;
    $('#json-tab-2-source').on('click', function () {
      window.open(storeSubEvent.urls[itemId], '_blank').focus();
    });
    $('#json-tab-2-validate').on('click', function () {
      openValidator(storeSubEventItem);
    });
  } else {
    document.getElementById('json-tab-1').innerHTML = `
      <div class='flex_row'>
          <h2 class='json-tab-heading'>${storeIngressOrder1.itemDataType}</h2>
          <button id='json-tab-1-source' class='btn btn-secondary btn-sm json-tab-button'>Source</button>
          <button id='json-tab-1-validate' class='btn btn-secondary btn-sm json-tab-button'>Validate</button>
      </div>
      <pre>${JSON.stringify(storeIngressOrder1.items[itemId], null, 2)}</pre>`;
    $('#json-tab-1-source').on('click', function () {
      window.open(storeIngressOrder1.urls[itemId], '_blank').focus();
    });
    $('#json-tab-1-validate').on('click', function () {
      openValidator(storeIngressOrder1.items[itemId]);
    });
  }

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
  let panel = $("#api");
  let colour = "";
  if (storeIngressOrder === 1) {
    colour = "lightblue";
  }
  else {
    colour = "lightgray";
  }
  panel
    .add("<div style='background-color: " + colour + "'><p class='text-wrap' style='word-wrap: break-word'>" + text + "</p></div>")
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
// See bottom of this page for more details:
//   https://getbootstrap.com/docs/5.0/components/navs-tabs/
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
    map.fitBounds(markerBounds, {padding: [50,50]});
  }, 100); // Delay the fitBounds to ensure markers plotted

  updateScrollResults();
});

// -------------------------------------------------------------------------------------------------

function updateScroll() {
  const element = document.getElementById("progress");
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

function updateProvider() {
  provider = $("#provider option:selected").text();
  clearDisplay();
  //Replicating setEndpoints, without the page reset
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, feed) {
      if (feed.publisherName === provider) {
        $("#endpoint").append("<option value='" + feed.url + "'>" + feed.type + "</option>");
      }
    });
  })
    .done(function () {
      endpoint = $("#endpoint").val();
      updateEndpoint();
    });
}

// -------------------------------------------------------------------------------------------------

function disableFilters() {
  document.getElementById("DQ_filterActivities").disabled = true;
  document.getElementById("DQ_filterGeos").disabled = true;
  document.getElementById("DQ_filterDates").disabled = true;
  document.getElementById("DQ_filterUrls").disabled = true;
}

function enableFilters() {
  document.getElementById("DQ_filterActivities").disabled = false;
  document.getElementById("DQ_filterGeos").disabled = false;
  document.getElementById("DQ_filterDates").disabled = false;
  document.getElementById("DQ_filterUrls").disabled = false;
}

// -------------------------------------------------------------------------------------------------

function updateEndpoint() {

  clearDisplay();
  clearFilters();

  provider = $("#provider option:selected").text();
  endpoint = $("#endpoint").val();

  updateParameters("endpoint", endpoint);
  clearForm(endpoint);

  $("#user-url").val(endpoint);

}

// -------------------------------------------------------------------------------------------------

function updateEndpointUpdate() {
  if (endpoint !== "") {
    $("#execute").prop('disabled', false);
  }
  if (endpoint === "") {
    $("#Vocabulary").prop('disabled', true);
    $("#TaxonomyTerm").prop('disabled', true);
    $("#execute").prop('disabled', false);
  }
}

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

function runForm(pageNumber) {

  if (pageNumber === undefined) {
    pageNumber = null;
  }

  let error = false;
  if ($("#endpoint").val() === "") {
    error = true;
    alert("Missing Endpoint");
  }
  if ($("#Proximity").val() !== "") {
    if (isNaN($("#Proximity").val())) {
      error = true;
      alert("Proximity must be a number");
    }
  }

  if (error) {
    return;
  }

  updateParameters("execute", true);

  if (pageNumber !== null) {
    updateParameters("page", pageNumber);
  }

  updateScroll();
  $("#progress").append("<div><img src='images/ajax-loader.gif' alt='Loading'></div>");

  clearGlobals();
  clearDisplay();

  loadingStart();

  storeIngressOrder1FirstPageFromUser = !($("#user-url").val().trim() in feeds) ? $("#user-url").val().trim() : null;

  setStoreIngressOrder1FirstPage();
  setStoreFeedType(storeIngressOrder1);

  if (superEventFeedTypes.includes(storeIngressOrder1.feedType)) {
    storeSuperEvent = storeIngressOrder1;
    storeSubEvent = storeIngressOrder2;
  }
  else if (subEventFeedTypes.includes(storeIngressOrder1.feedType)) {
    storeSubEvent = storeIngressOrder1;
    storeSuperEvent = storeIngressOrder2;
  }
  else {
    console.warn('Unknown storeIngressOrder1 feedType, can\'t create combined store');
  }

  if (storeSuperEvent && storeSubEvent) {
    setStoreIngressOrder2FirstPage();
    setStoreFeedType(storeIngressOrder2);

    if (storeIngressOrder1.feedType && storeIngressOrder2.feedType && storeIngressOrder1.feedType === storeIngressOrder2.feedType) {
      console.warn(`Matching feedType for storeIngressOrder1 and storeIngressOrder2 of '${storeIngressOrder1.feedType}'`);
    }

    switch (storeSubEvent.feedType) {
      case 'ScheduledSession':
        link = 'superEvent';
        break;
      case 'Slot':
        link = 'facilityUse';
        break;
      default:
        console.warn('No feed linking variable, can\'t create combined store');
        break;
    }
  }

  if (storeIngressOrder1.firstPage) {
    console.log(`Started loading storeIngressOrder1: ${storeIngressOrder1.firstPage}`);
    setStoreItems(storeIngressOrder1.firstPage, storeIngressOrder1, getFilters());
  }
  else {
    console.error('No valid first page for storeIngressOrder1, can\'t begin');
  }
}

// -------------------------------------------------------------------------------------------------


function getSummary() {
// Make a GET request to retrieve the sum values from the server
$.getJSON('/sum', function(response) {
  console.log(`numParent: ${response.sum1} numChild: ${response.sum2}`);
})
.fail(function(error) {
  console.error('Error retrieving sum values:', error);
});
}

// -------------------------------------------------------------------------------------------------


function setPage() {

  $("#provider").on("change", function () {
    updateProvider();
  });
  $("#endpoint").on("change", function () {
    updateEndpoint();
  });
  $("#user-url").on("change", function () {
    $("#endpoint").empty();
    $("#provider").empty();
    updateParameters("endpoint", $("#user-url").val());
    clearForm($("#user-url").val());
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

  clearDisplay();

  $("#clear").on("click", function () {
    clearFilters();
    clearForm($("#endpoint").val());
  });

  $("#execute").on("click", function () {
    if (!loadingStarted) {
      runForm();
    }
  });

  if (getUrlParameter("endpoint") !== undefined) {
    $("#endpoint").val(getUrlParameter("endpoint"));
    $.getJSON("/feeds", function (data) {
      $.each(data.feeds, function (index, feed) {
        if (feed.url === $("#endpoint option:selected").val()) {
          // config = feed; //Config was used in OpenReferral - but not now?
        }
      });
    })
      .done(function () {
        updateEndpointUpdate();
        if (getUrlParameter("execute") === "true" && loadingStarted !== 'true') {
          runForm();
        }
      });
  }
  else {
    //updateParameters("endpoint", $("#endpoint").val());
    //setEndpoints();
  }
}

// -------------------------------------------------------------------------------------------------

function setProvider() {
  $.getJSON("/feeds", function (data) {
    $("#provider").empty()
    providers = [... new Set(data.feeds.map(feed => feed.publisherName))];
    $.each(providers, function (index, name) {
      $("#provider").append("<option value='" + name + "'>" + name + "</option>");
    });
  })
    .done(function () {
      setEndpoints();
    });
}

function setEndpoints() {
  provider = $("#provider option:selected").text();
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, feed) {
      feeds[feed.url] = feed;
      if (feed.publisherName === provider) {
        $("#endpoint").append("<option value='" + feed.url + "'>" + feed.type + "</option>");
      }
    });
  })
    .done(function () {
      updateParameters("endpoint", $("#endpoint").val());
      setPage();
      $("#user-url").val($("#endpoint").val());
    });
}

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

$(function () {
  // Note: this file should be copied to your server on a nightly cron and served from there
  $.getJSON('https://openactive.io/facility-types/facility-types.jsonld', function (data) {
    // Use SKOS.js to read the file (https://www.openactive.io/skos.js/)
    scheme_2 = new skos.ConceptScheme(data);

  });
});

// -------------------------------------------------------------------------------------------------

$(function () {
  setProvider();
});
