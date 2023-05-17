let endpoint;
let provider;

let scheme_1 = null;
let scheme_2 = null;

let activityListRefresh = 0;

let loadingTimeout = null;
let loadingStarted = null;
let loadingDone = false;

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
let chart5;
let chart6;

let feeds = {};
let providers = {};

let storeIngressOrder1 = {
  ingressOrder: 1,
};
let storeIngressOrder2 = {
  ingressOrder: 2,
};

// These will simply point to storeIngressOrder1 and storeIngressOrder2:
let storeSuperEvent = null;
let storeSubEvent = null;

// This is used to store the results of DQ tests for filtering
let storeItemsForDataQuality = [];

// These may be the feedType or the itemDataType, depending on conditions:
let storeSuperEventContentType = null;
let storeSubEventContentType = null;

let superEventFeedTypes = ['SessionSeries', 'FacilityUse', 'IndividualFacilityUse'];
let subEventFeedTypes = ['ScheduledSession', 'Slot', 'Event', 'OnDemandEvent'];

let link = null; // Linking variable between super-event and sub-event feeds

let numListings = 0;
let numOpps = 0;

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

// -------------------------------------------------------------------------------------------------

function clearStore(store) {
  store.items = {};
  store.feedType = null; // From the dataset page, not the RPDE feed
  store.itemKind = null; // From the RPDE feed
  store.itemDataType = null; // From the RPDE feed
  store.firstPage = null;
  store.lastPage = null;
  store.numPages = 0;
  store.numItems = 0;
  store.numItemsMatchFilters = 0;
  store.timeHarvestStart = luxon.DateTime.now();
  store.uniqueActivities = new Set();
}

clearStore(storeIngressOrder1);
clearStore(storeIngressOrder2);
clearStore(storeItemsForDataQuality);

// -------------------------------------------------------------------------------------------------

function getFilters() {
  filters = {
    activity: $('#activity-list-id').val(),
    DQ_filterDates: $('#DQ_filterDates').prop("checked"),
    DQ_filterActivities: $('#DQ_filterActivities').prop("checked"),
    DQ_filterGeos: $('#DQ_filterGeos').prop("checked"),
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
    relevantActivitySet: getRelevantActivitySet($('#activity-list-id').val()),
  }
  return filters;
}

// -------------------------------------------------------------------------------------------------

//This replaces the loadRPDE function in Nick's original visualiser adaptation
//Note the displaying of results happens in dq.js now, to improve filtering

