let config;
let endpoint;
let scheme_1 = null;
let scheme_2 = null;

let activityListRefresh = 0;

let loadingTimeout = null;
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

let feeds = {};

let superEventFeedTypes = ['SessionSeries', 'FacilityUse', 'IndividualFacilityUse'];
let subEventFeedTypes = ['ScheduledSession', 'Slot'];

let storeSuperEvent = {};
let storeSubEvent = {};

// These will simply point to storeSuperEvent and storeSubEvent:
let storeIngressOrder1 = null;
let storeIngressOrder2 = null;

let uniqueUrlStems = [];
let link = null; // Linking variable between super-event and sub-event feeds

let numListingsForDisplay = 0;
let numOppsForDisplay = 0;

// -------------------------------------------------------------------------------------------------

function clearStore(store) {
  store.items = {};
  store.ingressOrder = null;
  store.feedType = null;
  store.itemDataType = null;
  store.firstPage = null;
  store.lastPage = null;
  store.numPages = 0;
  store.numItems = 0;
  store.numItemsMatchFilters = 0;
  store.timeHarvestStart = luxon.DateTime.now();
  store.uniqueActivities = new Set();
}

clearStore(storeSuperEvent);
clearStore(storeSubEvent);

// -------------------------------------------------------------------------------------------------

