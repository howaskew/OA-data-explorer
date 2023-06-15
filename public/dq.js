// TODO: This needs a depth-of-search cap
function getProperty(obj, keyToGet) {
  for (const key in obj) {
    if (key === keyToGet) {
      return obj[key];
    }
    else if (typeof obj[key] === 'object') {
      const val = getProperty(obj[key], keyToGet);
      if (val) {
        return val;
      }
    }
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function matchToActivityList(id) {
  let concept = scheme_1.getConceptByID(id);
  if (concept) {
    return concept.prefLabel;
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function matchToFacilityList(id) {
  let concept = scheme_2.getConceptByID(id);
  if (concept) {
    return concept.prefLabel;
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------------------------------------------------------------

function setJSONButton(newActiveJSONButton) {
  if (activeJSONButton) {
    activeJSONButton.style.backgroundColor = inactiveJSONButtonColor;
  }
  activeJSONButton = newActiveJSONButton;
  activeJSONButton.style.backgroundColor = activeJSONButtonColor;
}

// -------------------------------------------------------------------------------------------------

// Pulling the display of results out of the API paging loop
// This is to allow the DQ filters to be applied along with original filters

function postResults(item) {
  results = $("#resultsDiv");
  results.append(
    `<div id='row${storeDataQuality.numFilteredItems}' class='row rowhover'>` +
    `    <div id='text${storeDataQuality.numFilteredItems}' class='col-md-1 col-sm-2 text-truncate'>${item.id || item.data['@id']}</div>` +
    `    <div class='col'>${(resolveProperty(item, 'name') || '')}</div>` +
    `    <div class='col'>${(resolveProperty(item, 'activity') || []).filter(activity => activity.id || activity['@id']).map(activity => activity.prefLabel).join(', ')}</div>` +
    `    <div class='col'>${(getProperty(item, 'startDate') || '')}</div>` +
    `    <div class='col'>${(getProperty(item, 'endDate') || '')}</div>` +
    `    <div class='col'>${((item.data && item.data.location && item.data.location.name) || (item.data && item.data.superEvent && item.data.superEvent.location && item.data.superEvent.location.name) || '')}</div>` +
    `    <div class='col'>` +
    `        <div class='visualise'>` +
    `            <div class='row'>` +
    `                <div class='col' style='text-align: right'>` +
    `                    <button id='json${storeDataQuality.numFilteredItems}' class='btn btn-secondary btn-sm mb-1' style='background: ${inactiveJSONButtonColor}'>Show JSON</button>` +
    `                </div>` +
    `            </div>` +
    `        </div>` +
    `    </div>` +
    `</div>`
  );

  if (storeDataQuality.numFilteredItems === 1) {
    setJSONButton(document.getElementById('json1'));
    setJSONTab(item.id || item.data['@id'], false);
  }

  $(`#json${storeDataQuality.numFilteredItems}`).on('click', function () {
    setJSONButton(this);
    setJSONTab(item.id || item.data['@id'], true);
  });

  if ((item.id && item.id.length > 8) || (item.data['@id'] && item.data['@id'].length > 8)) {
    $(`#row${storeDataQuality.numFilteredItems}`).hover(
      function () {
        $(`#text${storeDataQuality.numFilteredItems}`).removeClass("text-truncate");
        $(`#text${storeDataQuality.numFilteredItems}`).prop("style", "font-size: 70%");
      },
      function () {
        $(`#text${storeDataQuality.numFilteredItems}`).addClass("text-truncate");
        $(`#text${storeDataQuality.numFilteredItems}`).prop("style", "font-size: 100%");
      }
    );
  }
}

// -------------------------------------------------------------------------------------------------

function setStoreDataQualityItems() {
  storeSuperEventContentType = null;
  storeSubEventContentType = null;

  // First check for any unpacking of superevents or eventschedules
  if (
    storeSuperEvent &&
    !link
  ) {
    cp.text("Unpacking Data Feed");

    console.log(`Number of storeSuperEvent items: ${Object.values(storeSuperEvent.items).length}`);
    console.log(`storeSuperEvent feed type: ${storeSuperEvent.feedType}`);
    console.log(`storeSuperEvent item kind: ${storeSuperEvent.itemKind}`);
    console.log(`storeSuperEvent item data type: ${storeSuperEvent.itemDataType}`);

    console.log(`Number of storeSubEvent items: ${Object.values(storeSubEvent.items).length}`);
    console.log(`storeSubEvent feed type: ${storeSubEvent.feedType}`);
    console.log(`storeSubEvent item kind: ${storeSubEvent.itemKind}`);
    console.log(`storeSubEvent item data type: ${storeSubEvent.itemDataType}`);

    if (subEventFeedTypes.includes(storeSuperEvent.itemDataType)) {
      // This is actually a subEvent feed but was initially labelled as a superEvent feed due to feedType.
      // e.g. BwD
      console.log("1");
      cp.text("Unpacking data feed - subEvent feed with embedded superEvent data");

      storeSubEvent = storeSuperEvent;
      storeSuperEvent = null;
      storeSubEvent.feedType = null;
      link = 'superEvent';
      storeDataQuality.items = Object.values(storeSubEvent.items);
    }
    else if (
      Object.values(storeSuperEvent.items)
        .filter(item => item.hasOwnProperty('data') && item.data.hasOwnProperty('subEvent'))
        .length > 0
    ) {
      // e.g. SportSuite
      console.log("2");
      cp.text("Unpacking data feed - superEvent feed with embedded subEvent data");

      storeSubEvent.items = {};
      for (const storeSuperEventItem of Object.values(storeSuperEvent.items)) {
        if (storeSuperEventItem.data && storeSuperEventItem.data.subEvent && Array.isArray(storeSuperEventItem.data.subEvent)) {
          const { subEvent, ...newStoreSuperEventItem } = storeSuperEventItem.data;
          for (const subEvent of storeSuperEventItem.data.subEvent) {
            const subEventId = subEvent.id || subEvent['@id'];
            storeSubEvent.items[subEventId] = {
              data: Object.assign({}, subEvent, { superEvent: Object.assign({}, newStoreSuperEventItem) })
            };
          }
        }
      }
      setStoreItemDataType(storeSubEvent);
      link = 'superEvent';
      storeDataQuality.items = Object.values(storeSubEvent.items);
    }
  }
  else if (
    storeSuperEvent && Object.values(storeSuperEvent.items).length > 0 &&
    storeSubEvent && Object.values(storeSubEvent.items).length > 0 &&
    link
  ) {
    console.log("3");

    storeCombinedItems = [];

    for (let [storeSubEventItemIdx, storeSubEventItem] of Object.values(storeSubEvent.items).entries()) {
      if (storeSubEventItem.data && storeSubEventItem.data[link] && typeof storeSubEventItem.data[link] === 'string') {
        const lastSlashIndex = storeSubEventItem.data[link].lastIndexOf('/');
        const storeSuperEventItemId = storeSubEventItem.data[link].substring(lastSlashIndex + 1);
        // Note that we intentionally use '==' here and not '===' to cater for those storeSuperEventItem.id
        // which are purely numeric and stored as a number rather than a string, so we can still match on
        // storeSuperEventItemId which is always a string:
        const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem => storeSuperEventItem.id == storeSuperEventItemId);
        // If the match isn't found then the super-event has been deleted, so lose the sub-event info:
        if (storeSuperEventItem && storeSuperEventItem.data) {
          // Note that JSON.parse(JSON.stringify()) does not work for sets. Not an issue here as the items
          // don't contain sets:
          let storeSubEventItemCopy = JSON.parse(JSON.stringify(storeSubEventItem));
          let storeSuperEventItemCopy = JSON.parse(JSON.stringify(storeSuperEventItem));
          storeSubEventItemCopy.data[link] = storeSuperEventItemCopy.data;
          storeCombinedItems.push(storeSubEventItemCopy);
        }
        // If the match isn't found then the super-event has been deleted, so can lose the sub-event info...
        // If it is matched, we have the data in combined items so can delete
      }
      cp.text(`Combining Data Feeds: ${storeSubEventItemIdx+1} of ${Object.values(storeSubEvent.items).length} items`);
    }

    storeDataQuality.items = storeCombinedItems;
    // console.error(Object.values(storeSubEvent.items).length);
    // console.error(Object.values(storeDataQuality.items).length);
  }
  else {
    cp.empty();
    console.log("4");

    if (!(storeSuperEvent && storeSubEvent)) {
      // We are here if we don't have storeSuperEvent or storeSubEvent, which should occur only if
      // storeIngressOrder1.feedType was not found in superEventFeedTypes or subEventFeedTypes when
      // runForm() was called. In this case, we don't know ahead of reading the full RPDE feed what the
      // content type is, but now we can try again with itemDataType instead of the unknown feedType.
      if (superEventFeedTypes.includes(storeIngressOrder1.itemDataType)) {
        storeSuperEvent = storeIngressOrder1;
        storeSuperEventContentType = storeIngressOrder1.itemDataType;
        storeSubEventContentType = 'None';
      }
      else if (subEventFeedTypes.includes(storeIngressOrder1.itemDataType)) {
        storeSubEvent = storeIngressOrder1;
        storeSubEventContentType = storeIngressOrder1.itemDataType;
        storeSuperEventContentType = 'None';
      }
      else {
        console.warn('Unknown storeIngressOrder1 itemDataType, can\'t determine whether super-event or sub-event')
      }
    }

    storeDataQuality.items = Object.values(storeIngressOrder1.items);
    console.warn('No combined store, data quality from selected feed only');
  }
}

// -------------------------------------------------------------------------------------------------

function setStoreDataQualityItemFlags() {
  let dqp = $("#DQProgress");

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date().setHours(0, 0, 0, 0);

  let urls = {};
  let parents = {};
  let parentUrls = {};

  // -------------------------------------------------------------------------------------------------

  for (const [itemIdx, item] of storeDataQuality.items.entries()) {

    // Organizer info

    const organizer = resolveProperty(item, 'organizer');

    item.DQ_validOrganizer =
      typeof organizer === 'object' &&
      !Array.isArray(organizer) &&
      organizer !== null &&
      typeof organizer.name === 'string' &&
      organizer.name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Location info

    const location = resolveProperty(item, 'location');

    item.DQ_validLocation =
      typeof location === 'object' &&
      !Array.isArray(location) &&
      location !== null &&
      typeof location.name === 'string' &&
      location.name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Activity info

    // An item may be associated with many activities, but here we only care if there is at least one:
    const activities = resolveProperty(item, 'activity');

    item.DQ_validActivity =
      Array.isArray(activities) &&
      activities
      .map(activity => activity['id'] || activity['@id'])
      .filter(activityId => activityId)
      .map(activityId => matchToActivityList(activityId))
      .filter(prefLabel => prefLabel)
      .length > 0;

    // -------------------------------------------------------------------------------------------------

    // Name info

    const name = getProperty(item, 'name');

    item.DQ_validName =
      typeof name === 'string' &&
      name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Description info

    const description = getProperty(item, 'description');

    item.DQ_validDescription =
      typeof description === 'string' &&
      description.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Geo info

    const postalCode = getProperty(item, 'postalCode');
    const latitude = getProperty(item, 'latitude');
    const longitude = getProperty(item, 'longitude');

    item.DQ_validGeo =
      (typeof postalCode === 'string' && postalCode.length > 0 && ukPostalCodeRegex.test(postalCode)) ||
      (typeof latitude === 'number' && typeof longitude === 'number');

    // -------------------------------------------------------------------------------------------------

    // Date info

    const date = new Date(item.data.startDate);

    item.DQ_validDate =
      !isNaN(date) &&
      date >= dateNow;

    // -------------------------------------------------------------------------------------------------

    // URL info

    if (item.data && item.data.url && typeof item.data.url === 'string') {
      if (!urls.hasOwnProperty(item.data.url)) {
        urls[item.data.url] = [];
      }
      urls[item.data.url].push(itemIdx);
    }

    // -------------------------------------------------------------------------------------------------

    // Parent info

    if (link && item.data && item.data[link]) {
      let parentId = item.data[link].id || item.data[link]['@id'] || item.data[link].identifier || null;
      if (parentId) {
        if (!parents.hasOwnProperty(parentId)) {
          parents[parentId] = item.data[link];
          parents[parentId].itemIdxs = [];
        }
        parents[parentId].itemIdxs.push(itemIdx);
      }
      item.DQ_validParent = parentId !== null;
    }

    // -------------------------------------------------------------------------------------------------

    dqp.text(`Measuring Data Quality: ${itemIdx+1} of ${storeDataQuality.items.length} items`);
  }

  // -------------------------------------------------------------------------------------------------

  // TODO: This counts unique explicit URL strings. We are assuming these explicit URL strings are
  // specific booking URLs in many/most cases for this to be the metric we're after, but this may not
  // truly be the case and needs to be investigated.

  for (const itemIdxs of Object.values(urls)) {
    if (itemIdxs.length === 1) {
      storeDataQuality.items[itemIdxs[0]].DQ_validUrl = true;
    }
  }

  for (const item of storeDataQuality.items) {
    if (!item.hasOwnProperty('DQ_validUrl')) {
      item.DQ_validUrl = false;
    }
  }

  // -------------------------------------------------------------------------------------------------

  parents = Object.values(parents);

  for (const [parentIdx, parent] of parents.entries()) {
    if (parent.url && typeof parent.url === 'string') {
      if (!parentUrls.hasOwnProperty(parent.url)) {
        parentUrls[parent.url] = [];
      }
      parentUrls[parent.url].push(parentIdx);
    }
  }

  for (const parentIdxs of Object.values(parentUrls)) {
    if (parentIdxs.length === 1) {
      for (const itemIdx of parents[parentIdxs[0]].itemIdxs) {
        storeDataQuality.items[itemIdx].DQ_validParentUrl = true;
      }
    }
  }

  for (const item of storeDataQuality.items) {
    if (!item.hasOwnProperty('DQ_validParentUrl')) {
      item.DQ_validParentUrl = false;
    }
  }

  // -------------------------------------------------------------------------------------------------

  urls = {};
  parents = {};
  parentUrls = {};

}

// -------------------------------------------------------------------------------------------------

// This calculates DQ scores for the filtered data, and shows results

function postDataQuality() {

  document.getElementById("DQ_filterActivities").disabled = true;
  document.getElementById("DQ_filterGeos").disabled = true;
  document.getElementById("DQ_filterDates").disabled = true;
  document.getElementById("DQ_filterUrls").disabled = true;

  clearCharts();
  $("#resultPanel").hide();

  $("#resultTab").addClass("active");
  $("#resultPanel").addClass("active");
  $("#jsonTab").removeClass("active disabled");
  $("#jsonPanel").removeClass("active disabled");
  $("#apiTab").removeClass("active disabled");
  $("#apiPanel").removeClass("active disabled");
  $("#organizerTab").removeClass("active disabled");
  $("#organizerPanel").removeClass("active disabled");
  $("#locationTab").removeClass("active disabled");
  $("#locationPanel").removeClass("active disabled");
  $("#mapTab").removeClass("active disabled");
  $("#mapPanel").removeClass("active disabled");

  results = $("#results");
  results.empty();
  results.append("<div id='resultsDiv'</div>");
  addResultsPanel();

  // -------------------------------------------------------------------------------------------------

  getFilters();

  storeDataQuality.showMap = false;
  storeDataQuality.filteredItemsUniqueOrganizers = new Object();
  storeDataQuality.filteredItemsUniqueLocations = new Object();
  storeDataQuality.filteredItemsUniqueActivities = new Object();
  storeDataQuality.filteredItemsUniqueParentIds = new Set();
  storeDataQuality.filteredItemsUniqueDates = new Map();

  storeDataQuality.numFilteredItems = 0;
  let numFilteredItemsWithValidActivity = 0;
  let numFilteredItemsWithValidName = 0;
  let numFilteredItemsWithValidDescription = 0;
  let numFilteredItemsWithValidGeo = 0;
  let numFilteredItemsWithValidDate = 0;
  let numFilteredItemsWithValidUrl = 0;
  let numFilteredItemsWithValidParentUrl = 0;

  // ----FOR-LOOP-PROCESSING--------------------------------------------------------------------------

  for (const item of storeDataQuality.items) {

    // Filters

    let itemMatchesOrganizer =
      !filters.organizer
        ? true
        : item.DQ_validOrganizer &&
          resolveProperty(item, 'organizer').name === filters.organizer;

    let itemMatchesLocation =
      !filters.location
        ? true
        : item.DQ_validLocation &&
          resolveProperty(item, 'location').name === filters.location;

    let itemMatchesActivity =
      !filters.relevantActivitySet
        ? true
        : item.DQ_validActivity &&
          (resolveProperty(item, 'activity') || [])
          .filter(activity => filters.relevantActivitySet.has(activity['id'] || activity['@id'] || 'NONE'))
          .length > 0;

    let itemMatchesDay =
      !filters.day
        ? true
        : item.data &&
          item.data.eventSchedule &&
          item.data.eventSchedule
          .filter(x =>
            x.byDay &&
            x.byDay.includes(filters.day) ||
            x.byDay.includes(filters.day.replace('https', 'http')))
          .length > 0;

    let itemMatchesGender =
      !filters.gender
        ? true
        : resolveProperty(item, 'genderRestriction') === filters.gender;

    let itemMatchesDQActivityFilter =
      !filters.DQ_filterActivities ||
      (filters.DQ_filterActivities && !item.DQ_validActivity);

    let itemMatchesDQGeoFilter =
      !filters.DQ_filterGeos ||
      (filters.DQ_filterGeos && !item.DQ_validGeo);

    let itemMatchesDQDateFilter =
      !filters.DQ_filterDates ||
      (filters.DQ_filterDates && !item.DQ_validDate);

    let itemMatchesDQUrlFilter =
      !filters.DQ_filterUrls ||
      (filters.DQ_filterUrls && !item.DQ_validUrl);

    if (
      itemMatchesOrganizer &&
      itemMatchesLocation &&
      itemMatchesActivity &&
      itemMatchesDay &&
      itemMatchesGender &&
      itemMatchesDQActivityFilter &&
      itemMatchesDQGeoFilter &&
      itemMatchesDQDateFilter &&
      itemMatchesDQUrlFilter
    ) {

      storeDataQuality.numFilteredItems++;

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validOrganizer) {
        let organizer = resolveProperty(item, 'organizer');
        let organizerName = organizer.name.trim();
        if (!storeDataQuality.filteredItemsUniqueOrganizers.hasOwnProperty(organizerName)) {
          // Note that these sets are converted to arrays after looping through all items:
          storeDataQuality.filteredItemsUniqueOrganizers[organizerName] = {
            'url': new Set(),
            'email': new Set(),
            'telephone': new Set(),
          };
        }

        // Note that this is 'const key of' rather than 'const key in':
        for (const key of ['email', 'telephone']) {
          const val = getProperty(organizer, key);
          if (typeof val === 'string' && val.trim().length > 0) {
            storeDataQuality.filteredItemsUniqueOrganizers[organizerName][key].add(val.trim());
          }
          else if (typeof val === 'number') {
            storeDataQuality.filteredItemsUniqueOrganizers[organizerName][key].add(val);
          }
        }

        // Don't pull urls for images, just top level organisation urls:
        const topUrl = organizer.url || null;
        if (typeof topUrl === 'string' && topUrl.trim().length > 0) {
          storeDataQuality.filteredItemsUniqueOrganizers[organizerName]['url'].add(topUrl.trim());
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validLocation) {
        let location = resolveProperty(item, 'location');
        let locationName = location.name.trim();
        if (!storeDataQuality.filteredItemsUniqueLocations.hasOwnProperty(locationName)) {
          // Note that these sets are converted to arrays after looping through all items:
          storeDataQuality.filteredItemsUniqueLocations[locationName] = {
            'url': new Set(),
            'email': new Set(),
            'telephone': new Set(),
            'streetAddress': new Set(),
            'postalCode': new Set(),
            'coordinates': new Set(),
          };
        }

        // Note that this is 'const key of' rather than 'const key in':
        for (const key of ['email', 'telephone', 'streetAddress', 'postalCode']) {
          const val = getProperty(location, key);
          if (typeof val === 'string' && val.trim().length > 0) {
            storeDataQuality.filteredItemsUniqueLocations[locationName][key].add(val.trim());
          }
          else if (typeof val === 'number') {
            storeDataQuality.filteredItemsUniqueLocations[locationName][key].add(val);
          }
        }

        // Don't pull urls for images, just top level location urls:
        const topUrl = location.url || null;
        if (typeof topUrl === 'string' && topUrl.trim().length > 0) {
          storeDataQuality.filteredItemsUniqueLocations[locationName]['url'].add(topUrl.trim());
        }

        // The coordinates are stored as a single 'lat,lon' combined string in order to be a single element
        // in the set, which is then relevant for comparing to further coordinates for only adding unique:
        const latitude = getProperty(location, 'latitude');
        const longitude = getProperty(location, 'longitude');
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          storeDataQuality.filteredItemsUniqueLocations[locationName]['coordinates'].add([latitude, longitude].join(','));
          storeDataQuality.showMap = true;
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validActivity) {
        let activities = resolveProperty(item, 'activity');
        let itemUniqueActivities = new Set();

        activities
          .map(activity => activity['id'] || activity['@id'])
          .filter(activityId => activityId)
          .forEach(activityId => {
            let prefLabel = matchToActivityList(activityId);
            if (prefLabel) {
              itemUniqueActivities.add(prefLabel);
              if (!storeDataQuality.filteredItemsUniqueActivities.hasOwnProperty(prefLabel)) {
                storeDataQuality.filteredItemsUniqueActivities[prefLabel] = 0;
              }
              storeDataQuality.filteredItemsUniqueActivities[prefLabel] += 1;
            }
          });

        if (itemUniqueActivities.size > 0) {
          numFilteredItemsWithValidActivity++;
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validName) {
        numFilteredItemsWithValidName++;
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validDescription) {
        numFilteredItemsWithValidDescription++;
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validGeo) {
        numFilteredItemsWithValidGeo++;
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validDate) {
        numFilteredItemsWithValidDate++;
        const date = new Date(item.data.startDate);
        const dateString = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        storeDataQuality.filteredItemsUniqueDates.set(dateString, (storeDataQuality.filteredItemsUniqueDates.get(dateString) || 0) + 1);
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validParent) {
        let parentId = item.data[link].id || item.data[link]['@id'] || item.data[link].identifier || null;
        storeDataQuality.filteredItemsUniqueParentIds.add(parentId);
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validUrl) {
        numFilteredItemsWithValidUrl++;
      }

      // -------------------------------------------------------------------------------------------------

      if (item.DQ_validParentUrl) {
        numFilteredItemsWithValidParentUrl++;
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.numFilteredItems < 100) {
        postResults(item);
      }
      else if (storeDataQuality.numFilteredItems === 100) {
        results.append(
          "<div class='row rowhover'>" +
          "    <div>Only the first 100 items are shown</div>" +
          "</div>"
        );
      }

    } // If-statement selecting filtered items
  } // For-loop over all items

  //console.log(storeDataQuality.items);

  // ----END-OF-FOR-LOOP------------------------------------------------------------------------------

  if (storeDataQuality.numFilteredItems === 0) {
    results.empty();
    results.append(
      "<div class='row rowhover'>" +
      "    <div>No matching results found.</div>" +
      "</div>"
    );

    $("#resultTab").addClass("active");
    $("#resultPanel").addClass("active");
    $("#jsonTab").addClass("disabled");
    $("#apiTab").removeClass("active");
    $("#apiPanel").removeClass("active");
    $("#organizerTab").addClass("disabled");
    $("#locationTab").addClass("disabled");
    $("#mapTab").addClass("disabled");

  }

  // -------------------------------------------------------------------------------------------------

  // Sort objects by keys in alphabetical order:
  storeDataQuality.filteredItemsUniqueOrganizers = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueOrganizers).sort());
  storeDataQuality.filteredItemsUniqueLocations = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueLocations).sort());
  storeDataQuality.filteredItemsUniqueActivities = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueActivities).sort());

  // Convert sets to arrays:
  for (const organizerInfo of Object.values(storeDataQuality.filteredItemsUniqueOrganizers)) {
    for (const [key, val] of Object.entries(organizerInfo)) {
      organizerInfo[key] = Array.from(val);
    }
  }
  for (const locationInfo of Object.values(storeDataQuality.filteredItemsUniqueLocations)) {
    for (const [key, val] of Object.entries(locationInfo)) {
      locationInfo[key] = Array.from(val);
    }
  }

  // Convert 'lat,lon' strings to [lat,lon] numeric arrays:
  for (const locationInfo of Object.values(storeDataQuality.filteredItemsUniqueLocations)) {
    locationInfo.coordinates = locationInfo.coordinates.map(x => x.split(',').map(x => Number(x)));
  }

  // Create a new map from the first x entries:
  const topActivities = new Map(Object.entries(storeDataQuality.filteredItemsUniqueActivities).slice(0, 5));

  // -------------------------------------------------------------------------------------------------

  updateOrganizerList(storeDataQuality.filteredItemsUniqueOrganizers);
  $("#organizer").empty()
  addOrganizerPanel(storeDataQuality.filteredItemsUniqueOrganizers);
  console.log(`Number of unique organizers: ${Object.keys(storeDataQuality.filteredItemsUniqueOrganizers).length}`);
  // console.dir(`storeDataQuality.filteredItemsUniqueOrganizers: ${Object.keys(storeDataQuality.filteredItemsUniqueOrganizers)}`);

  updateLocationList(storeDataQuality.filteredItemsUniqueLocations);
  $("#location").empty()
  addLocationPanel(storeDataQuality.filteredItemsUniqueLocations);
  $("#map").empty()
  if (storeDataQuality.showMap === true) {
    addMapPanel(storeDataQuality.filteredItemsUniqueLocations);
  }
  else {
    $("#mapTab").addClass("disabled");
  }
  console.log(`Number of unique locations: ${Object.keys(storeDataQuality.filteredItemsUniqueLocations).length}`);
  // console.dir(`storeDataQuality.filteredItemsUniqueLocations: ${Object.keys(storeDataQuality.filteredItemsUniqueLocations)}`);

  updateActivityList(storeDataQuality.filteredItemsUniqueActivities);
  console.log(`Number of unique activities: ${Object.keys(storeDataQuality.filteredItemsUniqueActivities).length}`);
  // console.dir(`storeDataQuality.filteredItemsUniqueActivities: ${Object.keys(storeDataQuality.filteredItemsUniqueActivities)}`);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with matching activities: ${numFilteredItemsWithValidActivity}`);
  console.log(`Number of unique activities: ${Object.keys(storeDataQuality.filteredItemsUniqueActivities).length}`);

  const percent3_a = (numFilteredItemsWithValidActivity / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded3_a = percent3_a.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid name: ${numFilteredItemsWithValidName}`);

  const percent3_b = (numFilteredItemsWithValidName / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded3_b = percent3_b.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid description: ${numFilteredItemsWithValidDescription}`);

  const percent3_c = (numFilteredItemsWithValidDescription / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded3_c = percent3_c.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid postcode or lat-lon coordinates: ${numFilteredItemsWithValidGeo}`);

  const percent2 = (numFilteredItemsWithValidGeo / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded2 = percent2.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid present/future dates: ${numFilteredItemsWithValidDate}`);
  console.log(`Number of unique present/future dates: ${storeDataQuality.filteredItemsUniqueDates.size}`);

  const percent1 = (numFilteredItemsWithValidDate / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded1 = percent1.toFixed(1);

  // Sort the storeDataQuality.filteredItemsUniqueDates Map by date, in ascending order
  const sortedFilteredItemsUniqueDates = new Map(
    Array.from(storeDataQuality.filteredItemsUniqueDates.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]))
  );

  const sortedKeys = Array.from(sortedFilteredItemsUniqueDates.keys());
  const minDate = sortedKeys[0];
  const maxDate = sortedKeys[sortedKeys.length - 1];

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid URLs: ${numFilteredItemsWithValidUrl}`);

  const percent4_a = (numFilteredItemsWithValidUrl / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded4_a = percent4_a.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid parent URLs: ${numFilteredItemsWithValidParentUrl}`);

  const percent4_b = (numFilteredItemsWithValidParentUrl / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded4_b = percent4_b.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...

  // -------------------------------------------------------------------------------------------------

  // Hide y axis if no chart to display
  let show_y_axis = false;

  if (Object.keys(storeDataQuality.filteredItemsUniqueActivities).length > 0) {
    show_y_axis = true;
  }

  // Show a message if no chart / no matching activities

  let x_axis_title = {};

  if (Object.keys(storeDataQuality.filteredItemsUniqueActivities).length < 1) {
    x_axis_title = {
      text: "No Matching Activity IDs",
      offsetX: -5,
      offsetY: -150,
      style: {
        fontSize: '20px',
        fontWeight: 900,
      },
    }
  }
  else {
    x_axis_title = {
      text: "Top Activities",
      offsetX: -20,
      offsetY: -8,
      style: {
        fontSize: '14px',
        fontWeight: 900,
      },
    }
  }


  // Show relevant name based on parent in feed, if present

  let spark1SeriesName = '';

  if (!storeSuperEventContentType && storeSuperEvent) {
    storeSuperEventContentType = storeSuperEvent.feedType;
  }
  if (storeSuperEventContentType) {
    if (['SessionSeries'].includes(storeSuperEventContentType)) {
      spark1SeriesName = 'Series';
    }
    else if (['FacilityUse', 'IndividualFacilityUse'].includes(storeSuperEventContentType)) {
      spark1SeriesName = 'Facility Use';
      if (storeDataQuality.filteredItemsUniqueParentIds.size !== 1) {
        spark1SeriesName += 's';
      }
    }
  }

  let spark1 = {
    chart: {
      id: 'bar1',
      group: 'sparklines',
      type: 'bar',
      width: "100%",
      height: 300,
      toolbar: {
        show: false
      },
      sparkline: {
        enabled: false,
      },
      //events: {
      //  click: function (event) {
      //    if ([...event.target.classList].includes('apexcharts-title-text')) {
      //      alert('Title clicked')
      //    }
      //  }
      //}
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
      }
    },
    fill: {
      opacity: 0.8,
    },
    series: [{
      name: spark1SeriesName,
      data: Array.from(topActivities.values()),
    }],
    dataLabels: {
      enabled: false,
    },
    labels: Array.from(topActivities.keys()),
    colors: ['#71CBF2'],
    title: {
      text: storeDataQuality.filteredItemsUniqueParentIds.size.toLocaleString(),
      align: 'left',
      offsetX: 0,
      style: {
        fontSize: '30px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: spark1SeriesName,
      align: 'left',
      offsetY: 40,
      style: {
        fontSize: '18px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    grid: {
      show: false,
      padding: {
        left: 0,
        right: 0,
        top: -35,
        bottom: 0,
      }
    },
    xaxis: {
      floating: false,
      labels: {
        show: false,
      },
      title: x_axis_title,
      tooltip: {
        enabled: false
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      }
    },
    yaxis: {
      show: show_y_axis,
      showForNullSeries: false,
      labels: {
        show: true,
        align: 'left',
        minWidth: 0,
        maxWidth: 90,
        offsetX: 12,
        offsetY: 6,
        formatter: function (value) {
          let label = value.toString().trim();
          let words = label.split(" ");
          let lines = [];
          let line = "";
          for (let i = 0; i < words.length; i++) {
            let testLine = line + words[i];
            if (testLine.length > 10) { // Replace 10 with your desired line length
              lines.push(line.trim());
              line = words[i] + " ";
            } else {
              line = testLine + " ";
            }
          }
          lines.push(line.trim());
          //console.log(lines);
          return lines;
        }
      },
      floating: false, //true takes y axis out of plot space
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false
      }
    },
    tooltip: {
      marker: {
        show: false
      },
      //custom: function({series, seriesIndex, dataPointIndex, w}) {
      //  return '<div class="arrow_box">' +
      //   '<span>' + series[seriesIndex][dataPointIndex] + '</span>' +
      //    '</div>'
      //},
      y: {
        formatter: function (val) {
          return val.toLocaleString();
        }
      },
    },

  }

  chart1 = new ApexCharts(document.querySelector("#apexchart1"), spark1);
  chart1.render();

  // -------------------------------------------------------------------------------------------------

  let filter_chart = {
    chart: {
      type: 'radialBar',
    },
    title: {
      text: "Filter Active",
      align: 'center',
      margin: 0,
      offsetX: 0,
      offsetY: 70,
      style: {
        fontSize: '30px',
        fontWeight: 'bold',
        color: '#2196F3'
      },
    },
    series: [],
    labels: [''],
    plotOptions: {
      radialBar: {
        hollow: {
          margin: 15,
          size: "65%"
        },
        dataLabels: {
          show: false,
        },
      }
    }
  }

  let options_percentItemsWithActivity = {};

  if (filters.DQ_filterActivities !== true) {

    options_percentItemsWithActivity = {
      chart: {
        height: 300,
        type: 'radialBar',
        events: {
          click: function (event, chartContext, config) {
            //if ([...event.target.classList].includes('#apexcharts-radialbarTrack-0')) {
            //alert('Chart clicked');
            console.log(event);
            console.log(chartContext);
            console.log(config);
          }
        }
      },
      fill: {
        colors: ['#A7ABDA'],
      },
      //fill: {
      //  colors: [function({ value, seriesIndex, w }) {
      //    if(value < 55) {
      //        return '#7E36AF'
      //    } else if (value >= 55 && value < 80) {
      //        return '#164666'
      //    } else {
      //        return '#D9534F'
      //    }
      //  }]
      //},
      series: [rounded3_a, rounded3_b, rounded3_c],
      labels: ['Activity ID', 'Name', 'Description'],
      plotOptions: {
        radialBar: {
          hollow: {
            margin: 15,
            size: "65%"
          },
          dataLabels: {
            show: true,
            name: {
              offsetY: 25,
              show: true,
              color: "#888",
              fontSize: "18px"
            },
            value: {
              offsetY: -30,
              color: "#111",
              fontSize: "30px",
              show: true
            },
            total: {
              show: true,
              label: "Valid Activity ID",
              color: "#888",
              fontSize: "18px",
              formatter: function (w) {
                // By default this function returns the average of all series. The below is just an example to show the use of custom formatter function
                return Math.max(rounded3_a).toFixed(1) + "%";
              }
            },
          }
        }
      }
    }

  }

  else {
    options_percentItemsWithActivity = filter_chart;
  }

  chart2 = new ApexCharts(document.querySelector("#apexchart2"), options_percentItemsWithActivity);

  sleep(200).then(() => { chart2.render(); });

  // -------------------------------------------------------------------------------------------------

  let options_percentItemsWithGeo = {};

  if (filters.DQ_filterGeos !== true) {
    options_percentItemsWithGeo = {
      chart: {
        width: "100%",
        height: 300,
        type: 'radialBar',
      },
      fill: {
        colors: ['#B196CB'],
      },
      series: [rounded2],
      labels: [['Valid postcode', 'or coordinates']],
      plotOptions: {
        radialBar: {
          hollow: {
            margin: 15,
            size: "65%"
          },
          dataLabels: {
            showOn: "always",
            name: {
              offsetY: 25,
              show: true,
              color: "#888",
              fontSize: "18px"
            },
            value: {
              offsetY: -30,
              color: "#111",
              fontSize: "30px",
              show: true
            }
          }
        }
      }
    }
  }
  else {
    options_percentItemsWithGeo = filter_chart;
  }

  chart3 = new ApexCharts(document.querySelector("#apexchart3"), options_percentItemsWithGeo);
  sleep(400).then(() => { chart3.render(); });

  // -------------------------------------------------------------------------------------------------

  let options_percentItemsNowToFuture = {};

  if (filters.DQ_filterDates !== true) {
    options_percentItemsNowToFuture = {
      chart: {
        width: "100%",
        height: 300,
        type: 'radialBar',
      },
      fill: {
        colors: ['#BD82BB'],
      },
      series: [rounded1],
      labels: [['Valid', 'Start Date']],
      plotOptions: {
        radialBar: {
          hollow: {
            margin: 15,
            size: "65%"
          },
          dataLabels: {
            showOn: "always",
            name: {
              offsetY: 25,
              show: true,
              color: "#888",
              fontSize: "18px"
            },
            value: {
              offsetY: -30,
              color: "#111",
              fontSize: "30px",
              show: true
            }
          }
        }
      }
    }
  }
  else {
    options_percentItemsNowToFuture = filter_chart;
  }

  chart4 = new ApexCharts(document.querySelector("#apexchart4"), options_percentItemsNowToFuture);
  sleep(600).then(() => { chart4.render(); });

  // -------------------------------------------------------------------------------------------------

  var optionsSessionUrl = {
    chart: {
      offsetY: 10,
      height: 200,
      type: 'radialBar',
    },
    grid: {
      show: false,
      padding: {
        left: -40,
        right: -40,
        top: -30,
        bottom: 0,
      },
    },
    fill: {
      colors: ['#C76DAC'],
    },
    series: [rounded4_a],
    labels: ['Session Urls'],
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        dataLabels: {
          name: {
            offsetY: 25,
            show: true,
            color: "#888",
            fontSize: "18px"
          },
          value: {
            offsetY: -20,
            color: "#111",
            fontSize: "30px",
            show: true
          }
        }
      }
    },
  }

  let options_percentItemsWithUrl = {};

  if (filters.DQ_filterUrls !== true) {
    options_percentItemsWithUrl = {
      chart: {
        type: 'radialBar',
        offsetY: 10,
        height: 200,
      },
      grid: {
        show: false,
        padding: {
          left: -40,
          right: -40,
          top: -30,
          bottom: 0,
        }
      },
      fill: {
        colors: ['#C76DAC'],
      },
      series: [rounded4_b],
      labels: ['Series Urls'],
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          dataLabels: {
            name: {
              offsetY: 25,
              show: true,
              color: "#888",
              fontSize: "18px"
            },
            value: {
              offsetY: -20,
              color: "#111",
              fontSize: "30px",
              show: true
            }
          }
        }
      },
    }
  }
  else {
    options_percentItemsWithUrl = filter_chart;
  }

  chart5a = new ApexCharts(document.querySelector("#apexchart5a"), optionsSessionUrl);
  chart5b = new ApexCharts(document.querySelector("#apexchart5b"), options_percentItemsWithUrl);
  sleep(800).then(() => {
    chart5a.render();
    chart5b.render();
  });

  // -------------------------------------------------------------------------------------------------

  let annotation_text = {};
  if (storeDataQuality.filteredItemsUniqueDates.size > 0) {
    annotation_text = {
      xaxis: [
        {
          x: new Date().getTime(),
          borderColor: '#775DD0',
          label: {
            style: {
              color: '#000',
            },
            text: 'Today'
          }
        }
      ]
    };
  }

  let spark6SeriesName = '';
  if (!storeSubEventContentType && storeSubEvent) {
    storeSubEventContentType = storeSubEvent.feedType;
  }
  if (storeSubEventContentType) {
    if (['ScheduledSession'].includes(storeSubEventContentType)) {
      spark6SeriesName = 'Session';
    }
    else if (['Slot'].includes(storeSubEventContentType)) {
      spark6SeriesName = 'Slot';
    }
    else if (['Event', 'OnDemandEvent'].includes(storeSubEventContentType)) {
      spark6SeriesName = 'Event';
    }
    if (spark6SeriesName.length > 0 && storeDataQuality.numFilteredItems !== 1) {
      spark6SeriesName += 's';
    }
  }

  let spark6 = {
    chart: {
      id: 'sparkline1',
      group: 'sparklines',
      type: 'area',
      width: "100%",
      height: 300,
      toolbar: {
        show: false
      },
      sparkline: {
        enabled: false
      }
    },
    stroke: {
      curve: 'smooth'
    },
    fill: {
      opacity: 0.8,
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      marker: {
        show: false
      },
      //custom: function({series, seriesIndex, dataPointIndex, w}) {
      //  return '<div class="arrow_box">' +
      //   '<span>' + series[seriesIndex][dataPointIndex] + '</span>' +
      //    '</div>'
      //},
      x: {
        format: "ddd dd MMM yyyy",
      },
      y: {
        formatter: function (val) {
          return val.toLocaleString();
        }
      },
    },
    annotations: annotation_text,
    series: [{
      name: spark6SeriesName,
      data: Array.from(sortedFilteredItemsUniqueDates.values()),
    }],
    labels: Array.from(sortedFilteredItemsUniqueDates.keys()),
    grid: {
      show: false
    },
    yaxis: {
      floating: false, //true takes y axis out of plot space
      show: false,
      min: 0,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false
      }
    },
    //MODIFY THESE OPTIONS TO OVERRIDE DEFAULT STYLING TO SHOW MIN AND MAX VALUES...
    xaxis: {
      type: "datetime",
      floating: false,
      labels: {
        show: false,
        rotate: 0,
        format: "dd MMM yyyy",
        //formatter : function (val) {
        //  if (val === minDate | val === maxDate) {
        //    return val
        //  }
        //}
      },
      tooltip: {
        enabled: false
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      }
    },
    colors: ['#E21483'],
    title: {
      text: storeDataQuality.numFilteredItems.toLocaleString(),
      align: 'right',
      offsetX: 0,
      style: {
        fontSize: '30px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: spark6SeriesName,
      align: 'right',
      offsetY: 40,
      style: {
        fontSize: '18px',
        cssClass: 'apexcharts-yaxis-title'
      }
    }
  }

  chart6 = new ApexCharts(document.querySelector("#apexchart6"), spark6);
  sleep(1000).then(() => { chart6.render(); });
  sleep(1200).then(() => { $("#resultPanel").fadeIn("slow"); });
  sleep(1400).then(() => {
    if (storeDataQuality.numFilteredItems !== 0) {
      $("#filterRows").fadeIn("slow");
    }
    document.getElementById("DQ_filterActivities").disabled = false;
    document.getElementById("DQ_filterGeos").disabled = false;
    document.getElementById("DQ_filterDates").disabled = false;
    document.getElementById("DQ_filterUrls").disabled = false;
  });
}
