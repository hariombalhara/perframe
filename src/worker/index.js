// Website being audited is decided on the fly using AUDIT environment variable.
//@ts-ignore Audit dir is decided during Webpack build as an environment variable
import { pages, auditConfig } from 'Audit/pages.js';
import { log } from '../logger';
import { getPageType, getTimeMs, isContentTypeText, optimize } from '../utils';
import injectCode from 'raw-loader!../../dist/inject';
import reportHtml from '../report/index.html'
import { proxyWebsiteRegExp, PROXY_CONTENT_PATH, version, versionReadable, website, WORKER_USER_AGENT } from './environment';
import internalRoutes from './routes';

/**
 * @param {URL} parsedUrl
 */
function getUrlFromQueryParam(parsedUrl) {
  let url = parsedUrl.searchParams.get('u');
  let parsedWebsiteUrl = null;
  let error = null;
  if (!url) {
    return {
      parsedUrl: null
    }
  }

  try {
    parsedWebsiteUrl = new URL(url);
  } catch (e) {
    error = `Invalid URL: ${url}`;
    return {
      error,
      parsedUrl: null
    }
  }
  return { parsedUrl: parsedWebsiteUrl };
}
/**
 *
 * @param {Request} request
 * @returns
 */
async function handleRoutes(request) {
  const { url } = request;
  const parsedUrl = new URL(url);
  let incomingPath = parsedUrl.pathname;
  if (incomingPath !== '/__perfproxyVersion' && incomingPath !== '/__perfproxyReport' && incomingPath !== '/__perfproxyAuditConfig') {
    incomingPath = incomingPath.replace('/__perfproxy', '')
  }
  /**@type import('../AuditConfig').Routes */
  let userRoutes = auditConfig.routes;
  let routes = [...internalRoutes, ...userRoutes]

  const matchingRoutes = routes.filter((route) => route.path === incomingPath);
  if (matchingRoutes.length > 1) {
    log.error(`${matchingRoutes.length} routes matching the request. Using the first one only`)
  }

  const routeConfig = matchingRoutes[0]

  if (!routeConfig) {
    return {
      response: new Response('Invalid ProxyContent Route'),
      route: null
    };
  }

  console.log('Matched ProxyContent Route', incomingPath);
  const { fetch: fetchUrl, content, headers } = routeConfig.response
  if (!fetchUrl && !content) {
    throw new Error('Neither `fetch` nor `content` is defined for the Route:' + routeConfig.path)
  }

  if (fetchUrl) {
    return {
      response: await fetch(fetchUrl, {
        headers: {
          'User-Agent': WORKER_USER_AGENT
        }
      }),
      route: incomingPath
    }
  }

  if (content) {
    let computedContent;
    if (typeof (content) === 'function') {
      let { parsedUrl: parsedOptimizationPageUrl, error } = getUrlFromQueryParam(parsedUrl)
      if (error) {
        throw new Error(error)
      }
      computedContent = content({
        parsedUrl,
        version,
        pageType: getPageType(pages, parsedOptimizationPageUrl),
        auditConfig,
        reportHtml
      });
    } else {
      computedContent = new Response(content, { headers });
    }

    return {
      response: computedContent,
      route: incomingPath
    };
  }

  throw new Error('Invalid Route Configuration')
}

/**
 * @param {Response} response
 * @param {{parsedMainDocUrl: URL|null, route?: string|null, parsedUrl: URL}} options
 */