//This replaces the loadRPDE function in Nick's original visualiser adaptation
function setStoreItems(url, store, filters) {

  store.numPages++;
  if (store.numPages < 50) {
    addApiPanel(url, true);
  }
  else if (store.numPages === 50) {
    addApiPanel('Page URLs past this point are hidden for efficiency', false);
  }

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
      progress = $("#progressDiv2");
    }

    results = $("#resultsDiv");
    if (store.ingressOrder === 1) {
      progress = $("#progressDiv1");
      progress_text = "Selected feed:"
    } else {
      progress = $("#progressDiv2");
      progress_text = "Related feed:"
    }
    $.each(page.content ? page.content : page.items, function (_, item) {

      store.numItems++;

      if (item.state === 'updated') {

        let activities = resolveProperty(item, 'activity');
        if (Array.isArray(activities)) {
          activities
            .map(activity => activity.id || activity['@id'])
            .filter(activityId => activityId)
            .forEach(activityId => store.uniqueActivities.add(activityId));
        }

        //console.log(`Unique Actvities: ${Object.values(store.uniqueActivities)}`);

        //console.log(activities);

        let itemMatchesActivity =
          !filters.relevantActivitySet
            ? true
            : (resolveProperty(item, 'activity') || []).filter(activity =>
              filters.relevantActivitySet.has(activity.id || activity['@id'] || 'NONE')
            ).length > 0;
        let itemMatchesDay =
          !filters.day
            ? true
            : item.data
            && item.data.eventSchedule
            && item.data.eventSchedule.filter(x =>
              x.byDay
              && x.byDay.includes(filters.day)
              || x.byDay.includes(filters.day.replace('https', 'http'))
            ).length > 0;
        let itemMatchesGender =
          !filters.gender
            ? true
            : resolveProperty(item, 'genderRestriction') === filters.gender;

        if (itemMatchesActivity &&
          itemMatchesDay &&
          itemMatchesGender) {
          let itemMatchesFilters =
            itemMatchesActivity &&
            itemMatchesDay &&
            itemMatchesGender;

          if (!store.items.hasOwnProperty(item.id)) {
            store.numItemsMatchFilters++;
          }
          if (itemMatchesFilters) {

            if (!store.items.hasOwnProperty(item.id) ||
              (item.modified > store.items[item.id].modified)) {
              store.items[item.id] = item;
            }
            if (store.ingressOrder === 1) {
              if (store.numItemsMatchFilters < 100) {

                results.append(
                  `<div id='col ${store.numItemsMatchFilters}' class='row rowhover'>` +
                  `    <div id='text ${store.numItemsMatchFilters}' class='col-md-1 col-sm-2 text-truncate'>${item.id}</div>` +
                  `    <div class='col'>${(resolveProperty (item, 'name') || '')}</div>` +
                  `    <div class='col'>${(resolveProperty(item, 'activity') || []).filter(activity => activity.id || activity['@id']).map(activity => activity.prefLabel).join(', ')}</div>` +
                  `    <div class='col'>${(getProperty(item, 'startDate') || '')}</div>` +
                  `    <div class='col'>${(getProperty(item, 'endDate') || '')}</div>` +
                  `    <div class='col'>${((item.data && item.data.location && item.data.location.name) || '')}</div>` +
                  `    <div class='col'>` +
                  `        <div class='visualise'>` +
                  `            <div class='row'>` +
                  `                <div class='col' style='text-align: right'>` +
                  // `                    <button id='${store.numItemsMatchFilters}' class='btn btn-secondary btn-sm mb-1 visualiseButton'>Visualise</button>` +
                  `                    <button id='json${store.numItemsMatchFilters}' class='btn btn-secondary btn-sm mb-1'>JSON</button>` +
                  `                    <button id='validate${store.numItemsMatchFilters}' class='btn btn-secondary btn-sm mb-1'>Validate</button>` +
                  //`                    <button id='richness${store.numItemsMatchFilters}' class='btn btn-secondary btn-sm mb-1'>Richness</button>` +
                  `                </div>` +
                  `            </div>` +
                  `        </div>` +
                  `    </div>` +
                  `</div>`
                );

                $(`#json${store.numItemsMatchFilters}`).on("click", function () {
                  getVisualise(store, item.id);
                });
                $(`#validate${store.numItemsMatchFilters}`).on("click", function () {
                  openValidator(store, item.id);
                  //getValidate(item.id);
                });
                $(`#richness${store.numItemsMatchFilters}`).on("click", function () {
                  getRichness(store, item.id);
                });

                if (item.id.length > 8) {
                  $(`#col${store.numItemsMatchFilters}`).hover(
                    function () {
                      $(`#text${store.numItemsMatchFilters}`).removeClass("text-truncate");
                      $(`#text${store.numItemsMatchFilters}`).prop("style", "font-size: 70%");
                    },
                    function () {
                      $(`#text${store.numItemsMatchFilters}`).addClass("text-truncate");
                      $(`#text${store.numItemsMatchFilters}`).prop("style", "font-size: 100%");
                    }
                  );
                }

              }
              else if (store.numItemsMatchFilters === 100) {
                results.append(
                  "<div class='row rowhover'>" +
                  "    <div>Only the first 100 items are shown, the rest are hidden (TODO: Add paging)</div>" +
                  "</div>"
                );
              }
            }
          }

        }

      }
      else if ((item.state === 'deleted') &&
        store.items.hasOwnProperty(item.id)) {
        delete store.items[item.id];
        store.numItemsMatchFilters--;
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

    const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds;
    if (url !== page.next) {
      progress.empty();
      progress.text(`${progress_text} Pages loaded: ${store.numPages}; Items: ${store.numItems}; Results: ${store.numItemsMatchFilters} in ${elapsed} seconds...`);
      setStoreItems(page.next, store, filters);
    }
    else {
      progress.text(`${progress_text} Pages loaded: ${store.numPages}; Items: ${store.numItems}; Results: ${store.numItemsMatchFilters}; Loading complete in ${elapsed} seconds`);
      if (page.items.length === 0 && store.numItemsMatchFilters === 0) {
        results.append("<div><p>No results found</p></div>");
      }

      store.lastPage = url;
      setStoreItemDataType(store);
      updateActivityList(store.uniqueActivities); // TODO: Modify if an item has been deleted and was the only instance of that activity

      // TODO: This is currently superfluous, check if still needed
      if (subEventFeedTypes.includes(store.feedType)) {
        setUniqueUrlStems();
      }

      console.log(`Finished loading storeIngressOrder${store.ingressOrder}`);

      if (store.ingressOrder === 1) {
        console.log(`Started loading storeIngressOrder2`);
        setStoreItems(storeIngressOrder2.firstPage, storeIngressOrder2, filters);
      }
      else if (store.ingressOrder === 2) {
        loadingComplete();
      }
    }
  })
  .fail(function () {
    const elapsed = luxon.DateTime.now().diff(store.timeHarvestStart, ['seconds']).toObject().seconds;
    $("#progress").text(`Pages loaded ${store.numPages}; Items loaded ${store.numItems}; results ${store.numItemsMatchFilters} in ${elapsed} seconds; An error occurred, please retry.`);
    $("#results").empty().append("An error has occurred");
    $("#results").append('<div><button class="show-error btn btn-secondary">Retry</button></div>');
    $(".show-error").on("click", function () {
      runForm();
    });
  });
}

