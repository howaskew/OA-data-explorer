function postText() {

  console.log("Posting text");

  $("#summary").empty();
  $("#summary").append("<h3>Posting!</h3>");

}

function getQuality(dataStore) {

  //Where is the code that implements the logic to sort by id, retain last modified and check updated/deleted status?
  //Seems we're just counting anything with state===updated line 412 in apisearch.js
  //Which is fine unless there are multiple update entries per id

  // Sample data for testing id, modified, state handling
  //const data_x = [
  //  { id: 1, modified: '2022-01-01', state: 'updated' },
  //  { id: 2, modified: '2022-01-02', state: 'updated' },
  //  { id: 1, modified: '2022-01-03', state: 'updated' },
  //  { id: 3, modified: '2022-01-04', state: 'updated' },
  //  { id: 2, modified: '2022-01-05', state: 'deleted' },
  //  { id: 1, modified: '2022-01-06', state: 'updated' },
  //];

  const data = Object.values(dataStore.loadedData);

  //console.log(data);

  // Adding a count per id at this stage to provide reassurance
  // that the sort, keep, filter, etc working as expected
  // Use reduce() to get the total count for each id
  const idCount = data.reduce((acc, curr) => {
    acc[curr.id] = acc[curr.id] ? acc[curr.id] + 1 : 1;
    return acc;
  }, {});

  // Add count to each object in finalData
  const dataWithCount = data.map((obj) => {
    const count = idCount[obj.id];
    return { ...obj, count };
  });

  console.log(dataWithCount);

  // Sort the data by id and modified in descending order
  const sortedData = Object.values(dataWithCount).sort((a, b) => {
    if (a.id === b.id) {
      return new Date(a.modified) - new Date(b.modified);
    }
    return a.id - b.id;
  });

  // Use reduce() to keep only the last modified for each id
  const finalData = sortedData.reduce((accumulator, currentValue) => {
    if (!accumulator[currentValue.ID]) {
      accumulator[currentValue.id] = currentValue;
    }
    return accumulator;
  }, {});

  // Only keep those with state === updated
  const filtered = Object.values(finalData).filter(d => d.state === 'updated');

  // Convert the finalData object back to an array
  const result = Object.values(filtered);

  // Comparing these outputs, something has happened to the format of loadedData - array vs object?
  //console.log(result);
  //console.log(store.loadedData);

  return result;

}

