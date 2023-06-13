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
    `<div id='row${storeDataQuality.numItemsMatchFilters}' class='row rowhover'>` +
    `    <div id='text${storeDataQuality.numItemsMatchFilters}' class='col-md-1 col-sm-2 text-truncate'>${item.id || item.data['@id']}</div>` +
    `    <div class='col'>${(resolveProperty(item, 'name') || '')}</div>` +
    `    <div class='col'>${(resolveProperty(item, 'activity') || []).filter(activity => activity.id || activity['@id']).map(activity => activity.prefLabel).join(', ')}</div>` +
    `    <div class='col'>${(getProperty(item, 'startDate') || '')}</div>` +
    `    <div class='col'>${(getProperty(item, 'endDate') || '')}</div>` +
    `    <div class='col'>${((item.data && item.data.location && item.data.location.name) || (item.data && item.data.superEvent && item.data.superEvent.location && item.data.superEvent.location.name) || '')}</div>` +
    `    <div class='col'>` +
    `        <div class='visualise'>` +
    `            <div class='row'>` +
    `                <div class='col' style='text-align: right'>` +
    `                    <button id='json${storeDataQuality.numItemsMatchFilters}' class='btn btn-secondary btn-sm mb-1' style='background: ${inactiveJSONButtonColor}'>JSON</button>` +
    `                </div>` +
    `            </div>` +
    `        </div>` +
    `    </div>` +
    `</div>`
  );

  if (storeDataQuality.numItemsMatchFilters === 1) {
    setJSONButton(document.getElementById('json1'));
    setJSONTab(item.id || item.data['@id'], false);
  }

  $(`#json${storeDataQuality.numItemsMatchFilters}`).on('click', function () {
    setJSONButton(this);
    setJSONTab(item.id || item.data['@id'], true);
  });

  if ((item.id && item.id.length > 8) || (item.data['@id'] && item.data['@id'].length > 8)) {
    $(`#row${storeDataQuality.numItemsMatchFilters}`).hover(
      function () {
        $(`#text${storeDataQuality.numItemsMatchFilters}`).removeClass("text-truncate");
        $(`#text${storeDataQuality.numItemsMatchFilters}`).prop("style", "font-size: 70%");
      },
      function () {
        $(`#text${storeDataQuality.numItemsMatchFilters}`).addClass("text-truncate");
        $(`#text${storeDataQuality.numItemsMatchFilters}`).prop("style", "font-size: 100%");
      }
    );
  }

}

// -------------------------------------------------------------------------------------------------

// This feeds the right data store into the DQ metrics


