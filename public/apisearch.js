let endpoint;
let taxonomyType;
let vocabulary;
let taxonomyTerm;
let proximity;
let coverage;
let childTaxonomyTerm;
let childChildTaxonomyTerm;
let day;
let startTime;
let endTime;
let keywords;
let minAge;
let maxAge;
let viz1;
let taxonomys;
let config;
let store;
let new_store;


// This demo is based on https://neofusion.github.io/hierarchy-select/

// Using source files:
// - https://neofusion.github.io/hierarchy-select/v2/dist/hierarchy-select.min.js
// - https://neofusion.github.io/hierarchy-select/v2/dist/hierarchy-select.min.css
// - https://www.openactive.io/skos.js/dist/skos.min.js

// ** Example of how to render a hierarchy from the activity list **

function renderTree(concepts, level, output) {
  // Recursively .getNarrower() on concepts
  concepts.forEach(function (concept) {
    var label = concept.prefLabel;
    var hidden = "";
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

    var narrower = concept.getNarrower();
    if (narrower) {
      renderTree(narrower, level + 1, output);
    }
  });
  return output;
}


// ** Example of displaying this hierarchy **

var scheme = null;
$(function () {
  // Load the activity list
  // (note this file should be copied to your server on a nightly cron and served from there)
  $.getJSON('https://openactive.io/activity-list/activity-list.jsonld', function (data) {
    // Use SKOS.js to read the file (https://www.openactive.io/skos.js/)
    scheme = new skos.ConceptScheme(data);

    renderActivityList(scheme);

    //console.log(scheme);

    // Note: use the below to set dropdown value elsewhere if necessary
    //$('.activity-list-dropdown').setValue("https://openactive.io/activity-list#72d19892-5f55-4e9c-87b0-a5433baa49c8");
  });
});

activityListRefresh = 0;

function renderActivityList(localScheme) {
  activityListRefresh++;
  var currentSelectedActivity = $('#activity-list-id').val();
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
      var concept = localScheme.getConceptByID(id);
    }
  });
}

function updateActivityList(filterSet) {
  var filter = Array.from(filterSet);
  var subsetScheme = scheme.generateSubset(filter);
  renderActivityList(subsetScheme);
}

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

function updateCoverage() {
  coverage = $("#Coverage").val();
  updateParameters("coverage", coverage);
}

function updateProximity() {
  proximity = $("#Proximity").val();
  updateParameters("proximity", proximity);
}

function updateDay() {
  day = $("#Day").val();
  updateParameters("day", day);
}

function updateStartTime() {
  startTime = $("#StartTime").val();
  updateParameters("startTime", startTime);
}

function updateEndTime() {
  endTime = $("#EndTime").val();
  updateParameters("endTime", endTime);
}

function updateMinAge() {
  minAge = $("#minAge").val();
  updateParameters("minAge", minAge);
}

function updateMaxAge() {
  maxAge = $("#maxAge").val();
  updateParameters("maxAge", maxAge);
}

function updateKeywords() {
  keywords = $("#Keywords").val();
  updateParameters("keywords", keywords);
}

// noinspection SpellCheckingInspection
function updateParameters(parm, parmVal) {
  window.history.replaceState('', '', updateURLParameter(window.location.href, parm, parmVal));
}

function clearForm(endpoint) {

  if (endpoint) {
    window.location.search = "?endpoint=" + endpoint;
  } else {
    window.location.search = "";
  }
}

store = {
  currentStoreId: 0
};
clearStore(store);

new_store = {
  currentStoreId: 0
};
clearStore(new_store);

function clearStore(obj) {
  obj.loadedData = {};
  obj.currentStoreId++;
  obj.itemCount = 0;
  obj.matchingItemCount = 0;
  obj.harvestStart = luxon.DateTime.now();
  obj.pagesLoaded = 0;
  obj.uniqueActivities = new Set();
}

loadingTimeout = null;
loadingDone = false;

function loadingStart() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
  }
  loadingTimeout = setTimeout(loadingTakingTime, 5000);
  loadingDone = false;
}

function loadingTakingTime() {
  if (!loadingDone) {
    $("#loading-time").show();
  }
}

function loadingComplete() {
  loadingDone = true;
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  $("#loading-time").hide();
}

