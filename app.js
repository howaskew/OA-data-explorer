const axios = require('axios');
const express = require('express');
const http = require('http');
const apicache = require('apicache');
const { Handler } = require('htmlmetaparser');
const { Parser } = require('htmlparser2');
const sleep = require('util').promisify(setTimeout);
require('dotenv').config(); // Load environment variables from .env

const port = normalizePort(process.env.PORT || '3000');

function extractJSONLDfromHTML(url, html) {
  let jsonld = null;

  const handler = new Handler(
    (err, result) => {
      if (!err && typeof result === 'object') {
        const jsonldArray = result.jsonld;
        // Use the first JSON-LD block on the page
        if (Array.isArray(jsonldArray) && jsonldArray.length > 0) {
          [jsonld] = jsonldArray;
        }
      }
    },
    {
      url, // The HTML pages URL is used to resolve relative URLs. TODO: Remove this
    },
  );

  // Create a HTML parser with the handler.
  const parser = new Parser(handler, {
    decodeEntities: true,
  });
  parser.write(html);
  parser.done();

  return jsonld;
}

const catalogueCollectionUrl = 'https://openactive.io/data-catalogs/data-catalog-collection.jsonld';

let feeds = {};

const app = express();
app.use(express.json());
app.use(express.static('public'));

axios.defaults.timeout = 30000; // In ms. Default 0. Increase to wait for longer to receive response. Should be less than the timeout in apisearch.js which calls /fetch herein.

let cache = apicache.middleware;
const onlyStatus200 = (req, res) => res.statusCode === 200;
const cacheSuccesses = cache('48 hours', onlyStatus200);

// ** Passthrough RPDE fetch **
// TODO: Restrict with cors and to RPDE only

// Use this approach to enable access control for all HTTP methods that go to /fetch (and likewise
// for any other endpoint). Note that after the headers are set, the next() command then goes to the
// actual method requested. This approach is not currently needed as we only use one method per
// endpoint, so just adjust the headers inside each one. Alternatively, if CORS issues need to be
// handled more holistically, then the 'cors' package on npm may be useful.
// app.all('/fetch', function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'X-Requested-With');
//   res.header('Access-Control-Expose-Headers', 'Content-Security-Policy, Location');
//   next();
// });
app.get('/fetch', cacheSuccesses, async (req, res, next) => {
  // res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  // res.header('Access-Control-Expose-Headers', 'Content-Security-Policy, Location');
  try {
    // req.url is the exact call to this function, and becomes the cache handle e.g. '/fetch?url=https%3A%2F%2Fopendata.leisurecloud.live%2Fapi%2Ffeeds%2FActiveNewham-live-live-session-series'
    // req.query.url is the page we actually want to go to e.g. 'https://opendata.leisurecloud.live/api/feeds/ActiveNewham-live-live-session-series'
    // See the apicache source code and search for 'originalUrl' for further details:
    // - https://www.npmjs.com/package/apicache?activeTab=code
    // console.log(`Making call for: ${req.url} => ${req.query.url}`);
    const page = await axios.get(req.query.url);
    res.status(200).send(page.data);
  }
  catch (error) {
    if (error.response) {
      // Request made and server responded
      res.status(error.response.status).send(error.response.data); // This is a candidate for JSONify issues, see commented section just below ...
    }
    // else if (error.request) {
    //   // The request was made but no response was received
    //   res.status(500).send(error.request); // This line can result in a JSON.stringify issue from response.js due to circular info in error.request, ultimately kills the running server here, hence all commented out
    //   console.log(error.request);
    // }
    else {
      // Something happened in setting up the request that triggered an error
      res.status(500).send({ error: error.message });
      console.log(`Error getting URL: ${req.query.url}: ${error.message}`);
    }
  }
});

// additions for summary data storage

const bodyParser = require('body-parser');
const { Client } = require('pg');
const { rejects } = require('assert');

// Middleware
app.use(bodyParser.json());

let ssl_string = '';

if (process.env.ENVIRONMENT !== 'DEVELOPMENT') {
  ssl_string = `ssl: {ssl: {
    rejectUnauthorized: false,
  }`;
}