function runDataQuality() {

  storeSuperEventContentType = null;
  storeSubEventContentType = null;
  numListings = 0; // We should really be calculating the numbers Opps/Listings later on.
  numOpps = 0;
  let listings = [];
  let uniqueListings = null;


  //console.log(link);
  //console.log(storeSuperEvent);
  //console.log(storeSubEvent);

  // First check for any unpacking of superevents or eventschedules
  if (
    storeSuperEvent && link === null
  ) {
    cp.text("Unpacking Data Feed");

    console.log(`storeSuperEvent items: ${Object.values(storeSuperEvent.items).length}`);
    console.log(`storeSuperEvent feed type: ${storeSuperEvent.feedType}`);
    console.log(`storeSuperEvent item kind: ${storeSuperEvent.itemKind}`);
    console.log(`storeSuperEvent item data type: ${storeSuperEvent.itemDataType}`);

    console.log(`storeSubEvent items: ${Object.values(storeSubEvent.items).length}`);
    console.log(`storeSubEvent feed type: ${storeSubEvent.feedType}`);
    console.log(`storeSubEvent item kind: ${storeSubEvent.itemKind}`);
    console.log(`storeSubEvent item data type: ${storeSubEvent.itemDataType}`);

    //console.log(storeSuperEvent);

    //BwD - embedded superevent with series data
    if (
      storeSuperEvent.feedType === 'SessionSeries' &&
      storeSuperEvent.itemDataType === 'ScheduledSession'
    ) {
      console.log("1");
      cp.text("Unpacking data feed - embedded SuperEvent with Series data");

      link = 'superEvent';
      storeSubEvent.itemDataType = 'ScheduledSession';

      for (const storeSuperEventItem of Object.values(storeSuperEvent.items)) {
        if (storeSuperEventItem.data && storeSuperEventItem.data[link] && storeSuperEventItem.data[link].identifier) {
          listings.push(storeSuperEventItem.data[link].identifier);
        }
      }
      uniqueListings = [...new Set(listings)];

      numListings = uniqueListings.length;
      numOpps = Object.values(storeSuperEvent.items).length;
      storeDataQuality.items = Object.values(storeSuperEvent.items);
    }

    //SportSuite - embedded subevent with session data
    else if (
      storeSuperEvent.feedType === 'SessionSeries' &&
      storeSuperEvent.itemDataType === 'mixed'
    ) {

      console.log("2");
      cp.text("Unpacking data feed - embedded SubEvent with session data");

      link = 'subEvent';
      storeSubEvent.itemDataType = 'ScheduledSession';
      storeSubEvent.items = {};

      for (const storeSuperEventItem of Object.values(storeSuperEvent.items)) {
        if (storeSuperEventItem.data && storeSuperEventItem.data[link]) {
          if (Array.isArray(storeSuperEventItem.data[link])) {
            const { subEvent, ...newStoreSuperEventItem } = storeSuperEventItem.data;
            for (const subEvent of storeSuperEventItem.data[link]) {
              const subEventId = subEvent.id || subEvent['@id'];
              storeSubEvent.items[subEventId] = {
                data: Object.assign({}, subEvent, { superEvent: Object.assign({}, newStoreSuperEventItem) })
              };
            }
          }
        }
      }

      for (const storeSuperEventItem of Object.values(storeSubEvent.items)) {
        if (storeSuperEventItem.data && storeSuperEventItem.data.superEvent) {
          const superEventId =
            storeSuperEventItem.data.superEvent.id ||
            storeSuperEventItem.data.superEvent['@id'] ||
            storeSuperEventItem.data.superEvent.identifier;
          if (superEventId) {
            listings.push(superEventId);
          }
        }
      }
      uniqueListings = [...new Set(listings)];

      numListings = uniqueListings.length;
      numOpps = Object.values(storeSubEvent.items).length;
      storeDataQuality.items = Object.values(storeSubEvent.items);
    }
  }
  else if (
    storeSuperEvent && Object.values(storeSuperEvent.items).length > 0 &&
    storeSubEvent && Object.values(storeSubEvent.items).length > 0 &&
    link
  ) {

    console.log("3");

    let ccounter = 0;

    storeCombinedItems = [];
    let items = Object.values(storeSubEvent.items);

    for (const storeSubEventItem of items) {

      ccounter++;

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
      // Remove the storeSubEventItem from the original storeSubEvent.items object
      delete storeSubEvent.items[storeSubEventItem];
    }

    cp.text("Combining Data Feeds: " + ccounter + " of " + Object.values(storeSubEvent.items).length + " items");

    //console.log(`Combined store contains: ${storeCombinedItems.length} items`);
    //console.log(storeCombinedItems);

    for (const storeSubEventItem of storeCombinedItems) {
      if (storeSubEventItem.data && storeSubEventItem.data[link] && storeSubEventItem.data[link].identifier) {
        listings.push(storeSubEventItem.data[link].identifier);
      }
      else if (storeSubEventItem.data && storeSubEventItem.data[link] && storeSubEventItem.data[link]['@id']) {
        listings.push(storeSubEventItem.data[link]['@id']);
      }
    }
    uniqueListings = [...new Set(listings)];

    numListings = uniqueListings.length;
    numOpps = storeCombinedItems.length;
    storeDataQuality.items = storeCombinedItems;
  }
  else {
    cp.empty();
    console.log("4");

    if (!(storeSuperEvent && storeSubEvent)) {
      // We are here if we don't have storeSuperEvent or storeSubEvent, which should occur only if
      // storeIngressOrder1.feedType was not found in superEventFeedTypes or subEventFeedTypes when
      // runForm() was called. In this case, we don't know ahead of reading the full RPDE feed what the
      // content type is, but now we can try again with itemDataType instead of the unknown feedType. If
      // the content type is still unknown after this check, then numListings and numOpps retain their
      // default values of 0.
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

    numListings = storeSuperEvent ? Object.values(storeSuperEvent.items).length : 0;
    numOpps = storeSubEvent ? Object.values(storeSubEvent.items).length : 0;
    storeDataQuality.items = Object.values(storeIngressOrder1.items);
    console.warn('No combined store, data quality from selected feed only');
  }

  measureDataQuality();
}

// -------------------------------------------------------------------------------------------------


// This applies the DQ checks to the whole data store

function measureDataQuality() {

  progress.append(`<div id='DQProgress'</div>`);
  let dqp = $("#DQProgress");

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date();
  dateNow.setHours(0, 0, 0, 0);

  let urlCounts = new Map();
  let parentUrlCounts = new Map();

  let counter = 0;
  for (const item of storeDataQuality.items) {

    counter++;

    // Date info

    // Convert the date to a JavaScript Date object
    const date = new Date(item.data.startDate);

    if (!isNaN(date)) {
      // Check if the date is greater than or equal to today's date
      if (date >= dateNow) {
        item.DQ_futureDate = 1;
      }
    }

    // -------------------------------------------------------------------------------------------------

    // Geo info

    const postalCode = getProperty(item, 'postalCode');
    const latitude = getProperty(item, 'latitude');
    const longitude = getProperty(item, 'longitude');

    const hasValidPostalCode =
      typeof postalCode === 'string' &&
      postalCode.length > 0 &&
      ukPostalCodeRegex.test(postalCode);

    const hasValidLatLon =
      typeof latitude === 'number' &&
      typeof longitude === 'number';

    if (hasValidPostalCode || hasValidLatLon) {
      item.DQ_validGeo = 1;
    }

    // -------------------------------------------------------------------------------------------------

    // Activity info

    // Count any ids/label that match in activityCounts
    // But only increment items with matching activities once
    let activities = resolveProperty(item, 'activity');

    if (Array.isArray(activities)) {

      // Unpack the activity json
      activities
        .map(activity => activity.id || activity['@id'])
        .filter(activityId => activityId)
        .forEach((activityId) => {

          // See if there is a matching id / label
          let label = matchToActivityList(activityId);

          if (label) {
            // Update item if a matching label found
            item.DQ_validActivity = 1;
          }

        });

    }

    // -------------------------------------------------------------------------------------------------

    // Name info

    const name = getProperty(item, 'name');

    const hasValidName =
      typeof name === 'string' &&
      name.length > 0 &&
      name != " ";

    if (hasValidName) {
      item.DQ_validName = 1;
    }
    // -------------------------------------------------------------------------------------------------

    // Description info

    const description = getProperty(item, 'description');

    const hasValidDescription =
      typeof description === 'string' &&
      description.length > 0 &&
      description != " ";

    if (hasValidDescription) {
      item.DQ_validDescription = 1;
    }

    // -------------------------------------------------------------------------------------------------

    // URL info

    // Stash all series URL values for later test for uniqueness

    if (link && item.data && item.data[link] && item.data[link].url && typeof item.data[link].url === 'string') {
      parentUrlCounts.set(item.data[link].url, (urlCounts.get(item.data[link].url) || 0) + 1);
    }

    if (item.data && item.data.eventSchedule && item.data.eventSchedule.urlTemplate) {
      item.DQ_validSessionUrl = 1;
      item.DQ_validSeriesUrl = 1;
    }
    else if (item.data && item.data.url && typeof item.data.url === 'string') {
      urlCounts.set(item.data.url, (urlCounts.get(item.data.url) || 0) + 1);
    }



  }

  // After looping through all items and adding all urls to list - now go back and assign flag to those items with unique urls
  // TODO: This counts unique explicit URL strings and adds them to the count of URL templates. We
  // are assuming these explicit URL strings are specific booking URLs in many/most cases for this to
  // be the metric we're after, but this may not truly be the case and needs to be investigated.
  urlCounts.forEach((val, key) => {
    if (val === 1) {
      storeDataQuality.items.forEach(item => {
        if (item.data && item.data.url && typeof item.data.url === 'string' && item.data.url === key) {
          item.DQ_validSessionUrl = 1;
        }
      });
    }
  });

  // Go back and assign flag to those items with unique series urls
  parentUrlCounts.forEach((val, key) => {
    if (val === 1) {
      storeDataQuality.items.forEach(item => {
        if (link && item.data && item.data[link] && item.data[link].url && typeof item.data[link].url === 'string' && item.data[link].url === key) {
          item.DQ_validSeriesUrl = 1;
        }
      });
    }
  });

  dqp.text("Measuring Data Quality: " + counter + " of " + storeDataQuality.items.length + " items");

  $("#tabs").fadeIn("slow");
  postDataQuality();
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
  $("#jsonTab").removeClass("active");
  $("#jsonPanel").removeClass("active");
  $("#apiTab").removeClass("active");
  $("#apiPanel").removeClass("active");
  $("#organizerTab").removeClass("active");
  $("#organizerPanel").removeClass("active");
  $("#locationTab").removeClass("active");
  $("#locationPanel").removeClass("active");
  $("#mapTab").removeClass("active");
  $("#mapPanel").removeClass("active");

  results = $("#results");
  results.empty();
  results.append("<div id='resultsDiv'</div>");
  addResultsPanel();

  // Reset store contents for after filters applied:
  storeDataQuality.numItemsMatchFilters = 0;
  storeDataQuality.uniqueActivities = new Set();
  storeDataQuality.uniqueOrganizers = new Object();
  storeDataQuality.uniqueLocations = new Object();

  getFilters();
  //console.log(filters);

  let numItems = 0;
  let numParents = 0;
  let numChild = 0;

  let parents = [];
  let uniqueParents = null;

  // -------------------------------------------------------------------------------------------------

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date().setHours(0, 0, 0, 0);
  let dateCounts = new Map();
  let activityCounts = new Map();
  let urlCounts = new Map();

  let numItemsNowToFuture = 0;
  let numItemsWithGeo = 0; // TODO: Sort out duplication of effort with "numItemsWithOrganizer"
  let numItemsWithActivity = 0;
  let numItemsWithOrganizer = 0;
  let numItemsWithLocation = 0;
  let numItemsWithName = 0;
  let numItemsWithDescription = 0;
  let numItemsWithUrl = 0;
  let numParentsWithUniqueUrl = 0;

  // ----FOR-LOOP-PROCESSING--------------------------------------------------------------------------

  for (const item of storeDataQuality.items) {

    // Filters

    let itemMatchesActivity =
      !filters.relevantActivitySet
        ? true
        : (resolveProperty(item, 'activity') || []).filter(activity =>
          filters.relevantActivitySet.has(activity.id || activity['@id'] || 'NONE')
        ).length > 0;

    let organizer = resolveProperty(item, 'organizer');
    let hasValidOrganizer =
      typeof organizer === 'object' &&
      !Array.isArray(organizer) &&
      organizer !== null &&
      typeof organizer.name === 'string' &&
      organizer.name.trim().length > 0;
    let itemMatchesOrganizer =
      !filters.organizer
        ? true
        : hasValidOrganizer && organizer.name === filters.organizer;

    let location = resolveProperty(item, 'location');
    let hasValidLocation =
      typeof location === 'object' &&
      !Array.isArray(location) &&
      location !== null &&
      typeof location.name === 'string' &&
      location.name.trim().length > 0;
    let itemMatchesLocation =
      !filters.location
        ? true
        : hasValidLocation && location.name === filters.location;

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


    let itemPassedDQDates =
      item.DQ_futureDate || 0;
    let itemMatchesDQDateFilter =
      filters.DQ_filterDates === false || (filters.DQ_filterDates === true && itemPassedDQDates === 0);

    let itemPassedDQActivities =
      item.DQ_validActivity || 0;
    let itemMatchesDQActivityFilter =
      filters.DQ_filterActivities === false || (filters.DQ_filterActivities === true && itemPassedDQActivities === 0);

    let itemPassedDQGeo =
      item.DQ_validGeo || 0;
    let itemMatchesDQGeoFilter =
      filters.DQ_filterGeos === false || (filters.DQ_filterGeos === true && itemPassedDQGeo === 0);

    let itemPassedDQUrl =
      item.DQ_validSeriesUrl || 0;
    let itemMatchesDQUrlFilter =
      filters.DQ_filterUrls === false || (filters.DQ_filterUrls === true && itemPassedDQUrl === 0);


    if (
      itemMatchesActivity &&
      itemMatchesOrganizer &&
      itemMatchesLocation &&
      itemMatchesDay &&
      itemMatchesGender &&
      itemMatchesDQDateFilter &&
      itemMatchesDQActivityFilter &&
      itemMatchesDQGeoFilter &&
      itemMatchesDQUrlFilter
    ) {

      numItems++;
      numChild++;

      storeDataQuality.numItemsMatchFilters++;

      // Find parents, emulating opps / listings counts for earlier scenarios

      // 1 and 3
      if (item.data && item.data[link]) {
        if (item.data[link].identifier) {
          parents.push(item.data[link].identifier);
        }
        else if (item.data[link]['@id']) {
          parents.push(item.data[link]['@id']);
        }
      }

      // 2 could be rolled into the above
      else if (item.data && item.data.superEvent) {
        const superEventId =
          item.data.superEvent.id ||
          item.data.superEvent['@id'] ||
          item.data.superEvent.identifier;
        if (superEventId) {
          parents.push(superEventId);
        }
      }


      // Date info

      // Convert the date to a JavaScript Date object
      const date = new Date(item.data.startDate);

      if (!isNaN(date)) {

        // Check if the date is greater than or equal to today's date
        if (date >= dateNow) {
          numItemsNowToFuture++;
        }

        // Get the string representation of the date in the format "YYYY-MM-DD"
        const dateString = date.toISOString().slice(0, 10);

        // Increment the count for the date in the Map
        dateCounts.set(dateString, (dateCounts.get(dateString) || 0) + 1);

      } else {
        //console.log(`Invalid date: ${date}`);
      }

      // -------------------------------------------------------------------------------------------------

      // Geo info
      // TODO: Sort out duplication of effort with "Location info"

      const postalCode = getProperty(item, 'postalCode');
      const latitude = getProperty(item, 'latitude');
      const longitude = getProperty(item, 'longitude');

      const hasValidPostalCode =
        typeof postalCode === 'string' &&
        postalCode.length > 0 &&
        ukPostalCodeRegex.test(postalCode);

      const hasValidLatLon =
        typeof latitude === 'number' &&
        typeof longitude === 'number';

      if (hasValidPostalCode || hasValidLatLon) {
        numItemsWithGeo++;
      }

      // -------------------------------------------------------------------------------------------------

      // Activity info

      // Count any ids/label that match in activityCounts
      // But only increment items with matching activities once
      let activities = resolveProperty(item, 'activity');

      if (Array.isArray(activities)) {

        // Use a set to avoid counting multiple prefLabels for the same row
        let activityLabelsSet = new Set();

        // Unpack the activity json
        activities
          .map(activity => activity.id || activity['@id'])
          .filter(activityId => activityId)
          .forEach(activityId => {

            // Add activity to list of unique activities (one of the original filters, now applied after loading completed)
            storeDataQuality.uniqueActivities.add(activityId)

            // New DQ measures

            // See if there is a matching id / label
            let label = matchToActivityList(activityId);

            if (label) {
              // Add to row level list of labels
              activityLabelsSet.add(label);
              // Add to feed level list of labels
              activityCounts.set(label, (activityCounts.get(label) || 0) + 1);
            }

          });

        // Update the count if a matching label found
        if (activityLabelsSet.size > 0) {
          numItemsWithActivity++;
        }

      }

      // -------------------------------------------------------------------------------------------------

      // Organizer info

      if (hasValidOrganizer) {
        let organizerName = organizer.name.trim();
        if (!storeDataQuality.uniqueOrganizers.hasOwnProperty(organizerName)) {
          // Note that these sets are converted to arrays after looping through all items:
          storeDataQuality.uniqueOrganizers[organizerName] = {
            'url': new Set(),
            'email': new Set(),
            'telephone': new Set(),
          };
        }

        // Don't pull urls for images, just top level organisation urls...
        const topUrl1 = organizer.url || null;
        if (typeof topUrl1 === 'string' && topUrl1.trim().length > 0) {
          storeDataQuality.uniqueOrganizers[organizerName]['url'].add(topUrl1.trim());
        }

        for (const key in storeDataQuality.uniqueOrganizers[organizerName]) {
          if (key !== 'url') {
            const val = getProperty(organizer, key);
            if (typeof val === 'string' && val.trim().length > 0) {
              storeDataQuality.uniqueOrganizers[organizerName][key].add(val.trim());
            }
            else if (typeof val === 'number') {
              storeDataQuality.uniqueOrganizers[organizerName][key].add(val);
            }
          }
        }
        numItemsWithOrganizer++;
      }

      // -------------------------------------------------------------------------------------------------

      // Location info

      if (hasValidLocation) {
        let locationName = location.name.trim();
        if (!storeDataQuality.uniqueLocations.hasOwnProperty(locationName)) {
          // Note that these sets are converted to arrays after looping through all items:
          storeDataQuality.uniqueLocations[locationName] = {
            'url': new Set(),
            'email': new Set(),
            'telephone': new Set(),
            'streetAddress': new Set(),
            'postalCode': new Set(),
            'coordinates': new Set(),
          };
        }

        // Don't pull urls for images, just top level location urls...
        const topUrl = location.url || null;
        if (typeof topUrl === 'string' && topUrl.trim().length > 0) {
          storeDataQuality.uniqueLocations[locationName]['url'].add(topUrl.trim());
        }

        // Note that this is 'const key of' rather than 'const key in':
        for (const key of ['email', 'telephone', 'streetAddress', 'postalCode']) {
          const val = getProperty(location, key);
          if (typeof val === 'string' && val.trim().length > 0) {
            storeDataQuality.uniqueLocations[locationName][key].add(val.trim());
          }
          else if (typeof val === 'number') {
            storeDataQuality.uniqueLocations[locationName][key].add(val);
          }
        }
        // The coordinates are stored as a single lat,lon combined string in order to be a single element
        // in the set, which is then relevant for comparing to further coordinates for only adding unique:
        const latitude = getProperty(location, 'latitude');
        const longitude = getProperty(location, 'longitude');
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          storeDataQuality.uniqueLocations[locationName]['coordinates'].add([latitude, longitude].join(','));
        }
        numItemsWithLocation++;
      }

      // -------------------------------------------------------------------------------------------------

      // Name info

      const name = getProperty(item, 'name');

      const hasValidName =
        typeof name === 'string' &&
        name.length > 0 &&
        name != " ";

      if (hasValidName) {
        numItemsWithName++;

      }
      // -------------------------------------------------------------------------------------------------

      // Description info

      const description = getProperty(item, 'description');

      const hasValidDescription =
        typeof description === 'string' &&
        description.length > 0 &&
        description != " ";

      if (hasValidDescription) {
        numItemsWithDescription++;

      }

      // -------------------------------------------------------------------------------------------------

      // URL info

      if (item.DQ_validSessionUrl && item.DQ_validSessionUrl === 1) {
        numItemsWithUrl++;
      }
      if (item.DQ_validSeriesUrl && item.DQ_validSeriesUrl === 1) {
        numParentsWithUniqueUrl++;
      }

      // -------------------------------------------------------------------------------------------------

      //Post results for matching items...

      if (storeDataQuality.numItemsMatchFilters < 100) {
        postResults(item);
      }
      else if (storeDataQuality.numItemsMatchFilters === 100) {
        results.append(
          "<div class='row rowhover'>" +
          "    <div>Only the first 100 items are shown</div>" +
          "</div>"
        );
      }
    }
  }

  //console.log(storeDataQuality.items);

  // ----END-OF-FOR-LOOP------------------------------------------------------------------------------

  if (storeDataQuality.numItemsMatchFilters === 0) {
    results.empty();
    results.append(
      "<div class='row rowhover'>" +
      "    <div>No matching results found.</div>" +
      "</div>"
    );
  }

  // -------------------------------------------------------------------------------------------------

  // Calculate opps and listings counts, post filters

  numChild = numItems;

  uniqueParents = [...new Set(parents)];
  numParents = uniqueParents.length;

  //console.log(`Number of Parents: ${numParents}`);
  //console.log(`Number of Children: ${numChild}`);

  // -------------------------------------------------------------------------------------------------

  // Sort objects by keys in alphabetical order:
  storeDataQuality.uniqueOrganizers = Object.fromEntries(Object.entries(storeDataQuality.uniqueOrganizers).sort());
  storeDataQuality.uniqueLocations = Object.fromEntries(Object.entries(storeDataQuality.uniqueLocations).sort());

  // Convert sets to arrays:
  for (const [organizerName, organizerInfo] of Object.entries(storeDataQuality.uniqueOrganizers)) {
    for (const [key, val] of Object.entries(organizerInfo)) {
      organizerInfo[key] = Array.from(val);
    }
  }
  for (const [locationName, locationInfo] of Object.entries(storeDataQuality.uniqueLocations)) {
    for (const [key, val] of Object.entries(locationInfo)) {
      locationInfo[key] = Array.from(val);
    }
  }

  // Convert 'lat,lon' strings to [lat,lon] numeric arrays:
  for (const [locationName, locationInfo] of Object.entries(storeDataQuality.uniqueLocations)) {
    locationInfo.coordinates = locationInfo.coordinates.map(x => x.split(',').map(x => Number(x)));
  }

  // -------------------------------------------------------------------------------------------------

  updateActivityList(storeDataQuality.uniqueActivities);
  console.log(`Number of unique activities: ${storeDataQuality.uniqueActivities.size}`);
  // console.dir(`uniqueActivities: ${Array.from(storeDataQuality.uniqueActivities)}`);

  updateOrganizerList(storeDataQuality.uniqueOrganizers);
  $("#organizer").empty()
  addOrganizerPanel(storeDataQuality.uniqueOrganizers);
  console.log(`Number of unique organizers: ${Object.keys(storeDataQuality.uniqueOrganizers).length}`);
  // console.dir(`uniqueOrganizers: ${Object.keys(storeDataQuality.uniqueOrganizers)}`);

  updateLocationList(storeDataQuality.uniqueLocations);
  $("#location").empty()
  addLocationPanel(storeDataQuality.uniqueLocations);
  console.log(`Number of unique locations: ${Object.keys(storeDataQuality.uniqueLocations).length}`);
  // console.dir(`uniqueLocations: ${Object.keys(storeDataQuality.uniqueLocations)}`);

  $("#map").empty()
  addMapPanel(storeDataQuality.uniqueLocations);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with present/future dates: ${numItemsNowToFuture}`);
  console.log(`Number of unique past/present/future dates: ${dateCounts.size}`);

  const percent1 = (numItemsNowToFuture / numItems) * 100 || 0;
  const rounded1 = percent1.toFixed(1);

  // Sort the dateCounts Map by date, in ascending order
  const sortedDateCounts = new Map(
    Array.from(dateCounts.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]))
  );

  // Get an array of sorted keys
  const sortedKeys = Array.from(sortedDateCounts.keys());

  // Get the minimum (first) and maximum (last) keys
  const minDate = sortedKeys[0];
  const maxDate = sortedKeys[sortedKeys.length - 1];

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid postcode or lat-lon coordinates: ${numItemsWithGeo}`);

  const percent2 = (numItemsWithGeo / numItems) * 100 || 0;
  const rounded2 = percent2.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with matching activities: ${numItemsWithActivity}`);
  console.log(`Number of unique activities: ${activityCounts.size}`);

  const percent3_a = (numItemsWithActivity / numItems) * 100 || 0;
  const rounded3_a = percent3_a.toFixed(1);

  console.log(`Number of items with name: ${numItemsWithName}`);

  const percent3_b = (numItemsWithName / numItems) * 100 || 0;
  const rounded3_b = percent3_b.toFixed(1);

  console.log(`Number of items with description: ${numItemsWithDescription}`);

  const percent3_c = (numItemsWithDescription / numItems) * 100 || 0;
  const rounded3_c = percent3_c.toFixed(1);

  // Sort the activityCounts Map by activity, in ascending order
  // TODO: Check if b[1] - a[1] is correct order, as this is different from sortedDateCounts
  const sortedActivityCounts = new Map(
    Array.from(activityCounts.entries()).sort((a, b) => b[1] - a[1])
  );

  // Create a new map from the first x entries
  const top10activities = new Map(Array.from(sortedActivityCounts.entries()).slice(0, 5));

  // -------------------------------------------------------------------------------------------------


  console.log(`Number of items with unique URLs (either template or explicit string): ${numItemsWithUrl}`);

  const percent4_a = (numItemsWithUrl / numChild) * 100 || 0;
  const rounded4_a = percent4_a.toFixed(1);

  const percent4_b = (numParentsWithUniqueUrl / numChild) * 100 || 0;
  const rounded4_b = percent4_b.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...


  // -------------------------------------------------------------------------------------------------

  // Hide y axis if no chart to display
  let show_y_axis = false;

  if (activityCounts.size > 0) {
    show_y_axis = true;
  }

  // Show a message if no chart / no matching activities

  let x_axis_title = {};

  if (activityCounts.size < 1) {
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
      if (numParents !== 1) {
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
      data: Array.from(top10activities.values()),
    }],
    dataLabels: {
      enabled: false,
    },
    labels: Array.from(top10activities.keys()),
    colors: ['#71CBF2'],
    title: {
      text: numParents.toLocaleString(),
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
            //alert('Chart clicked')
            console.log(event)
            console.log(chartContext)
            console.log(config)
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
    options_percentItemsWithActivity = filter_chart
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
    options_percentItemsNowToFuture = filter_chart
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
  if (dateCounts.size > 0) {
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
    if (spark6SeriesName.length > 0 && numChild !== 1) {
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
      data: Array.from(sortedDateCounts.values()),
    }],
    labels: Array.from(sortedDateCounts.keys()),
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
      text: numChild.toLocaleString(),
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
  sleep(1400).then(() => { $("#filterRows").fadeIn("slow"); });
  sleep(1400).then(() => {
    document.getElementById("DQ_filterActivities").disabled = false;
    document.getElementById("DQ_filterGeos").disabled = false;
    document.getElementById("DQ_filterDates").disabled = false;
    document.getElementById("DQ_filterUrls").disabled = false;
  });
}
