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

// -------------------------------------------------------------------------------------------------

function runDataQuality(store) {

  if (store && subEventFeedTypes.includes(store.feedType)) {

    if (store.feedType === 'ScheduledSession') {
      link = 'superEvent';
    }
    else if (store.feedType === 'Slot') {
      link = 'facilityUse';
    }

    const urlStems = Object.values(store.items).reduce((accumulator, item) => {
      if (link && item.data && item.data[link]) {
        const lastSlashIndex = item.data[link].lastIndexOf('/');
        const urlStem = item.data[link].substring(0, lastSlashIndex);
        accumulator.push(urlStem);
      }
      return accumulator;
    }, []);

    uniqueUrlStems = [...new Set(urlStems)];

    console.log(`Unique URL stems: ${uniqueUrlStems}`);
    // Can be used as a check of the url(s) for related feeds
  }

  if (store.ingressOrder === 1) {

    // TODO: We used to include this in the following ScheduledSession and Slot conditions, but not now
    // in order to get store2 regardless. Is the uniqueUrlStems stuff now obsolete?
    //   && uniqueUrlStems.length > 0
    if (store.feedType === 'SessionSeries') {
      store2.firstPage = store1.firstPage.replace('session-series', 'scheduled-sessions');
    }
    else if (store.feedType === 'ScheduledSession') {
      store2.firstPage = store1.firstPage.replace('scheduled-sessions', 'session-series');
    }
    else if (store.feedType === 'FacilityUse') {
      store2.firstPage = store1.firstPage.replace('facility-uses', 'slots');
    }
    else if (store.feedType === 'IndividualFacilityUse') {
      store2.firstPage = store1.firstPage.replace('individual-facility-uses', 'slots');
    }
    else if (store.feedType === 'Slot') {
      store2.firstPage = store1.firstPage.replace('slots', 'facility-uses');
      if (!(store2.firstPage in feeds)) {
        store2.firstPage = store1.firstPage.replace('slots', 'individual-facility-uses');
        if (!(store2.firstPage in feeds)) {
          store2.firstPage = null;
        }
      }
    }

    if (store2.firstPage) {
      console.log(`store1 endpoint: ${store1.firstPage}`);
      console.log(`store2 endpoint: ${store2.firstPage}`);

      let filters = {
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

      setStoreItems(store2.firstPage, store2, filters);
    }
    else {
      console.warn('No related feed, data quality from first store only');
      postDataQuality(Object.values(store1.items));
    }
  }
  else if (store.ingressOrder === 2) {

    if (superEventFeedTypes.includes(store1.feedType) && subEventFeedTypes.includes(store2.feedType)) {
      storeSuperEvent = store1;
      storeSubEvent = store2;
    }
    else if (subEventFeedTypes.includes(store1.feedType) && superEventFeedTypes.includes(store2.feedType)) {
      storeSuperEvent = store2;
      storeSubEvent = store1;
    }

    if (!link) {
      console.warn('No feed linking variable, can\'t create combined store');
    }

    if (storeSuperEvent && Object.values(storeSuperEvent.items).length > 0 &&
        storeSubEvent && Object.values(storeSubEvent.items).length > 0 &&
        link
    ) {
      let combinedStoreItems = [];
      for (const storeSubEventItem of Object.values(storeSubEvent.items)) {
        if (storeSubEventItem.data && storeSubEventItem.data[link] && typeof storeSubEventItem.data[link] === 'string') {
          const lastSlashIndex = storeSubEventItem.data[link].lastIndexOf('/');
          const storeSuperEventItemId = storeSubEventItem.data[link].substring(lastSlashIndex + 1);
          const storeSuperEventItem = Object.values(storeSuperEvent.items).find(storeSuperEventItem => storeSuperEventItem.id === storeSuperEventItemId);
          // If the match isn't found then the super-event has been deleted, so lose the sub-event info
          if (storeSuperEventItem && storeSuperEventItem.data) {
            // TODO: Double check if this deepcopy attempt correcty preserves type:
            let storeSubEventItemCopy = JSON.parse(JSON.stringify(storeSubEventItem));
            let storeSuperEventItemCopy = JSON.parse(JSON.stringify(storeSuperEventItem));
            storeSubEventItemCopy.data[link] = storeSuperEventItemCopy.data;
            combinedStoreItems.push(storeSubEventItemCopy);
          }
        }
      }
      //console.log(`Combinded dataset contains: ${combinedStoreItems.length} items`);
      postDataQuality(combinedStoreItems);
    }
    else if (storeSuperEvent && Object.values(storeSuperEvent.items).length > 0) {
        console.warn('No combined store, data quality from super-events only');
        postDataQuality(Object.values(storeSuperEvent.items));
    }
    else if (storeSubEvent && Object.values(storeSubEvent.items).length > 0) {
      console.warn('No combined store, data quality from sub-events only');
      postDataQuality(Object.values(storeSubEvent.items));
    }
    else {
      console.warn('No combined store and no separate stores, so no data quality');
    }
  }

}

// -------------------------------------------------------------------------------------------------

function postDataQuality(items) {

  //console.log(items);

  $('#summary').empty();

  // Count bookable opportunities - the number of unique items from subevent that appear in combined store (after matching)
  let numOpps = 0;
  if (link) {
    numOpps = items.length;
  }
  const numOppsForDisplay = numOpps.toLocaleString();

  // Count listings opportunities - the number of unique items from superevent that appear in combined store (after matching)
  let numListings = items.length;
  if (link) {
    let listings = [];
    for (const item of items) {
      if (item.data && item.data[link] && item.data[link].identifier) {
        listings.push(item.data[link].identifier);
      }
    }
    let uniqueListings = [...new Set(listings)];
    numListings = uniqueListings.length;
  }
  const numListingsForDisplay = numListings.toLocaleString();

  // numItems still used in calculation of percentages
  const numItems = items.length;

  // -------------------------------------------------------------------------------------------------

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  const dateNow = new Date();
  let dateCounts = new Map();
  let activityCounts = new Map();
  let urlCounts = new Map();

  let numItemsNowToFuture = 0;
  let numItemsWithGeo = 0;
  let numItemsWithActivity = 0;
  let numItemsWithUrl = 0;

  for (const item of items) {

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
      console.log(`Invalid date: ${date}`);
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
      }

    }

    // -------------------------------------------------------------------------------------------------

    // URL info

    if (item.data && item.data.eventSchedule && item.data.eventSchedule.urlTemplate) {
      numItemsWithUrl++;
    }
    else if (item.data && item.data.url && typeof item.data.url === 'string') {
      urlCounts.set(item.data.url, (urlCounts.get(item.data.url) || 0) + 1);
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

  const percent3 = (numItemsWithActivity / numItems) * 100 || 0;
  const rounded3 = percent3.toFixed(1);

  // Sort the activityCounts Map by activity, in ascending order
  // TODO: Check if b[1] - a[1] is correct order, as this is different from sortedDateCounts
  const sortedActivityCounts = new Map(
    Array.from(activityCounts.entries()).sort((a, b) => b[1] - a[1])
  );

  // Create a new map from the first 10 entries
  const top10activities = new Map(Array.from(sortedActivityCounts.entries()).slice(0, 6));

  // -------------------------------------------------------------------------------------------------

  // TODO: This counts unique explicit URL strings and adds them to the count of URL templates. We
  // are assuming these explicit URL strings are specific booking URLs in many/most cases for this to
  // be the metric we're after, but this may not truly be the case and needs to be investigated.
  urlCounts.forEach((val, key) => { if (val === 1) { numItemsWithUrl++ } });

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
      name: 'Sessions/Slots',
      data: Array.from(top10activities.values()),
    }],
    dataLabels: {
      enabled: false,
    },
    labels: Array.from(top10activities.keys()),
    colors: ['#71CBF2'],
    title: {
      text: numListingsForDisplay,
      align: 'left',
      offsetX: 0,
      style: {
        fontSize: '30px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: 'Listings',
      align: 'left',
      offsetX: 0,
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
        offsetY: -15
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
          for (var i = 0; i < words.length; i++) {
            var testLine = line + words[i];
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

  new ApexCharts(document.querySelector("#apexchart1"), spark1).render();


  // -------------------------------------------------------------------------------------------------

  var options_percentItemsWithActivity = {
    chart: {
      width: "100%",
      height: 300,
      type: 'radialBar',
    },
    fill: {
      colors: ['#A7ABDA'],
    },
    series: [rounded3],
    labels: [['Valid Activity', 'ID']],
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
  new ApexCharts(document.querySelector("#apexchart2"), options_percentItemsWithActivity).render();

  // -------------------------------------------------------------------------------------------------

  var options_percentItemsWithGeo = {
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

  new ApexCharts(document.querySelector("#apexchart3"), options_percentItemsWithGeo).render();

  // -------------------------------------------------------------------------------------------------

  var options_percentItemsNowToFuture = {
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

  new ApexCharts(document.querySelector("#apexchart4"), options_percentItemsNowToFuture).render();

  // -------------------------------------------------------------------------------------------------

  var options_percentItemsWithUrl = {
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
  new ApexCharts(document.querySelector("#apexchart5"), options_percentItemsWithUrl).render();


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
      name: 'Sessions/Slots',
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
      text: numOppsForDisplay,
      align: 'right',
      offsetX: 0,
      style: {
        fontSize: '30px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: 'Bookable Opportunities',
      align: 'right',
      offsetX: 0,
      style: {
        fontSize: '18px',
        cssClass: 'apexcharts-yaxis-title'
      }
    }
  }

  new ApexCharts(document.querySelector("#apexchart6"), spark6).render();

}
