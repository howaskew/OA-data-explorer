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

}

function postQuality() {


  var options = {
    chart: {
        height: 350,
        type: 'radialBar',
    },
    series: [70],
    labels: ['Progress'],
  }
  
  var chart = new ApexCharts(document.querySelector("#apexchart"), options);
  
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