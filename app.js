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

const COLLECTION = 'https://openactive.io/data-catalogs/data-catalog-collection.jsonld';

let datasets = {};

const app = express();
app.use(express.json());
app.use(express.static('public'))

let cache = apicache.middleware

const onlyStatus200 = (req, res) => res.statusCode === 200

const cacheSuccesses = cache('48 hours', onlyStatus200)

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

// ** Cache dataset URLs ** 
// Note Heroku is restarted automatically nightly, so this collection is automatically updated each night
(async () => {
  try {
    // Get all datasets on load
    const collection = await axios.get(COLLECTION);
    if (collection.data && collection.data.hasPart) {
      const datasetUrls = (await Promise.all(collection.data.hasPart.map(async (url) => {
        try {
          return await axios.get(url, {
            timeout: 20000
          });
        }
        catch (error)
        {
          console.log("Error getting dataset site catalogue: " + url);
          return null;
        }
      }))).filter(x => x).flatMap(x => x.data.dataset);
      const datasetSites = (await Promise.all(datasetUrls.map(async (url) => {
        try {
          return extractJSONLDfromHTML(url, (await axios.get(url, {
            timeout: 20000
          })).data)
        }
        catch (error)
        {
          console.log("Error getting dataset site: " + url);
          return null;
        }
      }))).filter(x => x);
      datasets =  datasetSites.map(site => ({
        name: site.name,
        url: (site?.distribution ?? []).map(x => x.contentUrl)[0]
      })).filter(x => x.url && x.name.substr(0,1).trim()).sort((a,b) => ('' + a.name).localeCompare(b.name));
      console.log("Got all dataset sites: " + JSON.stringify(datasets, null, 2));

      // Prefetch pages into cache to reduce initial load
      //for (const dataset of datasets) {
      //  // Distribute the prefetching calls to ensure a single services is not overloaded if serving more than one dataset site
      //  await sleep(60000);
      //  harvest(dataset.url);
      //}
    } else {
      throw new Error('Could not connect to https://openactive.io/data-catalogs/data-catalog-collection.jsonld')
    }
  } catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
})();

app.get('/datasets', function (req, res) {
  res.send({"endpoints": datasets});
});

async function harvest(url) {
  console.log(`Prefetch: ${url}`)
  const { data } = await axios.get(`http://localhost:${port}/fetch?url=` + encodeURIComponent(url));
  if (!data.next) {
    console.log(`Error prefetching: ${url}`);
  } else if (data.next !== url) {
    harvest(data.next);
  }
}

// ** Error handling ** 

app.use(function (err, req, res, next) {
    res.status(500).json({error: err.stack})
    console.error(err.stack);
})

const server = http.createServer(app);
server.on('error', onError);

app.listen(port, () => {
  console.log(`Server running on port ${port}
`);

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
