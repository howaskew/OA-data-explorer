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
    `    <div class='col'>${(resolveDate(item, 'startDate') || getProperty(item, 'startDate') || '')}</div>` +
    `    <div class='col'>${(resolveDate(item, 'endDate') || getProperty(item, 'endDate') || '')}</div>` +
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

function setStoreSuperEventAndStoreSubEvent() {
  // console.warn(`${luxon.DateTime.now()} setStoreSuperEventAndStoreSubEvent`);

  if (stopTriggered) { throw new Error('Stop triggered'); }

  storeSuperEvent = null;
  storeSubEvent = null;
  type = null;

  breakpoint:
  for (const store of [storeIngressOrder1, storeIngressOrder2]) {
    // The order of this loop is important, it is in order of precedence for identifying the nature of
    // a feed based on the various labels it has:
    for (const typeTemp of ['feedType', 'itemDataType', 'itemKind']) {
      if (superEventContentTypes.includes(store[typeTemp])) {
        if (store.ingressOrder === 1) {
          storeSuperEvent = storeIngressOrder1;
          storeSubEvent = storeIngressOrder2;
        }
        else if (store.ingressOrder === 2) {
          storeSuperEvent = storeIngressOrder2;
          storeSubEvent = storeIngressOrder1;
        }
      }
      else if (subEventContentTypes.includes(store[typeTemp])) {
        if (store.ingressOrder === 1) {
          storeSubEvent = storeIngressOrder1;
          storeSuperEvent = storeIngressOrder2;
        }
        else if (store.ingressOrder === 2) {
          storeSubEvent = storeIngressOrder2;
          storeSuperEvent = storeIngressOrder1;
        }
      }
      if (storeSuperEvent && storeSubEvent) {
        type = typeTemp;
        break breakpoint;
      }
    }
  }

  if (
    !storeSuperEvent &&
    !storeSubEvent &&
    !type
  ) {
    console.warn('Unknown content type, can\'t determine storeSuperEvent or storeSubEvent');
  }
  else if (storeIngressOrder1[type] === storeIngressOrder2[type]) {
    console.warn(`Matching content type for storeIngressOrder1 and storeIngressOrder2 of '${storeIngressOrder1[type]}', can\'t determine storeSuperEvent or storeSubEvent`);
    storeSuperEvent = null;
    storeSubEvent = null;
  }
  else {

    if (
      type === 'feedType' &&
      subEventContentTypes.includes(storeSuperEvent.itemDataType)
    ) {
      // storeSuperEvent is actually a subEvent feed but was initially misjudged, due to feedType being
      // misleading and assessed before itemDataType
      // e.g. BwD (SessionSeries)
      // e.g. ANGUSalive (SessionSeries)
      console.warn('DQ case 1: subEvent feed with embedded superEvent data');
      cp.text('Unpacking data feed - subEvent feed with embedded superEvent data');

      if (storeSuperEvent.ingressOrder === 1) {
        storeSuperEvent = storeIngressOrder2;
        storeSubEvent = storeIngressOrder1;
      }
      else if (storeSuperEvent.ingressOrder === 2) {
        storeSuperEvent = storeIngressOrder1;
        storeSubEvent = storeIngressOrder2;
      }
      type = 'itemDataType';
      // storeSuperEvent is now probably empty, everything is already in storeSubEvent and we won't need
      // to manually combine later. This should then be going to 'DQ case 4'.
    }

    storeSuperEvent.eventType = 'superEvent';
    storeSubEvent.eventType = 'subEvent';

    if (
      subEventContentTypesSession.includes(storeSubEvent[type]) ||
      subEventContentTypesEvent.includes(storeSubEvent[type])
    ) {
      link = 'superEvent';
    }
    else if (subEventContentTypesSlot.includes(storeSubEvent[type])) {
      link = 'facilityUse';
    }
    else {
      link = null;
      console.warn('No feed linking variable, can\'t seek parents');
    }

    console.log(`Number of storeSuperEvent items: ${Object.keys(storeSuperEvent.items).length}`);
    console.log(`storeSuperEvent feed type: ${storeSuperEvent.feedType}`);
    console.log(`storeSuperEvent item kind: ${storeSuperEvent.itemKind}`);
    console.log(`storeSuperEvent item data type: ${storeSuperEvent.itemDataType}`);

    console.log(`Number of storeSubEvent items: ${Object.keys(storeSubEvent.items).length}`);
    console.log(`storeSubEvent feed type: ${storeSubEvent.feedType}`);
    console.log(`storeSubEvent item kind: ${storeSubEvent.itemKind}`);
    console.log(`storeSubEvent item data type: ${storeSubEvent.itemDataType}`);

  }

}

