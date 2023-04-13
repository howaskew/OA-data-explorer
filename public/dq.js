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
  let concept = scheme.getConceptByID(id);
  if (concept) {
    //console.log('Match');
    //console.log(concept);
    //return new Set([id].concat(concept.getNarrowerTransitive().map(concept => concept.id)));
  }
  return null;
}

// -------------------------------------------------------------------------------------------------

function runDataQuality(store) {

  if (store.type === 1)
  {
    // store1Items = Object.values(store1.items); //getLatestUpdatedItems(store, true);

    //Notes:
    //This works for ScheduledSession feeds with embedded link to SessionSeries (e.g. Active Newham)
    //This will not trigger loading second feed where SessionSeries contains superevent (e.g. Castle Point)
    const urlStems = Object.values(store1.items).reduce((accumulator, item) => {
      if (  item.data &&
            item.data.superEvent &&
            typeof item.data.superEvent === 'string' ) {
        const lastSlashIndex = item.data.superEvent.lastIndexOf("/");
        const urlStem = item.data.superEvent.substring(0, lastSlashIndex);
        accumulator.push(urlStem);
      }
      return accumulator;
    }, []);

    let uniqueUrlStems = urlStems.filter((urlStem, index) => {
      return urlStems.indexOf(urlStem) === index;
    });

    if (  uniqueUrlStems &&
          uniqueUrlStems.length > 0 ) {

      console.log(`Unique URL stems: ${uniqueUrlStems}`);
      // Not the url needed but can use it as a flag that superEvents exist
      // and then extract stem from endpoint and try adding required text

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

      store2.firstPage = store1.firstPage.replace("scheduled-sessions", "session-series");

      console.log(`Original endpoint: ${store1.firstPage}`);
      console.log(`New endpoint: ${store2.firstPage}`);

      setStoreItems(store2.firstPage, store2, filters);
    }
    else {
      postDataQuality(Object.values(store1.items));
    }
  }
  else if (store.type === 2) {
    // store2Items = Object.values(store2.items); //getLatestUpdatedItems(store, false);

    let combinedStoreItems = [];
    for (const store1Item of Object.values(store1.items)) {
      if (  store1Item.data &&
            store1Item.data.superEvent &&
            typeof store1Item.data.superEvent === 'string' ) {
        const lastSlashIndex = store1Item.data.superEvent.lastIndexOf('/');
        const store2ItemId = store1Item.data.superEvent.substring(lastSlashIndex + 1);
        const store2Item = Object.values(store2.items).find(store2Item => store2Item.id === store2ItemId);
        // If the match isn't found then the sessionSeries has been deleted, so lose the scheduledSession info
        if (  store2Item &&
              store2Item.data ) {
          // console.log('Match found');
          store1Item.data.superEvent = store2Item.data;
          combinedStoreItems.push(store1Item);
        }
      }
    }

    postDataQuality(combinedStoreItems);
  }

}

// -------------------------------------------------------------------------------------------------

