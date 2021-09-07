/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const express = require("express");
const fs = require('node:fs');
const WebSocketServer = require("websocket").server;
const http = require("node:http");
const fetch = require("node-fetch");
const path = require("node:path");

const app = express();
const port = 9090;
const webSocketPort = 9091;

const server = http.createServer((request, response) => {
  console.log(`${new Date()} Received request for ${request.url}`);
  response.writeHead(404);
  response.end();
});


server.listen(webSocketPort, () => {
  console.log(`${new Date()} WebSocket Server is listening on port ${webSocketPort}`);
});

const wsServer = new WebSocketServer({
  httpServer: server,
  // You should not use autoAcceptConnections for production
  // applications, as it defeats all standard cross-origin protection
  // facilities built into the protocol and the browser.  You should
  // *always* verify the connection's origin and decide whether or not
  // to accept it.
  autoAcceptConnections: false,
});

/**
 * @param {string} origin
 */
function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return origin === `http://127.0.0.1:${port}`;
}
let interval;
wsServer.on("request", (request) => {
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log(
      `${new Date()} Connection from origin ${request.origin} rejected.`
    );
  }
  const connection = request.accept("version", request.origin);
  console.log(`${new Date()} Connection accepted.`);
  let previousVersion = 0;

  // @ts-ignore
  if (interval) { clearInterval(interval); }

  interval = setInterval(() => {
    let version;
    let versionReadable;
    try {
      const versionDetails = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json')).toString());
      version = versionDetails.version;
      versionReadable = versionDetails.versionReadable;
    } catch (e) {
      // eslint-disable-next-line no-empty
    }

    if (version === previousVersion || !version) {
      return;
    }
    console.log(`Informed about new Version(${versionReadable}) to the open webpage(if any)`);
    connection.sendUTF(version);
    previousVersion = version;
  }, 50);

  connection.on("close", (reasonCode, description) => {
    console.log(`${new Date()} Peer ${connection.remoteAddress} disconnected. Reason: ${reasonCode}, Description ${description}`);
  });
});


// Proxies all requests to make them same origin to avoid CORS problems when sending requests from ServiceWorker.
// Those problems don't exist in Cloudflare Workers as it runs at backend and there CORS doesn't apply.
// ServiceWorker is configured to send requests to /proxy
app.get("/proxy/*", async (req, res) => {
  let pathname = req.path.replace("/proxy/", "");
  let [origin] = pathname.split("/");
  origin = decodeURIComponent(origin);
  pathname = pathname.split("/").slice(1).join("/");
  const url = origin + pathname;
  let fetchRes;
  console.log("Fetching URL for Proxy:", url);
  try {
    // @ts-ignore
    fetchRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36",
      },
    });
  } catch (e) {
    console.log("Fetching URL for Proxy failed:", e);
    res.status(500).send(e);
    return;
  }

  let headers = {};
  for (let [key, value] of fetchRes.headers) {
    if (['content-encoding', 'content-length'].includes(key)) {
      continue;
    }
    headers[key] = value;
  }
  let buffer = await fetchRes.buffer();
  res.set(headers).status(fetchRes.status).send(buffer);
});

app.use(express.static(path.join(__dirname, "static")));

app.get("/*", async (req, res) => {
  if (req.hostname !== "127.0.0.1") {
    res.send("Access on http://127.0.0.1 only");
    return;
  }
  res.send(`<script>
  navigator.serviceWorker.register('/worker.js').then(reg => {
    window.__perframe = window.__perframe || {};
    window.__perframe.registration = reg;
  });
  navigator.serviceWorker.addEventListener('message', function(event) {
    console.log('ServiceWorker:', event.data);
  });
  </script>`);
});

app.listen(port, () => {
  console.log(`ProxyServer listening at http://127.0.0.1:${port}`);
});