// -------------------------------------------------------------------------------------------------

function setStoreDataQualityItems() {
  // console.warn(`${luxon.DateTime.now()} setStoreDataQualityItems`);

  if (stopTriggered) { throw new Error('Stop triggered'); }

  showingSample = false;

  if (
    storeSuperEvent &&
    storeSubEvent &&
    Object.values(storeSuperEvent.items)
      .filter(item => item.hasOwnProperty('data') && item.data.hasOwnProperty('subEvent'))
      .length > 0 &&
    Object.keys(storeSubEvent.items).length === 0
  ) {
    // e.g. British Triathlon
    // e.g. SportSuite (SessionSeries)
    // e.g. Trafford (CourseInstance)
    console.warn('DQ case 2: superEvent feed with embedded subEvent data');
    cp.text('Unpacking data feed - superEvent feed with embedded subEvent data');

    clearStore(storeSubEvent);
    link = 'superEvent';

    for (const storeSuperEventItem of Object.values(storeSuperEvent.items)) {
      if (stopTriggered) { throw new Error('Stop triggered'); }
      if (storeSuperEventItem.data && storeSuperEventItem.data.subEvent && Array.isArray(storeSuperEventItem.data.subEvent)) {
        // Here subEvent is the array of all subEvents:
        const { subEvent, ...storeSuperEventItemDataReduced } = storeSuperEventItem.data;
        // Here subEvent is an individual subEvent object from the array of all subEvents. It doesn't clash
        // with the previous definition of subEvent, which is discarded in this loop:
        for (const subEvent of storeSuperEventItem.data.subEvent) {
          const subEventId = subEvent.id || subEvent['@id'] || subEvent.identifier;
          storeSubEvent.items[subEventId] = {
            id: subEventId,
            // These should technically be here too, but leave out to save memory as not currently needed:
            // modified: null,
            // kind: null,
            // state: 'updated',
            data: subEvent,
          };
          storeSubEvent.items[subEventId].data[link] = storeSuperEventItemDataReduced;
        }
      }
    }

    setStoreItemDataType(storeSubEvent);
    storeSubEvent.feedType = storeSubEvent.itemDataType;
    storeSubEvent.itemKind = storeSubEvent.itemDataType;
    storeSubEvent.eventType = 'subEvent';
    storeSubEvent.numItems = Object.keys(storeSubEvent.items).length;

    storeDataQuality.items = Object.values(storeSubEvent.items);
    storeDataQuality.eventType = storeSubEvent.eventType;
  }
  else if (
    storeSuperEvent &&
    storeSubEvent &&
    Object.keys(storeSuperEvent.items).length > 0 &&
    Object.keys(storeSubEvent.items).length > 0 &&
    link
  ) {
    console.warn('DQ case 3: storeSuperEvent and storeSubEvent both obtained and combined');

    storeCombinedItems = [];

    for (const [storeSubEventItemIdx, storeSubEventItem] of Object.values(storeSubEvent.items).entries()) {
      if (stopTriggered) { throw new Error('Stop triggered'); }
      if (storeSubEventItem.data && storeSubEventItem.data[link] && typeof storeSubEventItem.data[link] === 'string') {
        const storeSuperEventItemId = String(storeSubEventItem.data[link]).split('/').at(-1);
        const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem =>
          String(storeSuperEventItem.id).split('/').at(-1) === storeSuperEventItemId ||
          String(storeSuperEventItem.data.id).split('/').at(-1) === storeSuperEventItemId || // BwD facilityUse/slot
          String(storeSuperEventItem.data['@id']).split('/').at(-1) === storeSuperEventItemId
        );
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
        // If it is matched, we have the data in combined items so can delete...
        // Actually, don't try and delete anything, as may still need storeSuperEvent and storeSubEvent elsewhere e.g. setJSONTab()
      }
      cp.text(`Combining Data Feeds: ${storeSubEventItemIdx + 1} of ${Object.keys(storeSubEvent.items).length} items`);
    }

    storeDataQuality.items = storeCombinedItems;
    storeDataQuality.eventType = storeSubEvent.eventType;
  }
  else if (
    storeSubEvent &&
    Object.keys(storeSubEvent.items).length > 0
  ) {
    console.warn('DQ case 4: Data quality from storeSubEvent only');
    storeDataQuality.items = Object.values(storeSubEvent.items);
    storeDataQuality.eventType = storeSubEvent.eventType;
    cp.empty();
  }
  else if (
    storeSuperEvent &&
    Object.keys(storeSuperEvent.items).length > 0
  ) {
    console.warn('DQ case 5: Data quality from storeSuperEvent only');
    storeDataQuality.items = Object.values(storeSuperEvent.items);
    storeDataQuality.eventType = storeSuperEvent.eventType;
    cp.empty();
  }
  else if (
    storeIngressOrder1 &&
    Object.keys(storeIngressOrder1.items).length > 0
  ) {
    console.warn('DQ case 6: Data quality from storeIngressOrder1 only');
    storeDataQuality.items = Object.values(storeIngressOrder1.items);
    cp.empty();
  }
  else if (
    storeIngressOrder2 &&
    Object.keys(storeIngressOrder2.items).length > 0
  ) {
    console.warn('DQ case 7: Data quality from storeIngressOrder2 only');
    storeDataQuality.items = Object.values(storeIngressOrder2.items);
    cp.empty();
  }
  else {
    console.warn('DQ case 8: No data for metrics');
    storeDataQuality.items = [];
    cp.empty();
  }

  if (stopTriggered) { throw new Error('Stop triggered'); }

  // Store sample of data
  const filterString = storeIngressOrder1.firstPage;
  const maxSampleSize = 5;
  const keys = storeDataQuality.items.map(item => item.id);

  if (keys.length > 0) {
    // Delete existing IDs with the filter string
    const deleteQuery = `DELETE FROM openactivesample WHERE id LIKE '%${filterString}%'`;
    fetch('/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deleteQuery }),
    })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        // Handle the server response if needed
      })
      .catch(error => {
        console.error('Error:', error);
        // Handle the error if needed
      });
    // Take random sample
    const keys = storeDataQuality.items.map(item => item.id);
    const sampleSize = Math.min(keys.length, maxSampleSize);
    const sampledKeys = sampleSize < keys.length
      ? Array.from(new Set(Array(sampleSize).fill().map(() => keys[Math.floor(Math.random() * keys.length)])))
      : keys;

    const insertQueryParts = [];
    const values = [];

    for (let i = 0; i < sampledKeys.length; i++) {
      const key = sampledKeys[i];
      const filteredKey = `${key}_${filterString}`;
      const storeDataQualityItem = storeDataQuality.items.find(item => item.id === key);
      const storeItemCopy = JSON.parse(JSON.stringify(storeDataQualityItem));

      insertQueryParts.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
      values.push(filteredKey, storeItemCopy);
    }

    const insertQuery = `INSERT INTO openactivesample (id, data) VALUES ${insertQueryParts.join(', ')}`;

    fetch('/api/insertsample', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ insertQuery, values }),
    })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        // Handle the server response if needed
      })
      .catch(error => {
        console.error('Error:', error);
        // Handle the error if needed
      });
  }

}