function postQuality(endpoint) {

  const dataToChart = getQuality(store);

  console.log(dataToChart);

  const opps = Object.keys(dataToChart).length;

  // Get today's date
  const today = new Date();

  // Loop through your data to count the matching dates
  let count_future = 0;
  for (const row of dataToChart) {
    // Convert the date in the row to a JavaScript Date object
    const date = new Date(row.data.startDate);

    // Check if the date is greater than or equal to today's date
    if (date >= today) {
      count_future++;
    }
  }

  console.log(`Number of dates greater than or equal to today: ${count_future}`);

  const percent1 = count_future / opps * 100;
  const rounded1 = percent1.toFixed(1);

  //Finding the related API feed to match superEvents to

  //Useful code extracts relevant stems but this is not the actual url needed
  const urlStems = dataToChart.reduce((acc, row) => {
    if (row.data.superEvent) {
      const lastSlashIndex = row.data.superEvent.lastIndexOf("/");
      const urlStem = row.data.superEvent.substring(0, lastSlashIndex);
      acc.push(urlStem);
    }
    return acc;
  }, []);

  const uniqueUrlStems = urlStems.filter((stem, index) => {
    return urlStems.indexOf(stem) === index;
  });

  console.log(`Unique URL stems: ${uniqueUrlStems}`);

  // Actually that is not the url needed but can use it as a flag 
  // and then extract from endpoint and try adding required text

  console.log(endpoint);

  if (uniqueUrlStems) {
    console.log('Load 2nd feed');
    const newEndpoint = endpoint.replace("scheduled-sessions", "session-series");
    // Could check these against endpoints from crawler
    console.log(newEndpoint);

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

    loadRPDEPage_2(newEndpoint, new_store.currentStoreId, filters, newEndpoint);

    console.log('Done 2nd feed')

    console.log(new_store.loadedData);

    //Keep latest modified for each id 

    // Sort the data by id and modified in descending order
    const sortedData = Object.values(new_store.loadedData).sort((a, b) => {
      if (a.id === b.id) {
        return new Date(a.modified) - new Date(b.modified);
      }
      return a.id - b.id;
    });

    // Use reduce() to keep only the last modified for each id
    const finalData = sortedData.reduce((accumulator, currentValue) => {
      if (!accumulator[currentValue.ID]) {
        accumulator[currentValue.id] = currentValue;
      }
      return accumulator;
    }, {});

    // Only keep those with state === updated
    const filtered = Object.values(finalData).filter(d => d.state === 'updated');

    // Convert the finalData object back to an array
    const feed_2 = Object.values(filtered);

    // Now joining the 2 feeds...

    // Create a new store to hold the combined data
    const combinedStore = [];

    // Iterate through the superEvent store
    for (const superEventItem of dataToChart) {
      //console.log(superEventItem)
      if (superEventItem.data.superEvent) {
        // Get the ID value from the superEvent item
        const superEventID = superEventItem.data.superEvent;
        const lastSlashIndex = superEventID.lastIndexOf('/');
        const idValue = superEventID.substring(lastSlashIndex + 1);
        //console.log(idValue);
        // Look up the corresponding item in the ID store
        const idItem = feed_2.find(item => item.id === idValue);
        console.log(idItem);
        // If a matching item was found, add the superEvent item to it as a new property
        if (idItem) {
          console.log('Match found');
          idItem.superEvent = superEventItem;
          combinedStore.push(idItem);
        }
      }
    }
    console.log(combinedStore);


  }




  // Count of records with 'where'

  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;

  function getProperty(obj, propertyName) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object') {
          const prop = getProperty(value, propertyName);
          if (prop) {
            return prop;
          }
        } else if (key === propertyName) {
          return value;
        }
      }
    }
    return null;
  }

  // Filter the data array to get objects with a valid postcode or geospatial coordinates
  const validData = dataToChart.filter((obj) => {

    const postcode = getProperty(obj, 'postalCode');
    const latitude = getProperty(obj, 'latitude')
    const longitude = getProperty(obj, 'longitude')
    const hasValidPostcode =
      postcode &&
      postcode.length > 0 &&
      ukPostcodeRegex.test(postcode);
    const hasValidCoords =
      latitude &&
      latitude.length > 0 &&
      longitude &&
      longitude.length > 0
      ;
    return hasValidPostcode || hasValidCoords;
  });

  // Get the count of valid data objects
  const valid_where = validData.length;

  console.log(`Number of records with valid postcode or coordinates: ${valid_where}`);

  const percent2 = valid_where / opps * 100;
  const rounded2 = percent2.toFixed(1);

  // This creates dummy data for the spark graph - in time replace with count of opps per day
  var randomizeArray = function (arg) {
    var array = arg.slice();
    var currentIndex = array.length, temporaryValue, randomIndex;

    while (0 !== currentIndex) {

      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  // data for the sparklines that appear below header area
  var sparklineData = [47, 45, 54, 38, 56, 24, 65, 31, 37, 39, 62, 51, 35, 41, 35, 27, 93, 53, 61, 27, 54, 43, 19, 46];

  // the default colorPalette for this dashboard
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
      data: randomizeArray(sparklineData)
    }],
    labels: [...Array(24).keys()].map(n => `2018-09-0${n + 1}`),
    yaxis: {
      min: 0
    },
    xaxis: {
      type: 'datetime',
    },
    colors: ['#DCE6EC'],
    title: {
      text: opps,
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


  var options_2 = {
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

  var chart = new ApexCharts(document.querySelector("#apexchart2"), options_2);

  chart.render();

  var options_3 = {
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

  var chart = new ApexCharts(document.querySelector("#apexchart3"), options_3);

  chart.render();
  // console.log(store.loadedData);

}

function postQuality_original() {

  const dataToChart = getQuality();

  console.log(dataToChart);

  const opps = Object.keys(dataToChart).length;


  var randomizeArray = function (arg) {
    var array = arg.slice();
    var currentIndex = array.length, temporaryValue, randomIndex;

    while (0 !== currentIndex) {

      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  // data for the sparklines that appear below header area
  var sparklineData = [47, 45, 54, 38, 56, 24, 65, 31, 37, 39, 62, 51, 35, 41, 35, 27, 93, 53, 61, 27, 54, 43, 19, 46];

  // the default colorPalette for this dashboard
  //var colorPalette = ['#01BFD6', '#5564BE', '#F7A600', '#EDCD24', '#F74F58'];
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
      name: 'Sales',
      data: randomizeArray(sparklineData)
    }],
    labels: [...Array(24).keys()].map(n => `2018-09-0${n + 1}`),
    yaxis: {
      min: 0
    },
    xaxis: {
      type: 'datetime',
    },
    colors: ['#DCE6EC'],
    title: {
      text: opps,
      offsetX: 30,
      style: {
        fontSize: '35px',
        cssClass: 'apexcharts-yaxis-title'
      }
    },
    subtitle: {
      text: 'Number of OA Opportunities',
      offsetX: 30,
      style: {
        fontSize: '20px',
        cssClass: 'apexcharts-yaxis-title'
      }
    }
  }

  new ApexCharts(document.querySelector("#spark1"), spark1).render();

  var options_1 = {
    chart: {
      height: 300,
      type: 'radialBar',
    },
    series: [opps],
    labels: ['Number of Opportunities'],
  }

  var chart = new ApexCharts(document.querySelector("#apexchart1"), options_1);

  chart.render();

  var options_2 = {
    chart: {
      height: 300,
      type: 'radialBar',
    },
    series: [75],
    labels: ['Progress'],
  }

  var chart = new ApexCharts(document.querySelector("#apexchart2"), options_2);

  chart.render();

  // console.log(store.loadedData);

  let keysLoadedData = {};

  for (const id in store.loadedData) {
    for (const key in store.loadedData[id]) {
      if (!Object.keys(keysLoadedData).includes(key)) {
        keysLoadedData[key] = 1;
      } else {
        keysLoadedData[key] += 1;
      }
    }
  }

  let tableKeysLoadedData = `<table border="0px">\n`;
  for (const [key, val] of Object.entries(keysLoadedData)) {
    tableKeysLoadedData +=
      `  <tr>\n`
      + `    <td>${key}</td>\n`
      + `    <td>${val}</td>\n`
      + `  </tr>\n`;
  }
  tableKeysLoadedData += `</table>\n`;

  let tableUniqueActivities = `<table border="0px">\n`;
  for (const [key, val] of store.uniqueActivities.entries()) {
    // Keys and vals are currently the same here, so only need one:
    tableUniqueActivities +=
      `  <tr>\n`
      + `    <td><a href="${val}">${val}</a></td>\n`
      + `  </tr>\n`;
    // + `  <tr>\n`
    // + `    <td>${key}</td>\n`
    // + `    <td>${val}</td>\n`
    // + `  </tr>\n`;
  }
  tableUniqueActivities += `</table>\n`;

  let table =
    `<table border="0px">\n`
    + `  <tr>\n`
    + `    <td>currentStoreId</td>\n`
    + `    <td>${store.currentStoreId}</td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>pagesLoaded</td>\n`
    + `    <td>${store.pagesLoaded}</td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>itemCount</td>\n`
    + `    <td>${store.itemCount}</td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>matchingItemCount</td>\n`
    + `    <td>${store.matchingItemCount}</td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>loadedData length</td>\n`
    + `    <td>${Object.keys(store.loadedData).length}</td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>loadedData keys</td>\n`
    + `    <td>\n`
    + `${tableKeysLoadedData}`
    + `    </td>\n`
    + `  </tr>\n`
    + `  <tr>\n`
    + `    <td>uniqueActivities</td>\n`
    + `    <td>\n`
    + `${tableUniqueActivities}`
    + `    </td>\n`
    + `  </tr>\n`
    + `</table>\n`;

  $("#summary").append(table);
}


function loadRPDEPage_2(url, storeId, filters, endpoint) {

  // Another store has been loaded, so do nothing
  if (storeId !== new_store.currentStoreId) {
    return;
  }

  new_store.pagesLoaded++;
  if (new_store.pagesLoaded < 50) {
    addApiPanel(url, true);
  } else if (new_store.pagesLoaded === 50) {
    addApiPanel('Page URLs past this point are hidden for efficiency', false);
  }

  let results = $("#results");

  $.ajax({
    async: true,
    type: 'GET',
    url: '/fetch?url=' + encodeURIComponent(url),
    timeout: 30000
  })
    .done(function (page) {

      if (new_store.itemCount === 0) {
        results.empty();
        results.append("<div id='resultsDiv' class='container-fluid'></div>");
      }

      results = $("#resultsDiv");

      $.each(page.content ? page.content : page.items, function (_, item) {

        new_store.itemCount++;

        if (item.state === 'updated') {

          // Update activity list
          var activities = resolveProperty(item, 'activity');
          if (Array.isArray(activities)) {
            activities
              .map(activity => activity.id || activity['@id'])
              .filter(id => id)
              .forEach(id => new_store.uniqueActivities.add(id));
          }

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
              : item.data
              && item.data.eventSchedule
              && item.data.eventSchedule.filter(x =>
                x.byDay
                && x.byDay.includes(filters.day)
                || x.byDay.includes(filters.day.replace('https', 'http'))
              ).length > 0;
          var itemMatchesGender =
            !filters.gender
              ? true
              : resolveProperty(item, 'genderRestriction') === filters.gender;
          if (itemMatchesActivity && itemMatchesDay && itemMatchesGender) {

            new_store.matchingItemCount++;

            storeJson(item.id, item, new_store);

            if (new_store.matchingItemCount < 100) {
              results.append(
                `<div id='col ${new_store.matchingItemCount}' class='row rowhover'>` +
                `    <div id='text ${new_store.matchingItemCount}' class='col-md-1 col-sm-2 text-truncate'>${item.id}</div>` +
                `    <div class='col'>${resolveProperty(item, 'name')}</div>` +
                `    <div class='col'>${(resolveProperty(item, 'activity') || []).filter(activity => activity.id || activity['@id']).map(activity => activity.prefLabel).join(', ')}</div>` +
                // `    <div class='col'>${(resolveDate(item, 'startDate') || '')}/div>` +
                // `    <div class='col'>${(resolveDate(item, 'endDate') || '')}/div>` +
                `    <div class='col'>${((item.data && item.data.location && item.data.location.name) || '')}</div>` +
                `    <div class='col'>` +
                `        <div class='visualise'>` +
                `            <div class='row'>` +
                `                <div class='col' style='text-align: right'>` +
                // `                    <button id='${new_store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1 visualiseButton'>Visualise</button>` +
                `                    <button id='json${new_store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>JSON</button>` +
                `                    <button id='validate${new_store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>Validate</button>` +
                `                    <button id='richness${new_store.matchingItemCount}' class='btn btn-secondary btn-sm mb-1'>Richness</button>` +
                `                </div>` +
                `            </div>` +
                `        </div>` +
                `    </div>` +
                `</div>`
              );

              $(`#json${new_store.matchingItemCount}`).on("click", function () {
                getJSON(item.id);
              });
              $(`#validate${new_store.matchingItemCount}`).on("click", function () {
                openValidator(item.id);
                //getValidate(item.id);
              });
              $(`#richness${new_store.matchingItemCount}`).on("click", function () {
                getRichness(item.id);
              });

              if (item.id.length > 8) {
                $(`#col${new_store.matchingItemCount}`).hover(
                  function () {
                    $(`#text${new_store.matchingItemCount}`).removeClass("text-truncate");
                    $(`#text${new_store.matchingItemCount}`).prop("style", "font-size: 70%");
                  },
                  function () {
                    $(`#text${new_store.matchingItemCount}`).addClass("text-truncate");
                    $(`#text${new_store.matchingItemCount}`).prop("style", "font-size: 100%");
                  }
                );
              }

            }
            else if (new_store.matchingItemCount === 100) {
              results.append(
                "<div class='row rowhover'>" +
                "    <div>Only the first 100 items are shown, the rest are hidden (TODO: Add paging)</div>" +
                "</div>"
              );
            }

          }

        }
        else if (item.state === 'deleted') {
          storeJson(item.id, item, new_store);
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

      const elapsed = luxon.DateTime.now().diff(new_store.harvestStart, ['seconds']).toObject().seconds;
      if (url !== page.next) {
        $("#progress").text(`Pages loaded ${new_store.pagesLoaded}; Items loaded ${new_store.itemCount}; results ${new_store.matchingItemCount} in ${elapsed} seconds; Loading...`);
        loadRPDEPage_2(page.next, storeId, filters, endpoint);
      }
      else {
        $("#progress").text(`Pages loaded ${new_store.pagesLoaded}; Items loaded ${new_store.itemCount}; results ${new_store.matchingItemCount}; Loading complete in ${elapsed} seconds`);
        if (page.items.length === 0 && new_store.matchingItemCount === 0) {
          results.append("<div><p>No results found</p></div>");
        }
        updateActivityList(new_store.uniqueActivities);
        loadingComplete();
      }

    })
    .fail(function () {
      const elapsed = luxon.DateTime.now().diff(new_store.harvestStart, ['seconds']).toObject().seconds;
      $("#progress").text(`Pages loaded ${new_store.pagesLoaded}; Items loaded ${new_store.itemCount}; results ${new_store.matchingItemCount} in ${elapsed} seconds; An error occurred, please retry.`);
      $("#results").empty().append("An error has occurred");
      $("#results").append('<div><button class="show-error btn btn-secondary">Retry</button></div>');
      $(".show-error").on("click", function () {
        executeForm();
      });
    });
}