// -------------------------------------------------------------------------------------------------

//Amended to handle embedded subsevents when merging sessions / series
function resolveProperty(item, prop) {
  return item.data && ((item.data.superEvent && item.data.superEvent[prop]) ||
    (item.data.superEvent && item.data.superEvent.superEvent && item.data.superEvent.superEvent[prop]) ||
    item.data[prop]);
}

// -------------------------------------------------------------------------------------------------

function resolveDate(item, prop) {
  return item.data &&
  (item.data.superEvent && item.data.superEvent.eventSchedule && item.data.superEvent.eventSchedule[prop] ||
    item.data[prop]);
}

// -------------------------------------------------------------------------------------------------

function setStoreItemDataType(store) {
  let itemDataTypes = Object.values(store.items).map(item => {
    if (item.data && ((typeof item.data.type === 'string') || (typeof item.data['@type'] === 'string'))) {
      return item.data.type || item.data['@type'];
    }
  }).filter(itemDataType => itemDataType);

  let uniqueitemDataTypes = [...new Set(itemDataTypes)];

  switch (uniqueitemDataTypes.length) {
    case 0:
      store.itemDataType = null;
      break;
    case 1:
      store.itemDataType = uniqueitemDataTypes[0];
      break;
    default:
      store.itemDataType = 'mixed';
      break;
  }

  if (store.feedType !== store.itemDataType) {
    console.warn(`Feed type (${store.feedType}) doesn\'t match item data type (${store.itemDataType})`);
  }
}

// -------------------------------------------------------------------------------------------------

// TODO: This is currently superfluous, check if still needed
function setUniqueUrlStems() {
  const urlStems = Object.values(storeSubEvent.items).reduce((accumulator, item) => {
    if (link && item.data && item.data[link]) {
      const lastSlashIndex = item.data[link].lastIndexOf('/');
      const urlStem = item.data[link].substring(0, lastSlashIndex);
      accumulator.push(urlStem);
    }
    return accumulator;
  }, []);

  // Can be used as a check of the url(s) for related feeds
  uniqueUrlStems = [...new Set(urlStems)];

  // console.log(`Unique URL stems of storeSubEvent: ${uniqueUrlStems}`);
}

// -------------------------------------------------------------------------------------------------

function loadingStart() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
  }
  loadingTimeout = setTimeout(loadingTakingTime, 5000);
  loadingDone = false;
}

// -------------------------------------------------------------------------------------------------

function loadingTakingTime() {
  if (!loadingDone) {
    $("#loading-time").show();
  }
}

// -------------------------------------------------------------------------------------------------

