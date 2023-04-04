function postText() {

  console.log("Posting text");

  $("#summary").empty();
  $("#summary").append("<h3>Posting!</h3>");

}

function getQuality() {

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

  const data = Object.values(store.loadedData);

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

  //console.log(dataWithCount);

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

  // Comparing these outputs, something has happened to the format of loadedData 
  //console.log(result);
  //console.log(store.loadedData);

  return result;

}

function postQuality() {

  const dataToChart = getQuality();

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
    labels: ['Future dates'],
  }

  var chart = new ApexCharts(document.querySelector("#apexchart2"), options_2);

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