function setStoreItems(url, store) {

  store.numPages++;
  addApiPanel(url, true);

  let results = $("#results");
  let progress = $("#progress");

  $.ajax({
    async: true,
    type: 'GET',
    url: '/fetch?url=' + encodeURIComponent(url),
    timeout: 30000
  })
    .done(async function (page) {

      if (store.ingressOrder === 1 && store.numItems === 0) {
        results.empty();
        results.append("<div id='resultsDiv'</div>");
        progress.empty();
        progress.append("<div id='progressDiv1'</div>");

      }
      else if (store.ingressOrder === 2 && store.numItems === 0) {
        progress.append("<div id='progressDiv2'</div>");
      }

      if (store.ingressOrder === 1) {
        progress = $("#progressDiv1");
      } else {
        progress = $("#progressDiv2");
      }

      $.each(page.content ? page.content : page.items, function (_, item) {

        // Processing each item on the page returned from the API

        store.numItems++; // Count total number of records returned

        // For those records that are 'live' in the feed...
        if (item.state === 'updated') {
          //Update the store (check against modified dates for existing items)
          if (!store.items.hasOwnProperty(item.id) || (item.modified > store.items[item.id].modified)) {
            store.items[item.id] = item;
          }
        }
        // For those records that are no longer 'live'...
        else if ((item.state === 'deleted') && store.items.hasOwnProperty(item.id)) {
          //Delete any matching items from the store
          delete store.items[item.id];
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
      if (url !== page.next) {
        progress.empty();
        progress.append("Reading " + store.feedType + " feed: <a href='" + store.firstPage + "'>" + store.firstPage + "</a></br>");
        progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems} in ${elapsed} seconds...</br>`);
        setStoreItems(page.next, store);
      }
      else {
        progress.empty();
        progress.append("Reading " + store.feedType + " feed: <a href='" + store.firstPage + "'>" + store.firstPage + "</a></br>");
        progress.append(`Pages loaded: ${store.numPages}; Items: ${store.numItems}; Completed in ${elapsed} seconds. </br>`);
        if (page.items.length === 0 && store.numItemsMatchFilters === 0 && store.ingressOrder === 1) {
          results.append("<div><p>No results found</p></div>");
        }

        store.lastPage = url;
        clearCache(store);
        setStoreItemKind(store);
        setStoreItemDataType(store);

        //console.log(Array.from(store.uniqueActivities));

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

        // TODO: Modify if an item is deleted and was the only instance of that activity
        updateActivityList(store.uniqueActivities);

        console.log(`Finished loading storeIngressOrder${store.ingressOrder}`);

        if (store.ingressOrder === 1 && storeIngressOrder2.firstPage && link) {
          console.log(`Started loading storeIngressOrder2: ${storeIngressOrder2.firstPage}`);
          setStoreItems(storeIngressOrder2.firstPage, storeIngressOrder2);
        }
        else {
          loadingComplete();
        }
      }
    })
    .fail(function () {
      const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds;
      $("#progress").text(`Pages loaded ${store.numPages}; Items loaded ${store.numItems}; results ${store.numItemsMatchFilters} in ${elapsed} seconds; An error occurred, please retry.`);
      $("#progress").append("An error has occurred");
      $("#progress").append('<div><button class="show-error btn btn-secondary">Retry</button></div>');
      $(".show-error").on("click", function () {
        runForm();
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

function setStoreIngressOrder2FirstPage(feedType1UrlParts, feedType2UrlParts) {
  for (const feedType1UrlPart of feedType1UrlParts) {
    if (storeIngressOrder1.firstPage.includes(feedType1UrlPart)) {
      for (const feedType2UrlPart of feedType2UrlParts) {
        // If the sets of URL parts have been properly defined, then we should never have a match here. If
        // we did, then without this check we would get the same URL for storeIngressOrder1 and storeIngressOrder2,
        // which would be problematic:
        if (feedType1UrlPart !== feedType2UrlPart) {
          let storeIngressOrder2FirstPage = storeIngressOrder1.firstPage.replace(feedType1UrlPart, feedType2UrlPart);
          if (storeIngressOrder2FirstPage in feeds) {
            storeIngressOrder2.firstPage = storeIngressOrder2FirstPage;
            return;
          }
        }
      }
    }
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
  clearCharts();
  $("#resultPanel").hide();
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
    $("#loading-time").show();
  }
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

function clearCharts() {
  if (chart1) { chart1.destroy(); }
  if (chart2) { chart2.destroy(); }
  if (chart3) { chart3.destroy(); }
  if (chart4) { chart4.destroy(); }
  if (chart5) { chart5.destroy(); }
  if (chart6) { chart6.destroy(); }
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
  runDataQuality();
  //console.log(storeItemsForDataQuality);

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
    output.push($("<a/>", {
      "class": "dropdown-item",
      "data-value": concept.id,
      "data-hidden": hidden,
      "data-level": level,
      "href": "#",
      text: label
    }));

    let narrower = concept.getNarrower();
    if (narrower) {
      renderTree(narrower, level + 1, output);
    }
  });
  return output;
}

// -------------------------------------------------------------------------------------------------

function renderActivityList(localScheme) {
  activityListRefresh++;
  let currentSelectedActivity = $('#activity-list-id').val();
  $('#activity-dropdown').empty();
  $('#activity-dropdown').append(`<div class="dropdown hierarchy-select row" id="activity-list-dropdown-${activityListRefresh}">
      <button type="button" class="btn btn-secondary dropdown-toggle form-control ml-1 mr-1" id="activity-list-button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></button>
      <div class="dropdown-menu" style="width: 98%;" aria-labelledby="activity-list-button">
        <div class="hs-searchbox">
          <input type="text" class="form-control" autocomplete="off">
        </div>
        <div class="hs-menu-inner">
          <a class="dropdown-item" data-value="" data-level="1" data-default-selected="" href="#">- Select Activity -</a>
        </div>
      </div>
      <input name="activity-list-id" id="activity-list-id" readonly="readonly" aria-hidden="true" type="hidden"/>
    </div>`);
  $('#activity-list-id').val(currentSelectedActivity);

  // Render the activity list in a format the HierarchySelect will understand
  $(`#activity-list-dropdown-${activityListRefresh} .hs-menu-inner`).append(renderTree(localScheme.getTopConcepts(), 1, []));

  // Initialise the HierarchySelect using the activity list
  $(`#activity-list-dropdown-${activityListRefresh}`).hierarchySelect({
    width: 'auto',

    // Set initial dropdown state based on the hidden field's initial value
    initialValueSet: true,

    // Update other elements when a selection is made
    // (Note the value of the #activity-list-id input is set automatically by HierarchySelect upon selection)
    onChange: function (id) {
      let concept = localScheme.getConceptByID(id);
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

function updateActivityList(filterSet) {
  let filter = Array.from(filterSet);
  let subsetScheme = scheme_1.generateSubset(filter);
  renderActivityList(subsetScheme);
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

function getVisualise(itemId) {
  console.log(itemId)
  $("#resultTab").removeClass("active");
  $("#graphTab").removeClass("disabled");
  $("#graphTab").addClass("active");
  $("#resultPanel").removeClass("active");
  $("#graphPanel").addClass("active");
  $("#tabs")[0].scrollIntoView();

  // Output both relevant feeds if combined
  if (
    storeSuperEvent && Object.values(storeSuperEvent.items).length > 0 &&
    storeSubEvent && Object.values(storeSubEvent.items).length > 0 &&
    link
  ) {
    const storeSubEventItem = storeSubEvent.items[itemId];
    const lastSlashIndex = storeSubEventItem.data[link].lastIndexOf('/');
    const storeSuperEventItemId = storeSubEventItem.data[link].substring(lastSlashIndex + 1);
    // Note that we intentionally use '==' here and not '===' to cater for those storeSuperEventItem.id
    // which are purely numeric and stored as a number rather than a string, so we can still match on
    // storeSuperEventItemId which is always a string:
 
    const storeItemForJson = Object.values(storeSuperEvent.items).find(storeSuperEventItem => storeSuperEventItem.id == storeSuperEventItemId);

    $("#graph").html(`<div class="visual">
    <h2>${storeSuperEvent.itemDataType}
    <button id='validateParent' class='btn btn-secondary btn-sm mb-1'>Validate</button>
    </h2>
    <pre>${JSON.stringify(storeItemForJson, null, 2)}</pre>
    </div>
    <div class="visual">
    <h2>${storeSubEvent.itemDataType}
    <button id='validateChild' class='btn btn-secondary btn-sm mb-1'>Validate</button>
    </h2>
    <pre>${JSON.stringify(storeSubEvent.items[itemId], null, 2)}</pre>
    </div>`);

    $(`#validateParent`).on("click", function () {
      openValidator2(storeItemForJson);
    });
    $(`#validateChild`).on("click", function () {
      openValidator(storeSubEvent, itemId);
    });
  }
  else {
    $("#graph").html(`<div class="visual"><h2>${storeSuperEvent.itemDataType}</h2><pre>${JSON.stringify(storeSuperEvent.items[itemId], null, 2)}</pre></div>
  <div class="visual"><h2>${storeSubEvent.itemDataType}</h2><pre>${JSON.stringify(storeSubEvent.items[itemId], null, 2)}</pre></div>`);
  }
}

// -------------------------------------------------------------------------------------------------

function openValidator(store, itemId) {
  const jsonString = JSON.stringify(store.items[itemId].data, null, 2);
  // console.log(jsonString)
  const url = `https://validator.openactive.io/#/json/${Base64.encodeURI(jsonString)}`;
  const win = window.open(url, "_blank", "height=800,width=1200");
  win.focus();
}
function openValidator2(item) {
  const jsonString = JSON.stringify(item.data, null, 2);
  // console.log(jsonString)
  const url = `https://validator.openactive.io/#/json/${Base64.encodeURI(jsonString)}`;
  const win = window.open(url, "_blank", "height=800,width=1200");
  win.focus();
}

// -------------------------------------------------------------------------------------------------

function clearApiPanel() {
  $("#api").empty();
}

// -------------------------------------------------------------------------------------------------

function addApiPanel(text, code) {
  if (code === undefined) {
    code = true;
  }
  let panel = $("#api");
  let colour = "";
  if (code) {
    colour = "lightgray";
  }
  panel
    .add("<div style='background-color: " + colour + "'><p class='text-wrap' style='word-wrap: break-word'>" + text + "</p></div>")
    .appendTo(panel);
}

// -------------------------------------------------------------------------------------------------

function updateScroll() {
  const element = document.getElementById("api");
  element.scrollTop = element.scrollHeight;
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
  provider = $("#provider").val();
  $("#tabs").hide();
  $("#results").empty();
  $("#progress").empty();
  $("#api").empty();
  //Replicating setEndpoints, without the page reset
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, feed) {
      feeds[feed.url] = feed;
      if (feed.publisherName === $("#provider").val()) {
        $("#endpoint").append("<option value='" + feed.url + "'>" + feed.type + "</option>");
      }
    });
  })
    .done(function () {
      updateParameters("endpoint", $("#endpoint").val());
    });
}

// -------------------------------------------------------------------------------------------------

function updateEndpoint() {
  $("#tabs").hide();
  $("#results").empty();
  $("#progress").empty();
  $("#api").empty();

  //$("#graphTab").addClass("disabled").removeClass("active");
  //$("#validatePanel").addClass("disabled").removeClass("active");
  //$("#validateTab").addClass("disabled").removeClass("active");
  //$("#graphPanel").removeClass("active");
  //$("#resultTab").addClass("active");
  //$("#resultPanel").addClass("active");

  provider = $("#provider").val();
  endpoint = $("#endpoint").val();

  updateParameters("endpoint", endpoint);
  clearForm(endpoint);

  $("#Gender").val("");
  $("#Coverage").val("");
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

function updateDQ_filterDates() {
  DQ_filterDates = $("#DQ_filterDates").prop("checked");
  updateParameters("DQ_filterDates", DQ_filterDates);
  postDataQuality();
}

// -------------------------------------------------------------------------------------------------

function updateDQ_filterActivities() {
  DQ_filterActivities = $("#DQ_filterActivities").prop("checked");
  updateParameters("DQ_filterActivities", DQ_filterActivities);
  postDataQuality();
}


// -------------------------------------------------------------------------------------------------

function updateDQ_filterGeos() {
  DQ_filterGeos = $("#DQ_filterGeos").prop("checked");
  updateParameters("DQ_filterGeos", DQ_filterGeos);
  postDataQuality();
}


// -------------------------------------------------------------------------------------------------

function updateDQ_filterUrls() {
  DQ_filterUrls = $("#DQ_filterUrls").prop("checked");
  updateParameters("DQ_filterUrls", DQ_filterUrls);
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

function clearForm(endpoint) {
  if (endpoint) {
  //  window.location.search = "?endpoint=" + endpoint;
  }
  else {
    window.location.search = "";
  }
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

  $("#tabs").hide();
  $("#results").empty();
  $("#progress").empty();
  $("#api").empty();

  updateScroll();
  $("#progress").append("<div><img src='images/ajax-loader.gif' alt='Loading'></div>");

  clearApiPanel();

  loadingStart();

  clearStore(storeIngressOrder1);
  clearStore(storeIngressOrder2);
  clearStore(storeItemsForDataQuality);

  storeSuperEvent = null;
  storeSubEvent = null;
  link = null;

  storeIngressOrder1.firstPage = $("#endpoint").val();
  storeIngressOrder1.feedType = feeds[storeIngressOrder1.firstPage].hasOwnProperty('type') ? feeds[storeIngressOrder1.firstPage].type : null;

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
    switch (storeIngressOrder1.feedType) {
      case 'SessionSeries':
        setStoreIngressOrder2FirstPage(sessionSeriesUrlParts, scheduledSessionUrlParts);
        break;
      case 'ScheduledSession':
        setStoreIngressOrder2FirstPage(scheduledSessionUrlParts, sessionSeriesUrlParts);
        break;
      case 'FacilityUse':
        setStoreIngressOrder2FirstPage(facilityUseUrlParts, slotUrlParts);
        break;
      case 'IndividualFacilityUse':
        setStoreIngressOrder2FirstPage(individualFacilityUseUrlParts, slotUrlParts);
        break;
      case 'Slot':
        setStoreIngressOrder2FirstPage(slotUrlParts, facilityUseUrlParts.concat(individualFacilityUseUrlParts));
        break;
      default:
        break;
    }
    if (storeIngressOrder2.firstPage) {
      storeIngressOrder2.feedType = feeds[storeIngressOrder2.firstPage].hasOwnProperty('type') ? feeds[storeIngressOrder2.firstPage].type : null;
      if (storeIngressOrder1.feedType === storeIngressOrder2.feedType) {
        console.warn(`Matching feedType for storeIngressOrder1 and storeIngressOrder2 of '${storeIngressOrder1.feedType}'`);
      }
    }
    else {
      console.warn('No storeIngressOrder2 endpoint, can\'t create combined store');
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

  console.log(`Started loading storeIngressOrder1: ${storeIngressOrder1.firstPage}`);
  setStoreItems(storeIngressOrder1.firstPage, storeIngressOrder1, getFilters());
}

// -------------------------------------------------------------------------------------------------

function setPage() {

  $("#provider").on("change", function () {
    updateProvider();
  });
  $("#endpoint").on("change", function () {
    updateEndpoint();
  });
  $("#DQ_filterDates").on("change", function () {
    updateDQ_filterDates();
  });
  $("#DQ_filterActivities").on("change", function () {
    updateDQ_filterActivities();
  });
  $("#DQ_filterGeos").on("change", function () {
    updateDQ_filterGeos();
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

  $("#tabs").hide();

  $("#clear").on("click", function () {
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
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, feed) {
      feeds[feed.url] = feed;
      if (feed.publisherName === $("#provider").val()) {
        $("#endpoint").append("<option value='" + feed.url + "'>" + feed.type + "</option>");
      }
    });
  })
    .done(function () {
      updateParameters("endpoint", $("#endpoint").val());
      setPage();
    });
}

// -------------------------------------------------------------------------------------------------

$(function () {
  // Note: this file should be copied to your server on a nightly cron and served from there
  $.getJSON('https://openactive.io/activity-list/activity-list.jsonld', function (data) {
    // Use SKOS.js to read the file (https://www.openactive.io/skos.js/)
    scheme_1 = new skos.ConceptScheme(data);

    renderActivityList(scheme_1);

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