function loadingComplete() {
  loadingDone = true;

  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  $("#loading-time").hide();

  runDataQuality();
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

// function getRawJSON(id) {
//   let url;
//   url = config.schemaType === "OpenReferral" ? $("#endpoint").val() + "/" + "services" + "/complete/" + id : $("#endpoint").val() + "/" + "services" + "/" + id;
//   let win = window.open(url, "_blank");
//   win.focus();
// }

// -------------------------------------------------------------------------------------------------

function getVisualise(store, itemId) {
  $("#resultTab").removeClass("active");
  $("#validateTab").removeClass("active");
  $("#graphTab").addClass("active");
  $("#resultPanel").removeClass("active");
  $("#validatePanel").removeClass("active");
  $("#graphPanel").addClass("active");
  $("#tabs")[0].scrollIntoView();
  $("#graphTab").removeClass("disabled");
  $("#validateTab").addClass("disabled");
  $("#validateTab").hide();
  $("#richnessTab").hide();
  $("#graph").html(`<pre>${JSON.stringify(store.items[itemId], null, 2)}</pre>`);
}

// -------------------------------------------------------------------------------------------------

function openValidator(store, itemId) {
  const jsonString = JSON.stringify(store.items[itemId], null, 2);
  // console.log(jsonString)
  const url = `https://validator.openactive.io/#/json/${Base64.encodeURI(jsonString)}`;
  const win = window.open(url, "_blank", "height=800,width=1200");
  win.focus();
}

// -------------------------------------------------------------------------------------------------

function getValidate(itemId) {
  $("#resultTab").removeClass("active");
  $("#resultPanel").removeClass("active");

  $("#graphTab").removeClass("active");
  $("#graphPanel").removeClass("active");

  $("#validateTab").addClass("active");
  $("#validatePanel").addClass("active");
  $("#tabs")[0].scrollIntoView();
  $("#validateTab").removeClass("disabled");

  $("#richnessTab").hide();
  $("#validateTab").show();

  let url = $("#endpoint").val() + "/services/" + itemId;

  addApiPanel("Get JSON for validate", false);
  addApiPanel(url);
  addApiPanel('<button class="btn btn-secondary" onclick=\'win = window.open("' + url + '", "_blank"); win.focus()\'>Show results</button>', false);
  updateScroll();

  $.ajax({
    async: true,
    type: 'GET',
    url: url,
    dataType: "json"
  })
    .done(function (data) {
      postValidate(data);
    });
}

// -------------------------------------------------------------------------------------------------

function postValidate(data) {
  let url = "https://api.porism.com/ServiceDirectoryService/services/validate";

  addApiPanel("Post JSON for validate", false);
  addApiPanel(url);
  updateScroll();

  $("#validatePanel").empty();
  $("#validatePanel").append('<img alt="loading" src="images/ajax-loader.gif">');

  $.post({ url: url, contentType: "application/json" }, JSON.stringify(data), function (resBody) {
    $("#validatePanel").empty();
    $("#validatePanel").append('<h5>' + data.name + '</h5><h6>' + data.id + '</h6>');
    $("#validatePanel").append("<h5>Issues</h5>");
    for (let i = 0; i < resBody.length; i++) {
      $("#validatePanel").append("<p>" + resBody[i].message + "</p>");
    }
  }, "json");
}

// -------------------------------------------------------------------------------------------------

function getRichness(store, itemId) {
  $("#resultTab").removeClass("active");
  $("#resultPanel").removeClass("active");

  $("#graphTab").removeClass("active");
  $("#graphPanel").removeClass("active");

  $("#validateTab").removeClass("active");
  $("#validatePanel").removeClass("active");

  $("#richnessTab").addClass("active");
  $("#richnessPanel").addClass("active");

  $("#tabs")[0].scrollIntoView();
  $("#richnessTab").removeClass("disabled");

  $("#validateTab").hide();

  $("#richnessTab").show();

  let url;
  if (config.schemaType === "OpenReferral") {
    url = store.firstPage + "/services/complete/" + itemId;
  } else {
    url = store.firstPage + "/" + itemId;
  }

  addApiPanel("Get JSON for richness", false);
  addApiPanel(url);
  addApiPanel('<button class="btn btn-secondary" onclick=\'win = window.open("' + url + '", "_blank"); win.focus()\'>Show results</button>', false);
  updateScroll();

  $.ajax({
    async: true,
    type: 'GET',
    url: url,
    dataType: "json"
  })
    .done(function (data) {
      postRichness(data);
    });
}

// -------------------------------------------------------------------------------------------------

function postRichness(data) {
  let url = "https://api.porism.com/ServiceDirectoryService/services/richness";

  addApiPanel("Post JSON for richness", false);
  addApiPanel(url);
  updateScroll();

  $("#richness").empty();
  $("#richness").append('<img alt="loading" src="images/ajax-loader.gif">');

  $.post(
    {
      url: url,
      contentType: "application/json"
    },
    JSON.stringify(data),
    "json"
  )
    .done(function (resBody) {
      $("#richness").empty();
      if (resBody.populated === undefined && resBody.not_populated === undefined) {
        $("#richness").append("<h3>Error</h3><p>" + resBody[0].message + "</p>");
        return;
      }
      $("#richness").append('<h5>' + (data.name || (data.superEvent && data.superEvent.name)) + '</h5><h6>' + data.id + '</h6>');
      let Richness = "";
      let populated = "";
      for (let i = 0; i < resBody.populated.length; i++) {
        populated = populated + "<div class='row rowhover'><div class='col-sm-8'>" + resBody.populated[i].name + "</div><div class='col-sm-4'>" + resBody.populated[i].percentage + "%</div></div>";
      }
      Richness = Richness + "<div class='card-group mt-2'>";
      Richness = Richness + (
        '<div class="card">' +
        '<div class="card-header bg-light"><h4>Populated</h4></div>' +
        '<div class="card-body">' + populated + '</div>' +
        '</div>');

      let not_populated = "";
      for (let i = 0; i < resBody.not_populated.length; i++) {
        not_populated = not_populated + "<div class='row rowhover'><div class='col-sm-8'>" + resBody.not_populated[i].name + "</div><div class='col-sm-4'>" + resBody.not_populated[i].percentage + "%</div></div>";
      }
      Richness +=
        '<div class="card">' +
        '<div class="card-header bg-light"><h4>Not populated</h4></div>' +
        '<div class="card-body">' + not_populated + '</div>' +
        '</div></div>';

      $("#richness").append(Richness);

      $("#richness").append("<h3>Overall</h3>" +
        "<p>Score: " + resBody.richness_percentage + "%</p>");
    })
    .fail(function (error) {
      $("#richness").empty().append("<div>An error has occurred</div>");
      $("#richness").append('<div>' + error.responseJSON.message + '</div>');
    });

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

function updateEndpoint() {
  $("#results").empty();
  $("#graphTab").addClass("disabled").removeClass("active");
  $("#validatePanel").addClass("disabled").removeClass("active");
  $("#validateTab").addClass("disabled").removeClass("active");
  $("#graphPanel").removeClass("active");
  $("#resultTab").addClass("active");
  $("#resultPanel").addClass("active");

  endpoint = $("#endpoint").val();
  updateParameters("endpoint", endpoint);
  clearForm(endpoint);

  $("#Gender").val("");
  $("#TaxonomyTerm").val("");
  $("#Coverage").val("");
}

// -------------------------------------------------------------------------------------------------

function updateEndpointUpdate() {
  if (endpoint !== "") {
    // $("#TaxonomyType").prop('disabled', false);
    // $("#Gender").prop('disabled', false);
    $("#execute").prop('disabled', false);
  }
  if (endpoint === "") {
    $("#TaxonomyType").prop('disabled', true);
    $("#Vocabulary").prop('disabled', true);
    $("#TaxonomyTerm").prop('disabled', true);
    $("#execute").prop('disabled', false);
  }
  // updateParameters("execute", true);
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
    window.location.search = "?endpoint=" + endpoint;
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
  if ($("#TaxonomyType").val() === "") {
    error = true;
    alert("Missing Taxonomy Type");
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

  $("#results").empty();
  $("#tabs").show();
  $("#results").empty();
  $("#graphTab").addClass("disabled").removeClass("active");
  $("#graphPanel").removeClass("active");
  $("#validateTab").removeClass("active").hide();
  $("#validatePanel").removeClass("active");
  $("#richnessTab").removeClass("active").hide();
  $("#richnessPanel").removeClass("active");
  $("#resultTab").addClass("active");
  $("#resultPanel").addClass("active");

  filters = {
    activity: $('#activity-list-id').val(),
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

  updateScroll();
  $("#results").append("<div><img src='images/ajax-loader.gif' alt='Loading'></div>");
  $("#progress").text(`Loading first page...`);
  clearApiPanel();

  loadingStart();

  clearStore(storeSuperEvent);
  clearStore(storeSubEvent);
  link = null;

  let storeIngressOrder1FeedTypeKnown = null;
  if (superEventFeedTypes.includes(feeds[$("#endpoint").val()].type)) {
    storeIngressOrder1FeedTypeKnown = true;
    storeIngressOrder1 = storeSuperEvent;
    storeIngressOrder2 = storeSubEvent;
  }
  else if (subEventFeedTypes.includes(feeds[$("#endpoint").val()].type)) {
    storeIngressOrder1FeedTypeKnown = true;
    storeIngressOrder1 = storeSubEvent;
    storeIngressOrder2 = storeSuperEvent;
  }
  else {
    console.error('Unknown initial store feed type, can\'t begin');
  }

  if (storeIngressOrder1FeedTypeKnown) {
    storeIngressOrder1.ingressOrder = 1;
    storeIngressOrder1.firstPage = $("#endpoint").val();
    storeIngressOrder1.feedType = feeds[storeIngressOrder1.firstPage].type;

    // TODO: We used to include this in the following ScheduledSession and Slot conditions, but not now
    // in order to get storeIngressOrder2 regardless. Is the uniqueUrlStems stuff now obsolete?
    //   && uniqueUrlStems.length > 0
    storeIngressOrder2.ingressOrder = 2;
    if (storeIngressOrder1.feedType === 'SessionSeries') {
      storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('session-series', 'scheduled-sessions');
    }
    else if (storeIngressOrder1.feedType === 'ScheduledSession') {
      storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('scheduled-sessions', 'session-series');
    }
    else if (storeIngressOrder1.feedType === 'FacilityUse') {
      storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('facility-uses', 'slots');
    }
    else if (storeIngressOrder1.feedType === 'IndividualFacilityUse') {
      storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('individual-facility-uses', 'slots');
    }
    else if (storeIngressOrder1.feedType === 'Slot') {
      storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('slots', 'facility-uses');
      if (!(storeIngressOrder2.firstPage in feeds)) {
        storeIngressOrder2.firstPage = storeIngressOrder1.firstPage.replace('slots', 'individual-facility-uses');
        if (!(storeIngressOrder2.firstPage in feeds)) {
          storeIngressOrder2.firstPage = null;
        }
      }
    }
    if (storeIngressOrder2.firstPage) {
      storeIngressOrder2.feedType = feeds[storeIngressOrder2.firstPage].type;
    }

    if (storeSubEvent.feedType === 'ScheduledSession') {
      link = 'superEvent';
    }
    else if (storeSubEvent.feedType === 'Slot') {
      link = 'facilityUse';
    }
    if (!link) {
      console.warn('No feed linking variable, can\'t create combined store');
    }

    console.log(`storeIngressOrder1 endpoint: ${storeIngressOrder1.firstPage}`);
    console.log(`storeIngressOrder2 endpoint: ${storeIngressOrder2.firstPage}`);

    console.log(`Started loading storeIngressOrder1`);
    setStoreItems(storeIngressOrder1.firstPage, storeIngressOrder1, filters);
  }
}

// -------------------------------------------------------------------------------------------------

function setPage() {

  $("#endpoint").on("change", function () {
    updateEndpoint();
  });
  // $("#TaxonomyType").on("change", function () {
  //   updateTaxonomyType(); // TODO: This function doesn't exist ... needed???
  // });
  // $("#TaxonomyTerm").on("change", function () {
  //   updateTaxonomyTerm(); // TODO: This function doesn't exist ... needed???
  // });
  // $("#ChildTaxonomyTerm").on("change", function () {
  //   updateChildTaxonomyTerm(); // TODO: This function doesn't exist ... needed???
  // });
  // $("#ChildChildTaxonomyTerm").on("change", function () {
  //   updateChildChildTaxonomyTerm(); // TODO: This function doesn't exist ... needed???
  // });
  // $("#Gender").on("change", function () {
  //   // TODO: This function doesn't exist ... needed???
  // });
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
    runForm();
  });

  if (getUrlParameter("endpoint") !== undefined) {
    $("#endpoint").val(getUrlParameter("endpoint"));
    $.getJSON("/feeds", function (data) {
      $.each(data.feeds, function (index, feed) {
        if (feed.url === $("#endpoint option:selected").val()) {
          config = feed;
        }
      });
    })
      .done(function () {
        updateEndpointUpdate();
        if (getUrlParameter("execute") === "true") {
          runForm();
        }
      });
  }
  else {
    updateParameters("endpoint", $("#endpoint").val());
    setEndpoints();
  }
}

// -------------------------------------------------------------------------------------------------

function setEndpoints() {
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, feed) {
      feeds[feed.url] = feed;
      $("#endpoint").append("<option value='" + feed.url + "'>" + feed.name + " - " + feed.type + "</option>");
    });
  })
    .done(function () {
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

    //console.log(scheme_2);

  });
});

// -------------------------------------------------------------------------------------------------

$(function () {
  setEndpoints();
});
