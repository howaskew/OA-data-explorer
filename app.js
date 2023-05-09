const axios = require('axios');
const express = require('express');
const http = require('http');
const apicache = require('apicache');
const { Handler } = require('htmlmetaparser');
const { Parser } = require('htmlparser2');
const sleep = require('util').promisify(setTimeout);

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

let cache = apicache.middleware;

const onlyStatus200 = (req, res) => res.statusCode === 200;

const cacheSuccesses = cache('48 hours', onlyStatus200);

// ** Passthrough RPDE fetch **
// TODO: Restrict with cors and to RPDE only
app.get('/fetch', cacheSuccesses, async(req, res, next) => {
  try {
    const page = await axios.get(req.query.url);
    res.status(200).send(page.data);
  } catch (error) {
    if (error.response) {
      // Request made and server responded
      res.status(error.response.status).send(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).send(error.request);
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error=
      res.status(500).send({ error: error.message });
      console.log('Error', error.message);
    }
  }
});

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
          return await axios.get(catalogueUrl, {
            timeout: 20000
          });
        }
        catch (error)
        {
          console.log("Error getting catalogue: " + catalogueUrl);
          return null;
        }
      })))
      .filter(catalogue => catalogue)
      .flatMap(catalogue => catalogue.data.dataset);

      const datasets = (await Promise.all(datasetUrls.map(async (datasetUrl) => {
        try {
          return extractJSONLDfromHTML(
            datasetUrl,
            (await axios.get(datasetUrl, {
              timeout: 20000
            })).data
          );
        }
        catch (error)
        {
          console.log("Error getting dataset: " + datasetUrl);
          return null;
        }
      })))
      .filter(dataset => dataset);

// Dataset providers should be encouraged to adjust the following in their dataset pages, and make
// sure there are none which are undefined, then we won't need the normalisation in the following
// code block:
//
//   'ScheduledSessions' -> 'ScheduledSession'
//   'sessions' -> 'ScheduledSession'
//   'Slot for FacilityUse' -> 'Slot'

      feeds = datasets.flatMap(dataset => (
        (dataset?.distribution ?? []).map(feedInfo => ({
          name: dataset.name,
          type: feedInfo.name,
          url: feedInfo.contentUrl,
          datasetUrl: dataset.url,
          discussionUrl: dataset.discussionUrl,
          licenseUrl: dataset.license,
          publisherName: dataset.publisher.name,
        })
      )))
      .filter(feed => feed.type !== 'CourseInstance')
      .filter(feed => feed.url && feed.name.substr(0,1).trim())
      .sort(function(feed1, feed2) {
         return feed1.name.toLowerCase().localeCompare(feed2.name.toLowerCase());
      })
      .map(feed => {
        if (['ScheduledSessions', 'sessions'].includes(feed.type)) {
          feed.type = 'ScheduledSession';
        }
        else if (['Slot for FacilityUse'].includes(feed.type)) {
          feed.type = 'Slot';
        }
        return feed;
      });

      console.log("Got all feeds: " + JSON.stringify(feeds, null, 2));

      // Prefetch pages into cache to reduce initial load
      //for (const feed of feeds) {
      //  // Distribute the prefetching calls to ensure a single services is not overloaded if serving more than one dataset site
      //  await sleep(60000);
      //  harvest(dataset.url);
      //}

    }
  }
  catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
})();

app.get('/feeds', function (req, res) {
  res.send({"feeds": feeds});
});

app.post('/api/clear-cache', (req, res) => {
  const url = req.body.url;
  apicache.clear(url);
  res.send(`Cache cleared for ${url}`);
});

async function harvest(url) {
  console.log(`Prefetch: ${url}`);
  const { data } = await axios.get(`http://localhost:${port}/fetch?url=` + encodeURIComponent(url));
  if (!data.next) {
    console.log(`Error prefetching: ${url}`);
  } else if (data.next !== url) {
    harvest(data.next);
  }
}

// ** Error handling **

app.use(function (err, req, res, next) {
    res.status(500).json({error: err.stack});
    console.error(err.stack);
})

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