// -------------------------------------------------------------------------------------------------

function setStoreDataQualityItemFlags() {
  // console.warn(`${luxon.DateTime.now()} setStoreDataQualityItemFlags`);

  if (stopTriggered) { throw new Error('Stop triggered'); }

  storeDataQuality.dqFlags = new Object();
  storeDataQuality.dqSummary = {
    id: storeIngressOrder1.firstPage,
    numParent: 0,
    numChild: storeDataQuality.items.length,
    DQ_validActivity: 0,
    DQ_validGeo: 0,
    DQ_validDate: 0,
    DQ_validParentUrl: 0,
    DQ_validChildUrl: 0,
    dateUpdated: 0,
  }; // The order of keys here may be important for the PostgreSQL database, see '/api/insert' in app.js

  let dqp = $("#DQProgress");

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date().setHours(0, 0, 0, 0);

  let parents = {};
  let itemUrlsItemIdxs = {};
  let parentIdsItemIdxs = {};
  let parentUrlsParentIdxs = {};

  // -------------------------------------------------------------------------------------------------

  for (const [itemIdx, item] of storeDataQuality.items.entries()) {

    if (stopTriggered) { throw new Error('Stop triggered'); }

    storeDataQuality.dqFlags[item.id] = {
      DQ_validOrganizer: false,
      DQ_validLocation: false,
      DQ_validActivity: false,
      DQ_validName: false,
      DQ_validDescription: false,
      DQ_validGeo: false,
      DQ_validDate: false,
      DQ_validParent: false,
      DQ_validChildUrl: false,
      DQ_validParentUrl: false,
    };

    // Organizer info

    const organizer = resolveProperty(item, 'organizer');

    storeDataQuality.dqFlags[item.id].DQ_validOrganizer =
      typeof organizer === 'object' &&
      !Array.isArray(organizer) &&
      organizer !== null &&
      typeof organizer.name === 'string' &&
      organizer.name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Location info

    const location = resolveProperty(item, 'location');

    storeDataQuality.dqFlags[item.id].DQ_validLocation =
      typeof location === 'object' &&
      !Array.isArray(location) &&
      location !== null &&
      typeof location.name === 'string' &&
      location.name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Activity info

    // An item may be associated with many activities, but here we only care if there is at least one:
    const activities = resolveProperty(item, 'activity');

    storeDataQuality.dqFlags[item.id].DQ_validActivity =
      Array.isArray(activities) &&
      activities
        .map(activity => activity['id'] || activity['@id'])
        .filter(activityId => activityId)
        .map(activityId => matchToActivityList(activityId))
        .filter(prefLabel => prefLabel)
        .length > 0;

    if (storeDataQuality.dqFlags[item.id].DQ_validActivity) {
      storeDataQuality.dqSummary.DQ_validActivity++;
    }

    // -------------------------------------------------------------------------------------------------

    // Name info

    const name = getProperty(item, 'name');

    storeDataQuality.dqFlags[item.id].DQ_validName =
      typeof name === 'string' &&
      name.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Description info

    const description = getProperty(item, 'description');

    storeDataQuality.dqFlags[item.id].DQ_validDescription =
      typeof description === 'string' &&
      description.trim().length > 0;

    // -------------------------------------------------------------------------------------------------

    // Geo info

    const postalCode = getProperty(item, 'postalCode');
    const latitude = getProperty(item, 'latitude');
    const longitude = getProperty(item, 'longitude');

    storeDataQuality.dqFlags[item.id].DQ_validGeo =
      (typeof postalCode === 'string' && postalCode.length > 0 && ukPostalCodeRegex.test(postalCode)) ||
      (typeof latitude === 'number' && typeof longitude === 'number');

    if (storeDataQuality.dqFlags[item.id].DQ_validGeo) {
      storeDataQuality.dqSummary.DQ_validGeo++;
    }

    // -------------------------------------------------------------------------------------------------

    // Date info

    const date = new Date(item.data.startDate);

    storeDataQuality.dqFlags[item.id].DQ_validDate =
      !isNaN(date) &&
      date >= dateNow;

    if (storeDataQuality.dqFlags[item.id].DQ_validDate) {
      storeDataQuality.dqSummary.DQ_validDate++;
    }

    // -------------------------------------------------------------------------------------------------

    // URL info

    if (item.data && item.data.url && typeof item.data.url === 'string') {
      if (!itemUrlsItemIdxs.hasOwnProperty(item.data.url)) {
        itemUrlsItemIdxs[item.data.url] = [];
      }
      itemUrlsItemIdxs[item.data.url].push(itemIdx);
    }

    // -------------------------------------------------------------------------------------------------

    // Parent info

    if (link && item.data && item.data[link]) {
      let parentId = item.data[link].id || item.data[link]['@id'] || item.data[link].identifier || null;
      if (parentId) {
        if (!parents.hasOwnProperty(parentId)) {
          parents[parentId] = item.data[link];
          parentIdsItemIdxs[parentId] = [];
        }
        parentIdsItemIdxs[parentId].push(itemIdx);
      }
      storeDataQuality.dqFlags[item.id].DQ_validParent = parentId !== null;
    }

    // -------------------------------------------------------------------------------------------------

    dqp.text(`Measuring Data Quality: ${itemIdx + 1} of ${storeDataQuality.items.length} items`);
  }

  // -------------------------------------------------------------------------------------------------

  if (stopTriggered) { throw new Error('Stop triggered'); }

  // TODO: This counts unique explicit URL strings. We are assuming these explicit URL strings are
  // specific booking URLs in many/most cases for this to be the metric we're after, but this may not
  // truly be the case and needs to be investigated.

  for (const itemIdxs of Object.values(itemUrlsItemIdxs)) {
    if (itemIdxs.length === 1) {
      Object.values(storeDataQuality.dqFlags)[itemIdxs[0]].DQ_validChildUrl = true;
      storeDataQuality.dqSummary.DQ_validChildUrl++;
    }
  }

  // -------------------------------------------------------------------------------------------------

  for (const [parentIdx, parent] of Object.values(parents).entries()) {
    if (parent.url && typeof parent.url === 'string') {
      if (!parentUrlsParentIdxs.hasOwnProperty(parent.url)) {
        parentUrlsParentIdxs[parent.url] = [];
      }
      parentUrlsParentIdxs[parent.url].push(parentIdx);
    }
  }

  for (const parentIdxs of Object.values(parentUrlsParentIdxs)) {
    if (parentIdxs.length === 1) {
      for (const itemIdx of Object.values(parentIdsItemIdxs)[parentIdxs[0]]) {
        Object.values(storeDataQuality.dqFlags)[itemIdx].DQ_validParentUrl = true;
        storeDataQuality.dqSummary.DQ_validParentUrl++;
      }
    }
  }

  storeDataQuality.dqSummary.numParent = Object.keys(parents).length;

  // -------------------------------------------------------------------------------------------------

  parents = {};
  itemUrlsItemIdxs = {};
  parentIdsItemIdxs = {};
  parentUrlsParentIdxs = {};

  // -------------------------------------------------------------------------------------------------

  if (stopTriggered) { throw new Error('Stop triggered'); }

  // Write feed level data to database

  if (!showingSample) {
    // console.log(storeDataQuality.dqSummary);
    // console.log(storeDataQuality);

    (async () => {
      try {
        const response = await fetch('/api/insert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(storeDataQuality.dqSummary)
        });

        if (response.ok) {
          const insertedData = await response.json();
          console.log('Success inserting DQ summary into database:', insertedData);
        } else {
          console.error('Error inserting DQ summary into database:', response.statusText);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
      }
    })();
  }

}

