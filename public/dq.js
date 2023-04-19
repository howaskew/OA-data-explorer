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
    //console.log('Match');
    //console.log(concept);
    //return new Set([id].concat(concept.getNarrowerTransitive().map(concept => concept.id)));
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function runDataQuality(store) {

  if (store.type === 1) {

    //Notes:
    //This works for ScheduledSession feeds with embedded link to SessionSeries (e.g. Active Newham)
    //This will not trigger loading second feed where SessionSeries contains superevent (e.g. Castle Point)

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
      // Not the url needed but can use it as a flag that superEvents exist
      // and then extract stem from endpoint and try adding required text
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

    if (storeSubEvent.itemDataType === 'ScheduledSession') {
      link = 'superEvent';
    }
    else if (storeSubEvent.itemDataType === 'Slot') {
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

  const numItems = items.length;
  const numItemsForDisplay = numItems.toLocaleString();

  // -------------------------------------------------------------------------------------------------

  // Get today's date
  const dateNow = new Date();
  let dateCounts = new Map();

  // Loop through the data to count the matching dates
  let numItemsNowToFuture = 0;
  for (const item of items) {
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
      if (dateCounts.has(dateString)) {
        dateCounts.set(dateString, dateCounts.get(dateString) + 1);
      }
      else {
        dateCounts.set(dateString, 1);
      }
    } else {
      // Handle the case where the date is not valid
      console.log(`Invalid date: ${date}`);
    }

  }

  // Sort the dateCounts Map by date, in ascending order
  const sortedDateCounts = new Map(
    Array.from(dateCounts.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]))
  );

  // Get an array of sorted keys
  const sortedKeys = Array.from(sortedDateCounts.keys());

  // Get the minimum (first) and maximum (last) keys
  const minDate = sortedKeys[0];
  const maxDate = sortedKeys[sortedKeys.length - 1];

  // Log the counts of unique future dates and all dates, and the count for each date
  console.log(`There are ${numItemsNowToFuture} future dates`);
  console.log(`There are ${dateCounts.size} unique dates in the data`);

  const percent1 = (numItemsNowToFuture / numItems) * 100 || 0;
  const rounded1 = percent1.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  const ukPostalCodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  // Filter the data array to get objects with a valid postcode or geospatial coordinates
  const itemsWithGeo = items.filter((item) => {
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
    return hasValidPostalCode || hasValidLatLon;
  });

  // Get the count of valid data objects
  const numItemsWithGeo = itemsWithGeo.length;

  console.log(`Number of items with valid postcode or lat-lon coordinates: ${numItemsWithGeo}`);

  const percent2 = (numItemsWithGeo / numItems) * 100 || 0;
  const rounded2 = percent2.toFixed(1);


  // -------------------------------------------------------------------------------------------------

  // Handling Activities

  // Loop through the data to count activities
  let numItemsWithActivity = 0;
  for (const item of items) {
    let activities = resolveProperty(item, 'activity');
    if (Array.isArray(activities)) {
      activities
        .map(activity => activity.id || activity['@id'])
        .filter(activityId => activityId)
        .forEach((activityId) => {
          matchToActivityList(activityId);
          numItemsWithActivity++;
        });
    }
  }

  console.log(`Number of items with matching activity: ${numItemsWithActivity}`);

  const percent3 = (numItemsWithActivity / numItems) * 100 || 0;
  const rounded3 = percent3.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...

  // -------------------------------------------------------------------------------------------------

  let numListingsForDisplay = numItemsForDisplay;

  let spark1 = {
    chart: {
      id: 'bar1',
      group: 'sparklines',
      type: 'bar',
      height: 300,
      toolbar: {
        show: false
      }
    },
    fill: {
      opacity: 1,
    },
    series: [{
      name: 'Sessions/Slots',
      data: Array.from(sortedDateCounts.values()),
    }],
    labels: Array.from(sortedDateCounts.keys()),
    colors: ['#DCE6EC'],
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
    }
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
      //sparkline: {
      // enabled: true
      //},
    },
    stroke: {
      curve: 'smooth'
    },
    fill: {
      opacity: 1,
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
    colors: ['#DCE6EC'],
    title: {
      text: numItemsForDisplay,
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
