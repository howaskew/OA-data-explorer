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

  if (store.type === 1) {

    let uniqueUrlStems = [];
    if (['ScheduledSession', 'Slot'].includes(store.itemDataType)) {
      const urlStems = Object.values(store.items).reduce((accumulator, item) => {
        if (item.data && item.data.type && typeof item.data.type === 'string') {
          if (item.data.type === 'ScheduledSession' && item.data.superEvent && typeof item.data.superEvent === 'string') {
            link = 'superEvent';
          }
          else if (item.data.type === 'Slot' && item.data.facilityUse && typeof item.data.facilityUse === 'string') {
            link = 'facilityUse';
          }
        }
        if (link) {
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

    if (store.itemDataType === 'SessionSeries') {
      store2.firstPage = store1.firstPage.replace('session-series', 'scheduled-sessions');
    }
    else if (store.itemDataType === 'ScheduledSession' && uniqueUrlStems.length > 0) {
      store2.firstPage = store1.firstPage.replace('scheduled-sessions', 'session-series');
    }
    else if (store.itemDataType === 'FacilityUse') {
      store2.firstPage = store1.firstPage.replace('facility-uses', 'slots');
    }
    else if (store.itemDataType === 'Slot' && uniqueUrlStems.length > 0) {
      store2.firstPage = store1.firstPage.replace('slots', 'facility-uses');
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
      console.warn('No related feed');
      postDataQuality(Object.values(store1.items));
    }
  }
  else if (store.type === 2) {

    let storeSuperEvent = null;
    let storeSubEvent = null;
    if (['SessionSeries', 'FacilityUse'].includes(store1.itemDataType) && ['ScheduledSession', 'Slot'].includes(store2.itemDataType)) {
      storeSuperEvent = store1;
      storeSubEvent = store2;
    }
    else if (['ScheduledSession', 'Slot'].includes(store1.itemDataType) && ['SessionSeries', 'FacilityUse'].includes(store2.itemDataType)) {
      storeSuperEvent = store2;
      storeSubEvent = store1;
    }

    if (storeSubEvent && storeSubEvent.itemDataType === 'ScheduledSession') {
      link = 'superEvent';
    }
    else if (storeSubEvent && storeSubEvent.itemDataType === 'Slot') {
      link = 'facilityUse';
    }

    if (storeSuperEvent && storeSubEvent && link) {
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
    else {
      console.warn('No combined store');
      postDataQuality(Object.values(store1.items));
    }
  }

}

// -------------------------------------------------------------------------------------------------

function postDataQuality(items) {

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
  let activityCounts = new Map()

  let numItemsNowToFuture = 0;
  let numItemsWithGeo = 0;
  let numItemsWithActivity = 0;

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
      postalCode &&
      postalCode.length > 0 &&
      ukPostalCodeRegex.test(postalCode);

    const hasValidLatLon =
      latitude &&
      latitude.length > 0 &&
      longitude &&
      longitude.length > 0;

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

  }

  // -------------------------------------------------------------------------------------------------

  console.log(`Number of items with future dates: ${numItemsNowToFuture}`);
  console.log(`Number of unique future dates: ${dateCounts.size}`);

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

  // OUTPUT THE METRICS TO THE HTML...

  // -------------------------------------------------------------------------------------------------

  let spark1 = {
    chart: {
      id: 'bar1',
      group: 'sparklines',
      type: 'bar',
      height: 300,
      toolbar: {
        show: false
      },
      sparkline: {
        enabled: false,
      },
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
        left: -10,
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
        text: "Top Actvities",
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
      labels: {
        show: true,
        align: 'right',
        minWidth: 0,
        maxWidth: 80,
        offsetX: 12,
        offsetY: 2,
        //formatter: (value) => { return val },
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

  var options_percentItemsNowToFuture = {
    chart: {
      height: 300,
      type: 'radialBar',
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

  var options_percentItemsWithGeo = {
    chart: {
      height: 300,
      type: 'radialBar',
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

  var options_percentItemsWithActivity = {
    chart: {
      height: 300,
      type: 'radialBar',
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
  // -------------------------------------------------------------------------------------------------

  var options_percentItemsWithUrl = {
    chart: {
      height: 300,
      type: 'radialBar',
    },
    series: [rounded3],
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