function postDataQuality(items) {

  $('#summary').empty();

  const numItems = items.length;

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
    }
    else {
      // Handle the case where the date is not valid
      //console.log('Invalid date:', dateString);
    }
  }

  // Sort the dateCounts Map by date, in ascending order
  const sortedDateCounts = new Map(
    Array.from(dateCounts.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]))
  );

  // Log the counts of unique future dates and all dates, and the count for each date
  console.log(`There are ${numItemsNowToFuture} future dates`);
  console.log(`There are ${dateCounts.size} unique dates in the data`);

  // console.log(`Number of items with start dates greater than or equal to today: ${numItemsNowToFuture}`);

  const percent1 = (numItemsNowToFuture / numItems) * 100;
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

  const percent2 = (numItemsWithGeo / numItems) * 100;
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

  const percent3 = (numItemsWithActivity / numItems) * 100;
  const rounded3 = percent3.toFixed(1);

  // -------------------------------------------------------------------------------------------------

  // This creates dummy data for the spark graph - in time replace with count of numItems per day
  let randomizeArray = function (arg) {
    let array = arg.slice();
    let currentIndex = array.length, temporaryValue, randomIndex;

    while (0 !== currentIndex) {

      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  // Data for the sparklines that appear below header area
  // var sparklineData = [47, 45, 54, 38, 56, 24, 65, 31, 37, 39, 62, 51, 35, 41, 35, 27, 93, 53, 61, 27, 54, 43, 19, 46];

  // -------------------------------------------------------------------------------------------------

  // OUTPUT THE METRICS TO THE HTML...

  // The default colorPalette for this dashboard
  var colorPalette = ['#00D8B6', '#008FFB', '#FEB019', '#FF4560', '#775DD0']

  var spark1 = {
    chart: {
      id: 'sparkline1',
      group: 'sparklines',
      type: 'area',
      height: 300,
      sparkline: {
        enabled: true
      },
    },
    stroke: {
      curve: 'straight'
    },
    fill: {
      opacity: 1,
    },
    series: [{
      name: 'Opportunities',
      data: Array.from(sortedDateCounts.values()),
    }],
    labels: Array.from(sortedDateCounts.keys()),
    yaxis: {
      min: 0
    },
    xaxis: {
      type: 'datetime',
    },
    colors: ['#DCE6EC'],
    title: {
      text: numItems,
      offsetX: 30,
      style: {
        fontSize: '30px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: 'OpenActive Opportunities',
      offsetX: 30,
      style: {
        fontSize: '18px',
        cssClass: 'apexcharts-yaxis-title'
      }
    }
  }

  new ApexCharts(document.querySelector("#spark1"), spark1).render();

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

  new ApexCharts(document.querySelector("#apexchart2"), options_percentItemsNowToFuture).render();

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

  new ApexCharts(document.querySelector("#apexchart4"), options_percentItemsWithActivity).render();

}

// -------------------------------------------------------------------------------------------------

// function getLatestUpdatedItems(store, addIdCount) {
//
//   let data = Object.values(store.items);
//
//   // -------------------------------------------------------------------------------------------------
//
//   if (addIdCount)
//   {
//     // Adding a count per id at this stage to provide reassurance
//     // that the sort, keep, filter, etc. are working as expected
//     // Use reduce() to get the total count for each id
//     const idCount = data.reduce((accumulator, currentValue) => {
//       accumulator[currentValue.id] = accumulator[currentValue.id] ? accumulator[currentValue.id] + 1 : 1;
//       return accumulator;
//     }, {});
//
//     // Add count to each object in the data
//     data = data.map((obj) => {
//       const count = idCount[obj.id];
//       return { ...obj, count };
//     });
//   }
//
//   // -------------------------------------------------------------------------------------------------
//
//   // Sort the data by id and modified in descending order
//   const sortedData = data.sort((a, b) => {
//     if (a.id === b.id) {
//       return new Date(a.modified) - new Date(b.modified);
//     }
//     return a.id - b.id;
//   });
//
//   // -------------------------------------------------------------------------------------------------
//
//   // Use reduce() to keep only the last modified for each id
//   const latestData = Object.values(sortedData.reduce((accumulator, currentValue) => {
//     if (!accumulator[currentValue.id]) {
//       accumulator[currentValue.id] = currentValue;
//     }
//     return accumulator;
//   }, {}));
//
//   // -------------------------------------------------------------------------------------------------
//
//   const latestUpdatedData = latestData.filter(item => item.state === 'updated');
//
//   // -------------------------------------------------------------------------------------------------
//
//   return latestUpdatedData;
//
// }

// -------------------------------------------------------------------------------------------------

// function postDataQuality_original() {
//
//   const dataToChart = getLatestUpdatedItems();
//
//   console.log(dataToChart);
//
//   const numItems = Object.keys(dataToChart).length;
//
//   var randomizeArray = function (arg) {
//     var array = arg.slice();
//     var currentIndex = array.length, temporaryValue, randomIndex;
//
//     while (0 !== currentIndex) {
//
//       randomIndex = Math.floor(Math.random() * currentIndex);
//       currentIndex -= 1;
//
//       temporaryValue = array[currentIndex];
//       array[currentIndex] = array[randomIndex];
//       array[randomIndex] = temporaryValue;
//     }
//
//     return array;
//   }
//
//   // data for the sparklines that appear below header area
//   var sparklineData = [47, 45, 54, 38, 56, 24, 65, 31, 37, 39, 62, 51, 35, 41, 35, 27, 93, 53, 61, 27, 54, 43, 19, 46];
//
//   // the default colorPalette for this dashboard
//   //var colorPalette = ['#01BFD6', '#5564BE', '#F7A600', '#EDCD24', '#F74F58'];
//   var colorPalette = ['#00D8B6', '#008FFB', '#FEB019', '#FF4560', '#775DD0']
//
//   var spark1 = {
//     chart: {
//       id: 'sparkline1',
//       group: 'sparklines',
//       type: 'area',
//       height: 300,
//       sparkline: {
//         enabled: true
//       },
//     },
//     stroke: {
//       curve: 'straight'
//     },
//     fill: {
//       opacity: 1,
//     },
//     series: [{
//       name: 'Sales',
//       data: randomizeArray(sparklineData)
//     }],
//     labels: [...Array(24).keys()].map(n => `2018-09-0${n + 1}`),
//     yaxis: {
//       min: 0
//     },
//     xaxis: {
//       type: 'datetime',
//     },
//     colors: ['#DCE6EC'],
//     title: {
//       text: numItems,
//       offsetX: 30,
//       style: {
//         fontSize: '35px',
//         cssClass: 'apexcharts-yaxis-title'
//       }
//     },
//     subtitle: {
//       text: 'Number of OA Opportunities',
//       offsetX: 30,
//       style: {
//         fontSize: '20px',
//         cssClass: 'apexcharts-yaxis-title'
//       }
//     }
//   }
//
//   new ApexCharts(document.querySelector("#spark1"), spark1).render();
//
//   var options_1 = {
//     chart: {
//       height: 300,
//       type: 'radialBar',
//     },
//     series: [numItems],
//     labels: ['Number of Opportunities'],
//   }
//
//   var chart = new ApexCharts(document.querySelector("#apexchart1"), options_1);
//
//   chart.render();
//
//   var options2 = {
//     chart: {
//       height: 300,
//       type: 'radialBar',
//     },
//     series: [75],
//     labels: ['Progress'],
//   }
//
//   var chart = new ApexCharts(document.querySelector("#apexchart2"), options2);
//
//   chart.render();
//
//   // console.log(store1.items);
//
//   let keysLoadedData = {};
//
//   for (const id in store1.items) {
//     for (const key in store1.items[id]) {
//       if (!Object.keys(keysLoadedData).includes(key)) {
//         keysLoadedData[key] = 1;
//       } else {
//         keysLoadedData[key] += 1;
//       }
//     }
//   }
//
//   let tableKeysLoadedData = `<table border="0px">\n`;
//   for (const [key, val] of Object.entries(keysLoadedData)) {
//     tableKeysLoadedData +=
//       `  <tr>\n`
//       + `    <td>${key}</td>\n`
//       + `    <td>${val}</td>\n`
//       + `  </tr>\n`;
//   }
//   tableKeysLoadedData += `</table>\n`;
//
//   let tableUniqueActivities = `<table border="0px">\n`;
//   for (const [key, val] of store1.uniqueActivities.entries()) {
//     // Keys and vals are currently the same here, so only need one:
//     tableUniqueActivities +=
//       `  <tr>\n`
//       + `    <td><a href="${val}">${val}</a></td>\n`
//       + `  </tr>\n`;
//     // + `  <tr>\n`
//     // + `    <td>${key}</td>\n`
//     // + `    <td>${val}</td>\n`
//     // + `  </tr>\n`;
//   }
//   tableUniqueActivities += `</table>\n`;
//
//   let table =
//     `<table border="0px">\n`
//     + `  <tr>\n`
//     + `    <td>pagesLoaded</td>\n`
//     + `    <td>${store1.pagesLoaded}</td>\n`
//     + `  </tr>\n`
//     + `  <tr>\n`
//     + `    <td>itemCount</td>\n`
//     + `    <td>${store1.itemCount}</td>\n`
//     + `  </tr>\n`
//     + `  <tr>\n`
//     + `    <td>matchingItemCount</td>\n`
//     + `    <td>${store1.matchingItemCount}</td>\n`
//     + `  </tr>\n`
//     + `  <tr>\n`
//     + `    <td>loadedData length</td>\n`
//     + `    <td>${Object.keys(store1.items).length}</td>\n`
//     + `  </tr>\n`
//     + `  <tr>\n`
//     + `    <td>loadedData keys</td>\n`
//     + `    <td>\n`
//     + `${tableKeysLoadedData}`
//     + `    </td>\n`
//     + `  </tr>\n`
//     + `  <tr>\n`
//     + `    <td>uniqueActivities</td>\n`
//     + `    <td>\n`
//     + `${tableUniqueActivities}`
//     + `    </td>\n`
//     + `  </tr>\n`
//     + `</table>\n`;
//
//   $("#summary").append(table);
// }