function storeJson(id, json,store) {
  store.loadedData[id] = json;
}

function getJSON(id) {
  getVisualise(id, "json");
}

function getRawJSON(id) {
  let url;
  url = config.schemaType === "OpenReferral" ? $("#endpoint").val() + "/" + "services" + "/complete/" + id : $("#endpoint").val() + "/" + "services" + "/" + id;
  let win = window.open(url, "_blank");
  win.focus();
}

function getVisualise(id, VisType) {
  VisType = VisType || "image";
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

  $("#graph").html(`<pre>${JSON.stringify(store.loadedData[id], null, 2)}</pre>`);
}

function executeForm(pageNumber) {
  if (pageNumber === undefined) {
    pageNumber = null;
  }
  let error = false;
  if ($("#endpoint").val() === "") {
    error = true;
    alert("Missing Endpoint");
  }
  if ($("#TaxonomyType").val() === "") {
    alert("Missing Taxonomy Type");
    error = true;
  }
  if ($("#Proximity").val() !== "") {
    if (isNaN($("#Proximity").val())) {
      alert("Proximity must be a number");
      error = true;
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

  var filters = {
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

  clearStore(store);
  clearStore(new_store);

  $("#progress").text(`Loading first page...`);
  clearApiPanel();

  loadingStart();

  var url = $("#endpoint").val();
  var endpoint = $("#endpoint").val();

  loadRPDEPage(url, store.currentStoreId, filters, endpoint);

}

//Amended to handle embedded subsevents when merging sessions / series 
function resolveProperty(item, prop) {
  return item.data && (item.data.superEvent && item.data.superEvent[prop] || 
    item.data.superEvent && item.data.superEvent.superEvent && item.data.superEvent.superEvent[prop] || 
    item.data[prop]);
}

//Is this working now?
function resolveDate(item, prop) {
  return item.data && (item.data.superEvent && item.data.superEvent.eventSchedule && item.data.superEvent.eventSchedule[prop] || item.data[prop]);
}

function renderSchedule(item) {
  if (item.data && item.data.eventSchedule && Array.isArray(item.data.eventSchedule)) {
    return item.data.eventSchedule.filter(x => Array.isArray(x.byDay)).flatMap(x => x.byDay.map(day => `${day.replace(/https?:\/\/schema.org\//, '')} ${x.startTime}`)).join(', ');
  } else {
    return '';
  }
}

function getRelevantActivitySet(id) {
  var concept = scheme.getConceptByID(id);
  if (concept) {
    return new Set([id].concat(concept.getNarrowerTransitive().map(concept => concept.id)));
  }
  return null;
}

async function loadRPDEPage(url, storeId, filters, endpoint) {

  // Another store has been loaded, so do nothing
  if (storeId !== store.currentStoreId) {
    return;
  }

  store.pagesLoaded++;
  if (store.pagesLoaded < 50) {
    addApiPanel(url, true);
  } else if (store.pagesLoaded === 50) {
    addApiPanel('Page URLs past this point are hidden for efficiency', false);
  }

  let results = $("#results");

  $.ajax({
    async: true,
    type: 'GET',
    url: '/fetch?url=' + encodeURIComponent(url),
    timeout: 30000
  })
  .done(async function (page) {

    if (store.itemCount === 0) {
      results.empty();
      results.append("<div id='resultsDiv' class='container-fluid'></div>");
    }

    results = $("#resultsDiv");

    $.each(page.content ? page.content : page.items, function (_, item) {

      store.itemCount++;

      if (item.state === 'updated') {

        // Update activity list
        var activities = resolveProperty(item, 'activity');
        if (Array.isArray(activities)) {
          activities
          .map(activity => activity.id || activity['@id'])
          .filter(id => id)
          .forEach(id => store.uniqueActivities.add(id));
        }

        //console.log(`Unique Actvities: ${Object.values(store.uniqueActivities)}`);

        //console.log(activities);

        // Filter
        var itemMatchesActivity =
          !filters.relevantActivitySet
            ? true
            : (resolveProperty(item, 'activity') || []).filter(activity =>
                filters.relevantActivitySet.has(activity.id || activity['@id'] || 'NONE')
              ).length > 0;
        var itemMatchesDay =
          !filters.day
            ? true
            :     item.data
              &&  item.data.eventSchedule
              &&  item.data.eventSchedule.filter(x =>
                        x.byDay
                    &&  x.byDay.includes(filters.day)
                    ||  x.byDay.includes(filters.day.replace('https', 'http'))
                  ).length > 0;
        var itemMatchesGender =
          !filters.gender
            ? true
            : resolveProperty(item, 'genderRestriction') === filters.gender;
        if (itemMatchesActivity && itemMatchesDay && itemMatchesGender) {

          store.matchingItemCount++;

          storeJson(item.id, item,store);

          if (store.matchingItemCount < 100) {
            results.append(
              `<div id='col ${store.matchingItemCount}' class='row rowhover'>` +
              `    <div id='text ${store.matchingItemCount}' class='col-md-1 col-sm-2 text-truncate'>${item.id}</div>` +
              `    <div class='col'>${resolveProperty(item, 'name')}</div>` +
              `    <div class='col'>${(resolveProperty(item, 'activity') || []).filter(activity => activity.id || activity['@id']).map(activity => activity.prefLabel).join(', ')}</div>` +
              // `    <div class='col'>${(resolveDate(item, 'startDate') || '')}/div>` +
              // `    <div class='col'>${(resolveDate(item, 'endDate') || '')}/div>` +
              `    <div class='col'>${((item.data && item.data.location && item.data.location.name) || '')}</div>` +
              `    <div class='col'>` +
              `        <div class='visualise'>` +
              `            <div class='row'>` +
              `                <div class='col' style='text-align: right'>` +
              // `                    <button id='${store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1 visualiseButton'>Visualise</button>` +
              `                    <button id='json${store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>JSON</button>` +
              `                    <button id='validate${store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>Validate</button>` +
              `                    <button id='richness${store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>Richness</button>` +
              `                </div>` +
              `            </div>` +
              `        </div>` +
              `    </div>` +
              `</div>`
            );

            $(`#json${store.matchingItemCount}`).on("click", function () {
              getJSON(item.id);
            });
            $(`#validate${store.matchingItemCount}`).on("click", function () {
              openValidator(item.id);
              //getValidate(item.id);
            });
            $(`#richness${store.matchingItemCount}`).on("click", function () {
              getRichness(item.id);
            });

            if (item.id.length > 8) {
              $(`#col${store.matchingItemCount}`).hover(
                function () {
                  $(`#text${store.matchingItemCount}`).removeClass("text-truncate");
                  $(`#text${store.matchingItemCount}`).prop("style", "font-size: 70%");
                },
                function () {
                  $(`#text${store.matchingItemCount}`).addClass("text-truncate");
                  $(`#text${store.matchingItemCount}`).prop("style", "font-size: 100%");
                }
              );
            }

          }
          else if (store.matchingItemCount === 100) {
            results.append(
              "<div class='row rowhover'>" +
              "    <div>Only the first 100 items are shown, the rest are hidden (TODO: Add paging)</div>" +
              "</div>"
            );
          }

        }

      }
      else if (item.state === 'deleted') {
        storeJson(item.id, item,store);
      }

    }); // We have now finished iterating through all items for this page

    let pageNo = page.number ? page.number : page.page;
    let firstPage = "";
    if (page.first === true) {
      firstPage = "disabled='disabled'";
    }

    let lastPage = "";
    if (page.last === true) {
      lastPage = "disabled='disabled'";
    }

    const elapsed = luxon.DateTime.now().diff(store.harvestStart, ['seconds']).toObject().seconds;
    if (url !== page.next) {
      $("#progress").text(`Pages loaded ${store.pagesLoaded}; Items loaded ${store.itemCount}; results ${store.matchingItemCount} in ${elapsed} seconds; Loading...`);
      await loadRPDEPage(page.next, storeId, filters, endpoint);
    }
    else {
      $("#progress").text(`Pages loaded ${store.pagesLoaded}; Items loaded ${store.itemCount}; results ${store.matchingItemCount}; Loading complete in ${elapsed} seconds`);
      if (page.items.length === 0 && store.matchingItemCount === 0) {
        results.append("<div><p>No results found</p></div>");
      }
      updateActivityList(store.uniqueActivities);
      loadingComplete();
      postText();
      await postQuality(endpoint);
    }

  })
  .fail(function () {
    const elapsed = luxon.DateTime.now().diff(store.harvestStart, ['seconds']).toObject().seconds;
    $("#progress").text(`Pages loaded ${store.pagesLoaded}; Items loaded ${store.itemCount}; results ${store.matchingItemCount} in ${elapsed} seconds; An error occurred, please retry.`);
    $("#results").empty().append("An error has occurred");
    $("#results").append('<div><button class="show-error btn btn-secondary">Retry</button></div>');
    $(".show-error").on("click", function () {
      executeForm();
    });
  });
}

function populateEndpointsFromJson() {
  $.getJSON("/feeds", function (data) {
    $("#endpoint").empty();
    $.each(data.feeds, function (index, item) {
      $("#endpoint").append("<option value='" + item.url + "'>" + item.name + " - " + item.kind + "</option>");
    });
  }).done(function () {
    setupPageEndpoints();
  });
}

function getRawJSON(id) {
  let url;
  url = config.schemaType === "OpenReferral" ? $("#endpoint").val() + "/" + "services" + "/complete/" + id : $("#endpoint").val() + "/" + "services" + "/" + id;
  let win = window.open(url, "_blank");
  win.focus();
}

function openValidator(id) {
  const jsonString = JSON.stringify(store.loadedData[id], null, 2);
  console.log(jsonString)
  const url = `https://validator.openactive.io/#/json/${Base64.encodeURI(jsonString)}`;
  const win = window.open(url, "_blank", "height=800,width=1200");
  win.focus();
}

function getValidate(id) {
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

  let url = $("#endpoint").val() + "/services/" + id;

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

function getRichness(id) {
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
    url = $("#endpoint").val() + "/services/complete/" + id;
  } else {
    url = $("#endpoint").val() + "/" + id;
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

function postRichness(data) {
  let url = "https://api.porism.com/ServiceDirectoryService/services/richness";
  // console.log(data);
  // console.log(typeof data);
  // console.log(JSON.stringify(data));
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
    JSON.stringify(data), "json")
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


function clearApiPanel() {
  $("#api").empty();
}

function addApiPanel(text, code) {
  if (code === undefined) {
    code = true;
  }
  let panel = $("#api");
  let colour = "";
  if (code) {
    colour = "lightgray";
  }
  panel.add("<div style='background-color: " + colour + "'><p class='text-wrap' style='word-wrap: break-word'>" + text + "</p></div>")
    .appendTo(panel);
}

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
  } else {
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

function updateScroll() {
  const element = document.getElementById("api");
  element.scrollTop = element.scrollHeight;
}

function setupPage() {
  populateEndpointsFromJson();
}

function setupPageEndpoints() {

  $("#endpoint").on("change", function () {
    updateEndpoint();
  });

  $("#clear").on("click", function () {
    clearForm($("#endpoint").val());
  });
  $("#execute").on("click", function () {
    executeForm();
  });
  $("#TaxonomyType").on("change", function () {
    updateTaxonomyType();
  });
  $("#Keywords").on("change", function () {
    updateKeywords();
  });
  $("#Gender").on("change", function () {
  });
  $("#TaxonomyTerm").on("change", function () {
    updateTaxonomyTerm();
  });
  $("#ChildTaxonomyTerm").on("change", function () {
    updateChildTaxonomyTerm();
  });
  $("#ChildChildTaxonomyTerm").on("change", function () {
    updateChildChildTaxonomyTerm();
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


  $("#tabs").hide();

  if (getUrlParameter("endpoint") !== undefined) {
    $("#endpoint").val(getUrlParameter("endpoint"));
    $.getJSON("/feeds", function (data) {
      $.each(data.feeds, function (index, item) {
        if (item.url === $("#endpoint option:selected").val()) {
          config = item;
        }
      });
    }).done(function () {
      updateEndpointUpdate()
      if (getUrlParameter("execute") === "true") {
        executeForm();
      }
    });
  } else {
    updateParameters("endpoint", $("#endpoint").val());
    setupPage();
  }
}

$(function () {
  setupPage();
});