console.log(process.env.ENVIRONMENT + ' ' + ssl_string);

// Create a new PostgreSQL client
const client = new Client({
  // Heroku provides the DATABASE_URL environment variable
  // Or locally, use a .env file with DATABASE_URL = postgres://{user}:{password}@{hostname}:{port}/{database-name}
  // host and port: localhost:5432
  connectionString: process.env.DATABASE_URL,
  ssl_string
});

async function createTableIfNotExists() {
  try {
    await client.connect()
      .then(() => {
        console.log('Connected to the database!');
      })
      .catch((err) => {
        console.error('Error connecting to the database:', err);
      });

    const checkTableQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = 'openactivedq'
    );
  `;

    const { rows } = await client.query(checkTableQuery);

    const tableExists = rows[0].exists;

    if (!tableExists) {
      const createTableQuery1 = `
        CREATE TABLE openactivedq (
          id VARCHAR(255) PRIMARY KEY,
          numParent INTEGER,
          numChild INTEGER,
          DQ_validActivity INTEGER,
          DQ_validGeo INTEGER,
          DQ_validDate INTEGER,
          DQ_validParentUrl INTEGER,
          DQ_validChildUrl INTEGER,
          dateUpdated INTEGER
        );
      `;

      await client.query(createTableQuery1);

      const createTableQuery2 = `
      CREATE TABLE openactivesample (
        id VARCHAR(255) PRIMARY KEY,
        data JSONB
      );
    `;

      await client.query(createTableQuery2);

      console.log('Tables created successfully!');
    } else {
      console.log('Table already exists.');

      //During development, may be convenient to recreate the database (when adding fields etc)

      // const deleteTablesQuery = `
      // DROP TABLE IF EXISTS openactivedq;
      // DROP TABLE IF EXISTS openactivesample;
      //`;

      // client.query(deleteTablesQuery);


      //      const createTableQuery1 = `
      //     CREATE TABLE openactivedq (
      //      id VARCHAR(255) PRIMARY KEY,
      //     numParent INTEGER,
      //    numChild INTEGER,
      //   DQ_validActivity INTEGER,
      //  DQ_validGeo INTEGER,
      // DQ_validDate INTEGER,
      //DQ_validParentUrl INTEGER,
      //DQ_validChildUrl INTEGER,
      //dateUpdated INTEGER
      //);
      //`;

      //await client.query(createTableQuery1);

      //const createTableQuery2 = `
      //CREATE TABLE openactivesample (
      // id VARCHAR(255) PRIMARY KEY,
      //data JSONB
      //);
      //`;

      //  await client.query(createTableQuery2);

      //      console.log('Tables recreated');

    }

  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    // IF testing for connection, can end connection HERE
    //  await client.end();
  }
}

createTableIfNotExists();

// API endpoint for inserting data
app.post('/api/insert', async (req, res) => {
  try {

    // Test for existing connection HERE

    // Assuming the client sends the name and email in the request body
    const { id, numParent, numChild, DQ_validActivity,
      DQ_validGeo, DQ_validDate, DQ_validParentUrl,
      DQ_validChildUrl, dateUpdated } = req.body;

    // Validate and sanitize the input
    // Implement appropriate validation logic based on your requirements

    // Insert data into the database using a parameterized query
    const insertQuery = `
    INSERT INTO openactivedq (id, numParent, numChild, DQ_validActivity, DQ_validGeo, DQ_validDate, DQ_validParentUrl, DQ_validChildUrl, dateUpdated)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id)
    DO UPDATE SET numParent = EXCLUDED.numParent,
    numChild = EXCLUDED.numChild,
    DQ_validActivity = EXCLUDED.DQ_validActivity,
    DQ_validGeo = EXCLUDED.DQ_validGeo,
    DQ_validDate = EXCLUDED.DQ_validDate,
    DQ_validParentUrl = EXCLUDED.DQ_validParentUrl,
    DQ_validChildUrl = EXCLUDED.DQ_validChildUrl,
    dateUpdated = EXCLUDED.dateUpdated

    RETURNING id, numParent, numChild, DQ_validActivity, DQ_validGeo, DQ_validDate, DQ_validParentUrl, DQ_validChildUrl, dateUpdated;
    `;

    const values = [id, numParent, numChild, DQ_validActivity, DQ_validGeo, DQ_validDate, DQ_validParentUrl, DQ_validChildUrl, dateUpdated];
    const result = await client.query(insertQuery, values);

    // Send the inserted data back to the client as a response
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).json({ error: 'An error occurred while inserting data.' });
  }
});

