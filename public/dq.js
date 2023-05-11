function getProperty(obj, propertyName) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === 'object') {
        const prop = getProperty(value, propertyName);
        if (prop) {
          return prop;
        }
      }
      else if (key === propertyName) {
        return value;
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

// This feeds the right data store into the DQ metrics

function runDataQuality(filters) {

  storeSuperEventContentType = null;
  storeSubEventContentType = null;
  numListings = 0;
  numOpps = 0;
  let listings = [];
  let uniqueListings = null;

  // First check for any unpacking of superevents or eventschedules
  if (
    storeSuperEvent &&
    storeSubEvent &&
    storeSuperEvent.feedType === storeSubEvent.feedType
  ) {
    console.log('UNPACK?');

    console.log(`storeSuperEvent items: ${Object.values(storeSuperEvent.items).length}`);
    console.log(`storeSuperEvent feed type: ${storeSuperEvent.feedType}`);
    console.log(`storeSuperEvent item kind: ${storeSuperEvent.itemKind}`);
    console.log(`storeSuperEvent item data type: ${storeSuperEvent.itemDataType}`);

    console.log(`storeSubEvent items: ${Object.values(storeSubEvent.items).length}`);
    console.log(`storeSubEvent feed type: ${storeSubEvent.feedType}`);
    console.log(`storeSubEvent item kind: ${storeSubEvent.itemKind}`);
    console.log(`storeSubEvent item data type: ${storeSubEvent.itemDataType}`);

    console.log(storeSuperEvent);

    //BwD - embedded superevent with series data
    if (
      storeSuperEvent.feedType === 'SessionSeries' &&
      storeSuperEvent.itemDataType === 'ScheduledSession'
    ) {
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
      storeItemsForDataQuality.items = Object.values(storeSuperEvent.items);
    }

    //SportSuite - embedded subevent with session data
    else if (
      storeSuperEvent.feedType === 'SessionSeries' &&
      storeSuperEvent.itemDataType === 'mixed'
    ) {
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
      storeItemsForDataQuality.items = Object.values(storeSubEvent.items);
    }
  }
  else if (
    storeSuperEvent && Object.values(storeSuperEvent.items).length > 0 &&
    storeSubEvent && Object.values(storeSubEvent.items).length > 0 &&
    link
  ) {
    let combinedStoreItems = [];
    for (const storeSubEventItem of Object.values(storeSubEvent.items)) {
      if (storeSubEventItem.data && storeSubEventItem.data[link] && typeof storeSubEventItem.data[link] === 'string') {
        const lastSlashIndex = storeSubEventItem.data[link].lastIndexOf('/');
        const storeSuperEventItemId = storeSubEventItem.data[link].substring(lastSlashIndex + 1);
        // Note that we intentionally use '==' here and not '===' to cater for those storeSuperEventItem.id
        // which are purely numeric and stored as a number rather than a string, so we can still match on
        // storeSuperEventItemId which is always a string:
        const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem => storeSuperEventItem.id == storeSuperEventItemId);
        // If the match isn't found then the super-event has been deleted, so lose the sub-event info:
        if (storeSuperEventItem && storeSuperEventItem.data) {
          // TODO: Double check if this deepcopy attempt correcty preserves type:
          let storeSubEventItemCopy = JSON.parse(JSON.stringify(storeSubEventItem));
          let storeSuperEventItemCopy = JSON.parse(JSON.stringify(storeSuperEventItem));
          storeSubEventItemCopy.data[link] = storeSuperEventItemCopy.data;
          combinedStoreItems.push(storeSubEventItemCopy);
        }
      }
    }
    //console.log(`Combined store contains: ${combinedStoreItems.length} items`);

    for (const storeSubEventItem of combinedStoreItems) {
      if (storeSubEventItem.data && storeSubEventItem.data[link] && storeSubEventItem.data[link].identifier) {
        listings.push(storeSubEventItem.data[link].identifier);
      }
    }
    uniqueListings = [...new Set(listings)];

    numListings = uniqueListings.length;
    numOpps = combinedStoreItems.length;
    storeItemsForDataQuality.items = combinedStoreItems;
  }
  else {

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
    storeItemsForDataQuality.items = Object.values(storeIngressOrder1.items);
    console.warn('No combined store, data quality from selected feed only');
  }

  measureDataQuality(storeItemsForDataQuality.items, filters);
}

// -------------------------------------------------------------------------------------------------


// This applies the DQ checks to the whole data store

function measureDataQuality(items, filters) {

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date();

  let urlCounts = new Map();

  for (const item of items) {

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

    if (item.data && item.data.eventSchedule && item.data.eventSchedule.urlTemplate) {
      item.DQ_validUrl = 1;
    }
    else if (item.data && item.data.url && typeof item.data.url === 'string') {
      urlCounts.set(item.data.url, (urlCounts.get(item.data.url) || 0) + 1);
    }

  }

  // After looping through all items and adding all urls to list - now go back and assign flag to those items with unique urls
  urlCounts.forEach((val, key) => {
    if (val === 1) {
      items.forEach(item => {
        if (item.data && item.data.url && typeof item.data.url === 'string' && item.data.url === key) {
          item.DQ_validUrl = 1;
        }
      });
    }
  });

  postDataQuality(items, filters);

}

