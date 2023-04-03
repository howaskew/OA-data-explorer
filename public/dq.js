function postText() {
   
    console.log("Posting text");

        $("#summary").empty();
        $("#summary").append("<h3>Posting!</h3>");
        
}


function getQuality() {
 
//Where is the code that implements the logic to sort by id, retain last modified and check updated/deleted status?
//Seems we're just counting anything with state===updated line 412 in apisearch.js

// Sample data
const data_x = [
  { id: 1, modified: '2022-01-01' },
  { id: 2, modified: '2022-01-02' },
  { id: 1, modified: '2022-01-03' },
  { id: 3, modified: '2022-01-04' },
  { id: 2, modified: '2022-01-05' },
  { id: 1, modified: '2022-01-06' },
];

const data = Object.values(store.loadedData);

// Sort the data by id and modified in descending order
const sortedData = data.sort((a, b) => {
  if (a.id === b.id) {
    return new Date(b.modified) - new Date(a.modified);
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

// Convert the finalData object back to an array
const result = Object.values(finalData);

console.log(result);

// Remove any with state === deleted
const result_filtered = result.filter(d => d.state === 'deleted');

console.log(result_filtered);

console.log(store.loadedData);

}

function postQuality() {

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