async function optimizeResponse(response, { parsedMainDocUrl, route, parsedUrl }) {
  let pageType = getPageType(pages, parsedMainDocUrl);
  let optimizations;

  if (!isContentTypeText(response.headers.get('content-type')) || parsedUrl.pathname.endsWith('/__perfproxyReport')) {
    return response
  }
  let htmlDoc = false;

  //FIXME: Anyone can intentionally add __optimization param or it can be automatically added to subresources. Identify that it is an actual HTML request so that HTML optimizations can be applied on it.
  if (parsedMainDocUrl && parsedMainDocUrl.searchParams.get('__optimization') === '1' && response.headers.get('content-type') && response.headers.get('content-type').indexOf('/html') > -1) {
    htmlDoc = true;
  }
  /**
  * @type string
  */
  let textResponse;
  if ((!pageType && htmlDoc)) {
    log.error(`PageType can't be categorized for ${parsedUrl.href}`);
    return response;
  } else if (!parsedMainDocUrl) {
    log.error(`No main page can be identified for applying optimizations on ${parsedUrl.href}`);
    return response;
  } else {
    optimizations = pageType && pages[pageType] && pages[pageType].optimizations;
  }

  if (!optimizations) {
    log.log(`No Optimizations present for pageType ${pageType} on ${parsedUrl.href}`);
    return response;
  }

  textResponse = await response.text();
  let optStartTs = 0;
  let optEndTs = 0;
  optStartTs = getTimeMs();

  let fromCacheResponse = null;
  if (htmlDoc) {
    fromCacheResponse = await HTML_CACHE.get(parsedUrl.href);
  }
  let duration = 0;
  if (!fromCacheResponse) {
    //console.log(`Not Serving ${parsedUrl.href} from HTML_CACHE`);

    const res = optimize({
      optimizations,
      textResponse,
      route: route ? route : (htmlDoc && 'MAIN_DOC' || ''),
      auditConfig,
      parsedMainDocUrl
    });
    textResponse = res.textResponse;
    duration = res.time;
    if (htmlDoc) {
      //TODO: Add this change using declarative way only, by having an internal `change` as part of optimizations. 
      textResponse += `
    <script>
      (function (version, versionReadable) { ${injectCode} })(${version}, '${versionReadable}')
    </script> `;
      await HTML_CACHE.put(parsedUrl.href, textResponse, { expirationTtl: 3 * 60 * 60/*3 hours*/ });
    }
  } else {
    console.log(`Fetching ${parsedUrl.href} from HTML_CACHE`);
    textResponse = fromCacheResponse;
  }

  optEndTs = getTimeMs();
  /** @type {Record<string, string>} */
  const headers = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [name, value] of response.headers.entries()) {
    headers[name] = value;
  }
  return new Response(textResponse, {
    headers: {
      ...headers,
      'Server-Timing': `opts; dur = ${optEndTs - optStartTs}, fn; dur = ${duration} `,
      'HTML_CACHE': String(+!!fromCacheResponse)
    },
  });
}

addEventListener('fetch', (event) => {
  const { url } = event.request;
  // ServiceWorker should be served from it's original place. It doesn't exist on test website.
  // Proxy should be served as is to keep things simple..
  // If URL isn't of the proxyWebsite which is possible in case of ServiceWorker only.
  if (
    url === 'http://127.0.0.1:9090/worker.js'
    || url.includes('http://127.0.0.1:9090/proxy')
    || !proxyWebsiteRegExp.test(url)
  ) {
    return;
  }
  const parsedUrl = new URL(url);

  /** @type null|URL */
  let parsedMainDocUrl = null;
  let referrer = event.request.headers.get('referer') || event.request.referrer;
  if (referrer) {
    parsedMainDocUrl = new URL(referrer)
  }

  // Routes are being used for completely modifying the response for a resource.
  if (parsedUrl.pathname.startsWith(PROXY_CONTENT_PATH) || parsedUrl.pathname === '/robots.txt') {
    return event.respondWith(handleRoutes(event.request).then(({ response, route }) => {

      // No Optimizations should be applied to robots.txt response as it is not a document parsed by browser.
      // TODO: Make a provision for this in routes.
      if (parsedUrl.pathname === '/robots.txt') {
        return response;
      }

      return optimizeResponse(response, {
        parsedMainDocUrl, route, parsedUrl
      })
    }));
  }

  // eslint-disable-next-line no-use-before-define
  event.respondWith(handleRequest(event.request));
});

// 'install' event doesn't fire for Cloudflare Worker.
addEventListener('install', () => {
  // @ts-ignore skipWaiting exists in ServiceWorker but not in Cloudflare worker
  self.skipWaiting();

  // Perform any other actions required for your
  // service worker to install, potentially inside
  // of event.waitUntil();
});

// 'activate' event doesn't fire for Cloudflare Worker.
self.addEventListener('activate', event => {
  //@ts-ignore waitUntil event exist in ServiceWorker but not in Cloudflare worker
  event.waitUntil(clients.claim());
});

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  let { url } = request;
  let pageType;
  url = url.replace(proxyWebsiteRegExp, website);

  const parsedUrl = new URL(url);

  pageType = getPageType(pages, parsedUrl);

  let response;



  if (await HTML_CACHE.get(parsedUrl.href)) {
    console.log(`Building Fake Content to let the response for ${url} serve from cache.`);
    // FIXME: It is a hack Required by optimizeResponse to consider the request as html request.
    response = new Response('THIS CONTENT SHOULD NEVER BE SERVED because the content to be served is available in cache. It is a hackish way to avoid fetching the content from origin when it is available in cache.', {
      headers: {
        'content-type': 'text/html'
      }
    });
  } else {
    log.log('Fetching URL', url, 'pageType:', pageType);
    response = fetch(url, {
      headers: {
        'User-Agent': WORKER_USER_AGENT
      },
    });
  }

  return optimizeResponse(await response, {
    parsedMainDocUrl: parsedUrl,
    parsedUrl: parsedUrl
  });
}