// -------------------------------------------------------------------------------------------------

// This calculates DQ scores for the filtered data

function postDataQuality(items, filters) {

  console.log(filters);

  let numItems = 0;

  // -------------------------------------------------------------------------------------------------

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date();
  let dateCounts = new Map();
  let activityCounts = new Map();
  let urlCounts = new Map();


  let numItemsNowToFuture = 0;
  let numItemsWithGeo = 0;
  let numItemsWithActivity = 0;
  let numItemsWithName = 0;
  let numItemsWithDescription = 0;
  let numItemsWithUrl = 0;

  for (const item of items) {

    // Filters 

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
      item.DQ_validUrl || 0;
    let itemMatchesDQUrlFilter =
      filters.DQ_filterUrls === false || (filters.DQ_filterUrls === true && itemPassedDQUrl === 0);


    if (
      (itemMatchesActivity &&
        itemMatchesDay &&
        itemMatchesGender &&
        itemMatchesDQDateFilter &&
        itemMatchesDQActivityFilter &&
        itemMatchesDQGeoFilter &&
        itemMatchesDQUrlFilter)
    ) {

      numItems++;

      // Date info

      // Convert the date to a JavaScript Date object
      const date = new Date(item.data.startDate);

      if (!isNaN(date)) {

        // Check if the date is greater than or equal to today's date
        if (date >= dateNow) {
          numItemsNowToFuture++;
          item.DQ_futureDate = 1;
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
        item.DQ_validGeo = 1;
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
          .forEach((activityId) => {

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
          item.DQ_validActivity = 1;
        }

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
        numItemsWithDescription++;
        item.DQ_validDescription = 1;
      }

      // -------------------------------------------------------------------------------------------------

      // URL info

      if (item.data && item.data.eventSchedule && item.data.eventSchedule.urlTemplate) {
        numItemsWithUrl++;
        item.DQ_validUrl = 1;
      }
      else if (item.data && item.data.url && typeof item.data.url === 'string') {
        urlCounts.set(item.data.url, (urlCounts.get(item.data.url) || 0) + 1);
      }

    }
  }

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

  // TODO: This counts unique explicit URL strings and adds them to the count of URL templates. We
  // are assuming these explicit URL strings are specific booking URLs in many/most cases for this to
  // be the metric we're after, but this may not truly be the case and needs to be investigated.
  urlCounts.forEach((val, key) => {
    if (val === 1) {
      numItemsWithUrl++
      //    //Go back to items and set DQ_validUrl to 1 where key matches url
      //    //items.DQ_validGeo = 1;
    }
  });


  console.log(`Number of items with unique URLs (either template or explicit string): ${numItemsWithUrl}`);

  const percent4 = (numItemsWithUrl / numItems) * 100 || 0;
  const rounded4 = percent4.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...


  // -------------------------------------------------------------------------------------------------

  let show_y_axis = false;
  if (activityCounts.size > 0) {
    show_y_axis = true;
  }

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
      if (numListings !== 1) {
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
      events: {
        click: function (event) {
          if ([...event.target.classList].includes('apexcharts-title-text')) {
            alert('Title clicked')
          }
        }
      }
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
      text: numListings.toLocaleString(),
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
      title: {
        text: "Top Activities",
        offsetX: -20,
        offsetY: -8,
        style: {
          fontSize: '14px',
          fontWeight: 900,
        },
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

  let options_percentItemsWithActivity = {
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
    //title: {
    //  text: 'Valid Name, Description or Activity ID',
    //  align: 'center',
    //  offsetY: 280,
    //},
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
            label: 'Valid Activity ID',
            color: "#888",
            fontSize: "18px",
            formatter: function (w) {
              // By default this function returns the average of all series. The below is just an example to show the use of custom formatter function
              return Math.max(rounded3_a).toFixed(1) + "%";
            }
          }
        }
      }
    }
  }
  chart2 = new ApexCharts(document.querySelector("#apexchart2"), options_percentItemsWithActivity);
  chart2.render();

  // -------------------------------------------------------------------------------------------------

  let options_percentItemsWithGeo = {
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

  chart3 = new ApexCharts(document.querySelector("#apexchart3"), options_percentItemsWithGeo);
  chart3.render();

  // -------------------------------------------------------------------------------------------------

  let options_percentItemsNowToFuture = {
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

  chart4 = new ApexCharts(document.querySelector("#apexchart4"), options_percentItemsNowToFuture);
  chart4.render();

  // -------------------------------------------------------------------------------------------------

  let options_percentItemsWithUrl = {
    chart: {
      width: "100%",
      height: 300,
      type: 'radialBar',
    },
    fill: {
      colors: ['#C76DAC'],
    },
    series: [rounded4],
    labels: [['Unique', 'URLs']],
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
  chart5 = new ApexCharts(document.querySelector("#apexchart5"), options_percentItemsWithUrl);
  chart5.render();


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
    if (spark6SeriesName.length > 0 && numOpps !== 1) {
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
      text: numOpps.toLocaleString(),
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
  chart6.render();

}