// -------------------------------------------------------------------------------------------------

// This calculates DQ scores for the filtered data, and shows results

function postDataQuality() {
  // console.warn(`${luxon.DateTime.now()} postDataQuality`);

  if (stopTriggered) { throw new Error('Stop triggered'); }

  disableFilters();
  clearCharts();

  $("#tabs").hide();

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
  storeDataQuality.filteredItemsUniqueActivityIds = new Object();
  storeDataQuality.filteredItemsUniqueParentIds = new Set();
  storeDataQuality.filteredItemsUniqueDates = new Map();

  storeDataQuality.numFilteredItems = 0;
  let numFilteredItemsWithValidActivity = 0;
  let numFilteredItemsWithValidName = 0;
  let numFilteredItemsWithValidDescription = 0;
  let numFilteredItemsWithValidGeo = 0;
  let numFilteredItemsWithValidDate = 0;
  let numFilteredItemsWithValidChildUrl = 0;
  let numFilteredItemsWithValidParentUrl = 0;

  // ----FOR-LOOP-PROCESSING--------------------------------------------------------------------------

  for (const item of storeDataQuality.items) {

    if (stopTriggered) { throw new Error('Stop triggered'); }

    // Filters

    let itemMatchesOrganizer =
      !filters.organizer
        ? true
        : storeDataQuality.dqFlags[item.id].DQ_validOrganizer &&
        resolveProperty(item, 'organizer').name === filters.organizer;

    let itemMatchesLocation =
      !filters.location
        ? true
        : storeDataQuality.dqFlags[item.id].DQ_validLocation &&
        resolveProperty(item, 'location').name === filters.location;

    let itemMatchesActivity =
      !filters.relevantActivitySet
        ? true
        : storeDataQuality.dqFlags[item.id].DQ_validActivity &&
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
      (filters.DQ_filterActivities && !storeDataQuality.dqFlags[item.id].DQ_validActivity);

    let itemMatchesDQGeoFilter =
      !filters.DQ_filterGeos ||
      (filters.DQ_filterGeos && !storeDataQuality.dqFlags[item.id].DQ_validGeo);

    let itemMatchesDQDateFilter =
      !filters.DQ_filterDates ||
      (filters.DQ_filterDates && !storeDataQuality.dqFlags[item.id].DQ_validDate);

    let itemMatchesDQUrlFilter =
      !filters.DQ_filterUrls ||
      (filters.DQ_filterUrls && !storeDataQuality.dqFlags[item.id].DQ_validChildUrl);

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

      if (storeDataQuality.dqFlags[item.id].DQ_validOrganizer) {
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

        // Don't pull URLs for images, just top level organisation URLs:
        const topUrl = organizer.url || null;
        if (typeof topUrl === 'string' && topUrl.trim().length > 0) {
          storeDataQuality.filteredItemsUniqueOrganizers[organizerName]['url'].add(topUrl.trim());
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validLocation) {
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

        // Don't pull URLs for images, just top level location URLs:
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

      if (storeDataQuality.dqFlags[item.id].DQ_validActivity) {
        let activities = resolveProperty(item, 'activity');
        let itemUniqueActivityIds = new Set();

        activities
          .map(activity => activity['id'] || activity['@id'])
          .filter(activityId => activityId)
          .forEach(activityId => {
            let prefLabel = matchToActivityList(activityId);
            if (prefLabel) {
              itemUniqueActivityIds.add(activityId);
              if (!storeDataQuality.filteredItemsUniqueActivityIds.hasOwnProperty(activityId)) {
                storeDataQuality.filteredItemsUniqueActivityIds[activityId] = 0;
              }
              storeDataQuality.filteredItemsUniqueActivityIds[activityId] += 1;
            }
          });

        if (itemUniqueActivityIds.size > 0) {
          numFilteredItemsWithValidActivity++;
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validName) {
        numFilteredItemsWithValidName++;
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validDescription) {
        numFilteredItemsWithValidDescription++;
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validGeo) {
        numFilteredItemsWithValidGeo++;
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validDate) {
        numFilteredItemsWithValidDate++;
        const date = new Date(item.data.startDate);
        const dateString = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        storeDataQuality.filteredItemsUniqueDates.set(dateString, (storeDataQuality.filteredItemsUniqueDates.get(dateString) || 0) + 1);
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validParent) {
        let parentId = item.data[link].id || item.data[link]['@id'] || item.data[link].identifier || null;
        if (parentId) {
          storeDataQuality.filteredItemsUniqueParentIds.add(parentId);
        }
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validChildUrl) {
        numFilteredItemsWithValidChildUrl++;
      }

      // -------------------------------------------------------------------------------------------------

      if (storeDataQuality.dqFlags[item.id].DQ_validParentUrl) {
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

  if (stopTriggered) { throw new Error('Stop triggered'); }

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

  // Sort objects by keys in ascending alphabetical order:
  storeDataQuality.filteredItemsUniqueOrganizers = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueOrganizers).sort());
  storeDataQuality.filteredItemsUniqueLocations = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueLocations).sort());
  // Sort objects by values in descending numerical order:
  storeDataQuality.filteredItemsUniqueActivityIds = Object.fromEntries(Object.entries(storeDataQuality.filteredItemsUniqueActivityIds).sort((a, b) => b[1] - a[1]));

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
  const topActivities = new Map(Object.entries(storeDataQuality.filteredItemsUniqueActivityIds).slice(0, 5));

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

  updateActivityList(storeDataQuality.filteredItemsUniqueActivityIds);
  console.log(`Number of unique activities: ${Object.keys(storeDataQuality.filteredItemsUniqueActivityIds).length}`);
  // console.dir(`storeDataQuality.filteredItemsUniqueActivityIds: ${Object.keys(storeDataQuality.filteredItemsUniqueActivityIds)}`);

  console.log(`Number of unique present/future dates: ${storeDataQuality.filteredItemsUniqueDates.size}`);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with matching activities: ${numFilteredItemsWithValidActivity}`);

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

  console.log(`Number of items with valid URLs: ${numFilteredItemsWithValidChildUrl}`);

  const percent4_a = (numFilteredItemsWithValidChildUrl / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded4_a = percent4_a.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with valid parent URLs: ${numFilteredItemsWithValidParentUrl}`);

  const percent4_b = (numFilteredItemsWithValidParentUrl / storeDataQuality.numFilteredItems) * 100 || 0;
  const rounded4_b = percent4_b.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...

  // -------------------------------------------------------------------------------------------------

  if (stopTriggered) { throw new Error('Stop triggered'); }

  if (!showingSample) {
    let spark1Count;
    let spark6Count;
    let spark1SeriesName = '';
    let spark6SeriesName = '';

    if (storeDataQuality.eventType === 'subEvent') {
      spark1Count = storeDataQuality.filteredItemsUniqueParentIds.size;
      spark6Count = storeDataQuality.numFilteredItems;
      setSpark1SeriesName();
      setSpark6SeriesName();
      setSpark1SeriesNameAndSpark6SeriesName();
    }
    else if (storeDataQuality.eventType === 'superEvent') {
      spark1Count = storeDataQuality.numFilteredItems;
      spark6Count = storeDataQuality.filteredItemsUniqueParentIds.size;
      setSpark1SeriesName();
      spark6SeriesName = 'Parent' + ((spark6Count !== 1) ? 's' : '');
    }
    else {
      spark1Count = storeDataQuality.filteredItemsUniqueParentIds.size;
      spark6Count = storeDataQuality.numFilteredItems;
      spark1SeriesName = 'Parent' + ((spark1Count !== 1) ? 's' : '');
      spark6SeriesName = 'Child' + ((spark6Count !== 1) ? 'ren' : '');
    }

    function setSpark1SeriesName() {
      if (superEventContentTypesSeries.includes(storeSuperEvent[type])) {
        spark1SeriesName = 'Session series';
      }
      else if (superEventContentTypesFacility.includes(storeSuperEvent[type])) {
        spark1SeriesName = 'Facility use' + ((spark1Count !== 1) ? 's' : '');
      }
      else if (storeSuperEvent[type] === 'EventSeries') {
        spark1SeriesName = 'Event series';
      }
      else if (storeSuperEvent[type] === 'HeadlineEvent') {
        spark1SeriesName = 'Headline event' + ((spark1Count !== 1) ? 's' : '');
      }
      else if (superEventContentTypesCourse.includes(storeSuperEvent[type])) {
        spark1SeriesName = 'Course' + ((spark1Count !== 1) ? 's' : '');
      }
      else {
        if (storeDataQuality.eventType === 'subEvent') {
          spark1SeriesName = 'Parent' + ((spark1Count !== 1) ? 's' : '');
        }
        else if (storeDataQuality.eventType === 'superEvent') {
          spark1SeriesName = 'Child' + ((spark1Count !== 1) ? 'ren' : '');
        }
        console.warn('Unhandled storeSuperEvent content type. New content types may have been introduced but not catered for at this point in the code, check the listings elsewhere in the code.');
      }
    }

    function setSpark6SeriesName() {
      if (subEventContentTypesSession.includes(storeSubEvent[type])) {
        spark6SeriesName = 'Scheduled session' + ((spark6Count !== 1) ? 's' : '');
      }
      else if (subEventContentTypesSlot.includes(storeSubEvent[type])) {
        spark6SeriesName = 'Slot' + ((spark6Count !== 1) ? 's' : '');
      }
      else if (subEventContentTypesEvent.includes(storeSubEvent[type])) {
        spark6SeriesName = 'Event' + ((spark6Count !== 1) ? 's' : '');
      }
      else {
        spark6SeriesName = 'Child' + ((spark6Count !== 1) ? 'ren' : '');
        console.warn('Unhandled storeSubEvent content type. New content types may have been introduced but not catered for at this point in the code, check the listings elsewhere in the code.');
      }
    }

    function setSpark1SeriesNameAndSpark6SeriesName() {
      // At this point, we should have non-empty settings for both spark1SeriesName and spark6SeriesName.
      // It may however be possible for one of these to include 'Parent'/'Child' and the other one to be
      // more specific. If this is so, we can use knowledge of the latter to adjust the former:
      if (
        (spark1SeriesName.includes('Parent') || spark1SeriesName.includes('Child')) &&
        (!spark6SeriesName.includes('Parent') && !spark6SeriesName.includes('Child'))
      ) {
        if (spark6SeriesName.includes('Scheduled session')) {
          spark1SeriesName = 'Session series';
        }
        else if (spark6SeriesName.includes('Slot')) {
          spark1SeriesName = 'Facility use' + ((spark1Count !== 1) ? 's' : '');
        }
        // We don't actually know what to do in the child case of 'Event', as the parent could be 'Event series',
        // 'Headline event' or 'Course', so we leave the parent label as 'Parent':
        // else if (spark6SeriesName.includes('Event')) {
        // }
      }
      else if (
        (spark6SeriesName.includes('Parent') || spark6SeriesName.includes('Child')) &&
        (!spark1SeriesName.includes('Parent') && !spark1SeriesName.includes('Child'))
      ) {
        if (spark1SeriesName.includes('Session series')) {
          spark6SeriesName = 'Scheduled session' + ((spark6Count !== 1) ? 's' : '');
        }
        else if (spark1SeriesName.includes('Facility use')) {
          spark6SeriesName = 'Slot' + ((spark6Count !== 1) ? 's' : '');
        }
        else if (spark1SeriesName.includes('Event series')) {
          spark6SeriesName = 'Event' + ((spark6Count !== 1) ? 's' : '');
        }
        else if (spark1SeriesName.includes('Course')) {
          spark6SeriesName = 'Event' + ((spark6Count !== 1) ? 's' : '');
        }
      }
    }


    // -------------------------------------------------------------------------------------------------

    $('#clear').prop('disabled', true);
    $('#output').fadeIn('slow');

    // -------------------------------------------------------------------------------------------------

    // Hide y axis if no chart to display
    let show_y_axis = false;

    if (Object.keys(storeDataQuality.filteredItemsUniqueActivityIds).length > 0) {
      show_y_axis = true;
    }

    // Show a message if no chart / no matching activities

    let x_axis_title = {};

    if (Object.keys(storeDataQuality.filteredItemsUniqueActivityIds).length < 1) {
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
      labels: Array.from(topActivities.keys()).map(activityId => matchToActivityList(activityId)),
      colors: ['#71CBF2'],
      title: {
        text: spark1Count.toLocaleString(),
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
        labels: ['Have activity IDs', 'Have names', 'Have descriptions'],
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
                label: ['Have activity IDs'],
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

    sleep(200).then(() => { chart2.render().then(() => chart2rendered = true); });

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
        labels: [['Have postcode', 'or coordinates']],
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
    sleep(400).then(() => { chart3.render().then(() => chart3rendered = true); });

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
        labels: [['Have future', 'start dates']],
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
    sleep(600).then(() => { chart4.render().then(() => chart4rendered = true); });

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
      labels: ['Have URLs'],
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
        labels: ['Have parent URLs'],
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
      chart5a.render().then(() => chart5arendered = true);
      chart5b.render().then(() => chart5brendered = true);
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
        text: spark6Count.toLocaleString(),
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
    sleep(1200).then(() => { chart6.render().then(() => chart6rendered = true); });

  }
  else {
    // Alternative display of counts and metrics for sample data
    // Get counts
    console.log(summary);

    let sparkTotal1 = {
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
      },
      plotOptions: {
      },
      series: [],
      dataLabels: {
        enabled: false,
      },
      colors: ['#71CBF2'],
      title: {
        text: summary.sum1.toLocaleString(),
        align: 'left',
        offsetX: 0,
        style: {
          fontSize: '30px',
          cssClass: 'apexcharts-yaxis-title'
        }
      },
      subtitle: {
        text: ["Session Series","Facility Uses"],
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
        show: false,
        showForNullSeries: false,
        labels : {
          show: false
       },
        floating: false, //true takes y axis out of plot space
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false
        }
      },
      yaxis: {
        show: false,
        showForNullSeries: false,
        floating: false, //true takes y axis out of plot space
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false
        }
      },
    }

    chart1 = new ApexCharts(document.querySelector("#apexchart1"), sparkTotal1);
    chart1.render();

   
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
      dataLabels: {
        enabled: false
      },
      series: [],
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
        show: false,
        floating: false,
        labels: {
          show: false,
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
        text: summary.sum2.toLocaleString(),
        align: 'right',
        offsetX: 0,
        style: {
          fontSize: '30px',
          cssClass: 'apexcharts-yaxis-title'
        }
      },
      subtitle: {
        text: ["Scheduled Sessions","Facility Use Slots","Events"],
        align: 'right',
        offsetY: 40,
        style: {
          fontSize: '18px',
          cssClass: 'apexcharts-yaxis-title'
        }
      }
    }

    chart6 = new ApexCharts(document.querySelector("#apexchart6"), spark6);
    chart6.render().then(() => chart6rendered = true);
    $("#apiTab").addClass("disabled");
    $("#apiPanel").addClass("disabled");
    $('#clear').prop('disabled', true);
    $('#output').fadeIn('slow');
  }

  // -------------------------------------------------------------------------------------------------

  sleep(1400).then(() => { $('#tabs').fadeIn('slow'); });
  sleep(1600).then(() => {
    if (storeDataQuality.numFilteredItems !== 0) {
      $('#filterRows').fadeIn('slow');
    }
    enableFilters();
  });
  sleep(1800).then(() => {
    inProgress = false;
    $('#stopping').empty();
    $('#execute').prop('disabled', endpoint === null); // Ensure the execute button is disabled if we are showing sample data, as no valid endpoint to run
    $('#clear').prop('disabled', false); // Allow the clear button to be shown even if we are showing sample data, for clearing filters
  });

}