// Define a route handler to retrieve the sum values
app.get('/sum', async (req, res) => {

  try {
    const sumQuery = `
      SELECT SUM(numParent) AS sumParent,
      SUM(numChild) AS sumChild,
      SUM(DQ_validActivity) AS sumDQ_validActivity
      FROM openactivedq;
    `;
    const result = await client.query(sumQuery);

    if (result.rows.length === 0) {
      console.log('No data found in the result.');
      return res.status(404).json({ error: 'No data found' });
    }

    const sum1 = Number(result.rows[0].sumparent);
    const sum2 = Number(result.rows[0].sumchild);
    const sum3 = Number(result.rows[0].sumdq_validactivity);

    res.json({ sum1, sum2, sum3 });
  } catch (error) {
    console.error('Error executing the sum query:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Route to handle the delete query to remove any existing sample data for a feed
app.post('/api/delete', async (req, res) => {
  const { deleteQuery } = req.body;

  try {
    await client.query(deleteQuery);
    res.status(200).json({ message: 'Deletion successful.' });
  } catch (error) {
    console.error('Error executing delete query:', error);
    res.status(500).json({ error: 'An error occurred while executing delete query.' });
  }
});

// Route to handle the insert query to add to sample
app.post('/api/insertsample', async (req, res) => {
  const { insertQuery, values } = req.body;

  try {
    await client.query(insertQuery, values);
    res.status(200).json({ message: 'Insertion successful.' });
  } catch (error) {
    console.error('Error executing insert query:', error);
    res.status(500).json({ error: 'An error occurred while executing insert query.' });
  }
});

// Route to handle the insert query to add to sample

app.get('/api/download', (req, res) => {
  const downloadQuery = 'SELECT * FROM openactivesample';

  client.query(downloadQuery)
    .then(result => {
      const rows = result.rows;
      const sampleData = {};

      rows.forEach(row => {
        const { id, data } = row;
        sampleData[id] = data;
      });

      res.json(sampleData);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).json({ error: 'Failed to download sample data' });
    });
});




// app.js resumes...


// Get all feeds on load
// Note Heroku is restarted automatically nightly, so this collection is automatically updated each night
(async () => {
  try {

    const catalogueCollection = await axios.get(catalogueCollectionUrl);

    if (!catalogueCollection.data || !catalogueCollection.data.hasPart) {
      throw new Error(`Error getting catalogue collection: ${catalogueCollectionUrl}`);
    }
    else {

      const datasetUrls = (await Promise.all(catalogueCollection.data.hasPart.map(async (catalogueUrl) => {
        try {
          return await axios.get(catalogueUrl);
        }
        catch (error) {
          console.log(`Error getting catalogue: ${catalogueUrl}: ${error.message}`);
          return null;
        }
      })))
        .filter(catalogue => catalogue)
        .flatMap(catalogue => catalogue.data.dataset);

      const datasets = (await Promise.all(datasetUrls.map(async (datasetUrl) => {
        try {
          return extractJSONLDfromHTML(
            datasetUrl,
            (await axios.get(datasetUrl)).data
          );
        }
        catch (error) {
          console.log(`Error getting dataset: ${datasetUrl}: ${error.message}`);
          return null;
        }
      })))
        .filter(dataset => dataset);

      //console.log(datasets);

      console.log('Unique Types in feeds (untreated):');
      const typeCounts = {};

      datasets.forEach(dataset => {
        (dataset?.distribution ?? []).forEach(feedInfo => {
          const { name } = feedInfo;
          typeCounts[name] = (typeCounts[name] || 0) + 1;
        });
      });

      const sortedTypes = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);

      sortedTypes.forEach(type => {
        console.log(`${type} (${typeCounts[type]})`);
      });

      feeds = datasets.flatMap(dataset => (
        (dataset?.distribution ?? []).map(feedInfo => ({
          name: dataset.name || '',
          type: feedInfo.name || 'unknown',
          url: feedInfo.contentUrl || '',
          datasetUrl: dataset.url || '',
          discussionUrl: dataset.discussionUrl || '',
          licenseUrl: dataset.license || '',
          publisherName: dataset.publisher.name || '',
        })
        )))
        .filter(feed => feed.url && feed.name.substr(0, 1).trim())
        .sort(function (feed1, feed2) {
          return feed1.name.toLowerCase().localeCompare(feed2.name.toLowerCase());
        });

      // Hard-coded placeholder feed for totals and samples
      const myFeed = {
        name: 'All OpenActive Feeds',
        type: 'Mixed',
        url: '',
        datasetUrl: '',
        discussionUrl: '',
        licenseUrl: '',
        publisherName: 'All OpenActive Feeds',
      };

      // Append the hard-coded feed to the front of the feeds list
      feeds.unshift(myFeed);

      //console.log("Got all feeds: " + JSON.stringify(feeds, null, 2));
      console.log('Got feeds, now reading data');

      // Query to fetch data from the PostgreSQL table
      const query = 'SELECT * FROM openactivedq';

      // Fetch data from the table
      client.query(query, (err, result) => {
        if (err) {
          console.error('Error executing query:', err);
          return;
        }

        // Merge data from the table with the existing feeds array
        const rows = result.rows;
        rows.forEach((row) => {
          //Now only totalling for the first url in the concatenated id - this will enable accurate sum at provider level
          const existingFeed = feeds.find((feed) => feed.url === row.id.split(' ')[0]);
          if (existingFeed) {
            // Merge properties from the database row into the existing feed object
            Object.assign(existingFeed, row);
          } else {
            // Only adding infor to existing feeds at this stage
            // feeds.push(row);
          }
        });

        // Do something after merging the data (e.g., send a response)
        //console.log('Data merged successfully:', feeds);
        console.log('Data merged successfully');
      });

      // Prefetch pages into cache to reduce initial load (if not dev environment):
      if (process.env.ENVIRONMENT !== 'DEVELOPMENT') {
        for (const feed of feeds) {
          // Distribute the prefetching calls to ensure a single services is not overloaded if serving more than one dataset site:
          if (feed.url !== '') { //Handle the empty url for All OpenActive Feeds
          await sleep(60000);
          harvest(feed.url);
          }
        }
      }

    }
  }
  catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
})();

app.get('/feeds', function (req, res) {
  res.send({ "feeds": feeds });
});

app.get('/api/cache/performance', (req, res) => {
  res.json(apicache.getPerformance());
});

app.get('/api/cache/index', (req, res) => {
  res.json(apicache.getIndex());
});

app.post('/api/cache/clear', (req, res) => {
  const url = req.body.url;
  apicache.clear(url);
  // For client-side logging:
  res.send(`Cache cleared for ${url}`);
  // For server-side logging:
  // console.log(`Cache cleared for ${url}`);
});

async function harvest(url) {
  console.log(`Prefetch: ${url}`);
  const { data } = await axios.get(`http://localhost:${port}/fetch?url=${encodeURIComponent(url)}`);
  if (!data.next) {
    console.log(`Error prefetching: ${url}`);
  } else if (data.next !== url) {
    harvest(data.next);
  }
}

// ** Error handling **

app.use(function (err, req, res, next) {
  res.status(500).json({ error: err.stack });
  console.error(err.stack);
});

const server = http.createServer(app);
server.on('error', onError);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const integerPort = parseInt(val, 10);

  if (Number.isNaN(integerPort)) {
    // named pipe
    return val;
  }

  if (integerPort >= 0) {
    // port number
    return integerPort;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}
