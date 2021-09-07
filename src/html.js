/* eslint-disable no-param-reassign */
export class Replace {
  /**
   * @param {[(string|RegExp), string]} replaceParams
   */
  constructor(replaceParams) {
    // eslint-disable-next-line prefer-destructuring
    this.toReplace = replaceParams[0];
    // eslint-disable-next-line prefer-destructuring
    this.replaceWith = replaceParams[1];
  }
}

/**
 * @param {string} string
 */
function escapeRegExp(string) {
  return string.replace(/[/\-[\]{}()*+?.^$|]/g, "\\$&");
}

/**
 *
 * @param {string|RegExp} toReplace
 * @param {string} replaceWith
 * @param {any} options
 * @returns
 */
export function getReplaceCommand(toReplace, replaceWith, options = {}) {
  const isRegExp = toReplace instanceof RegExp;

  if (!isRegExp) {
    if (!options.noEscape) {
      // @ts-ignore
      // eslint-disable-next-line no-param-reassign
      toReplace = escapeRegExp(toReplace);
    }
    // eslint-disable-next-line no-param-reassign
    toReplace = new RegExp(toReplace, "gi");
  }
  // TODO: By default replace all and in any case. Make it configurable.
  return new Replace([toReplace, replaceWith]);
}

/**
 * @param {{ [s: string]: any; }} attrMap
 */
function serializeToAttributes(attrMap) {
  let serialized = "";
  // @ts-ignore
  // eslint-disable-next-line no-restricted-syntax
  for (const [attrName, attrValue] of Object.entries(attrMap)) {
    serialized += `${attrName}="${attrValue}" `;
  }
  return serialized;
}
/**
 * @param {string} link
 * @param {{crossorigin:string|boolean}} options
 */
export function nonRenderBlockingStylesheet(
  link,
  options = { crossorigin: "anonymous" }
) {
  let attrString = `rel="preload" perframe-${this.changeId}  onload='this.rel="stylesheet"' as="style" type="text/css" href="${link} "`;
  // @ts-ignore
  // eslint-disable-next-line no-param-reassign
  if (options.crossorigin === false) {
    attrString += "";
  } else {
    attrString += ` crossorigin="${options.crossorigin}"`;
  }
  return `<link ${attrString} ></link >`;
}

/**
 *
 * @param {string} tagName
 * @param {Record<string, string>} attrs
 * @returns
 */
export function addAttr(tagName, attrs) {
  const attrsString = serializeToAttributes(attrs);
  return getReplaceCommand(
    `<${tagName}`,
    `<${tagName} perframe-atr-${this.changeId} ${attrsString}`
  );
}

/**
 *
 * @param {string} tagName
 * @param {string} attrName
 * @returns
 */
export function removeAttr(tagName, attrName) {
  attrName = attrName.trim();
  return getReplaceCommand(
    new RegExp(`<${tagName}([^>]*)\\b${attrName}\\b`, 'g'),
    `<${tagName} perframe-rat-${this.changeId} $1`
  );
}

/**
 * @param {string} oldAttrName
 * @param {string} newAttrName
 */
export function changeAttrName(oldAttrName, newAttrName) {
  return getReplaceCommand(`${oldAttrName}=`, `perframe-can-${this.changeId} ${newAttrName}=`);
}

/**
 * @param {string|string[]} resourceUrls
 */
export function disableResources(resourceUrls) {
  if (!(resourceUrls instanceof Array)) {
    // eslint-disable-next-line no-param-reassign
    resourceUrls = [resourceUrls];
  }
  /** @type string[] */
  const enrichedResourceUrls = [];
  // eslint-disable-next-line no-param-reassign
  resourceUrls.forEach((resourceUrl) => {
    if (!resourceUrl.startsWith('https://')) {
      throw new Error(`URL must start with https://. The URL is ${resourceUrl}`);
    }
    enrichedResourceUrls.push(
      resourceUrl,
      resourceUrl.replace(/^https:\/\//g, ''), // Protocol Relative URL
      resourceUrl.replace(/^https:\/\//g, 'http://'), // HTTP URL
      resourceUrl.replace(/\//g, "\\/") // URL with slashes escaped present as string at anyplace
    );
  });

  let regExp = enrichedResourceUrls.map((url) => escapeRegExp(url)).join("|");
  regExp = `(${regExp})`;
  // Using 127.0.0.1 and about:blank still initiates connection which has blocking time.
  // file:/// urls are immediately blocked by browser from security reasons, so it seems to be the fastest and most flexible but that is still highlighted by PSI as blocking scripts and taking time more than 500ms per request
  // Using "" doesn't initiate connection and doesn't showup in network panel as well but it won't work when resourceURL provided is partial(so with this limitation this is the only thing that works)
  return getReplaceCommand(regExp, "file:///$1", {
    noEscape: true,
  });
}

export function disableFontFace() {
  return getReplaceCommand("@font-face", `@no-perframe-font-face${this.changeId}`);
}

/**
 *
 * @param {string} html
 * @param {string} tag
 * @returns
 */
export function addHtmlAtEndOf(html, tag) {
  return getReplaceCommand(`</${tag}>`, `<!--perframe-hae-${this.changeId}-->${html}</${tag}>`);
}

/**
 *
 * @param {string} html
 * @param {string} tag
 * @returns
 */
export function addHtmlAtStartOf(html, tag) {
  return getReplaceCommand(`<${tag}>`, `<${tag}><!--perframe-aHS -${this.changeId}-->${html}`);
}

export function disableAllStyleResources() {
  return getReplaceCommand(
    /rel=(["'])?stylesheet/g,
    `rel=$1no-perframe-${this.changeId}`
  );
}

/**
 *
 * @param {string|RegExp} scriptOuterHtml
 * @returns
 */
export function deferScriptHavingOuterHtml(scriptOuterHtml) {
  return getReplaceCommand(
    scriptOuterHtml,
    // toString handles RegExp string as well
    scriptOuterHtml.toString().replace("<script", `<script perframe-drs-${this.changeId} defer`)
  );
}

/**
 *
 * @param {string} toAdd
 * @param {string} addAfterMe
 * @returns
 */
export function addHtmlAfterHtml(toAdd, addAfterMe) {
  return getReplaceCommand(
    `${addAfterMe}`,
    `${addAfterMe}<!--perframe-hah-->${toAdd}`
  );
}

/**
 *
 * @param {string} toAdd
 * @param {string} addBeforeMe
 * @returns
 */
export function addHtmlBeforeHtml(toAdd, addBeforeMe) {
  return getReplaceCommand(
    `${addBeforeMe}`,
    `<!--perframe-hbh-->${toAdd}${addBeforeMe}`
  );
}

export function makeAllAsyncScriptsDefer() {
  return getReplaceCommand(" async ", ` perframe-asd-${this.changeId} defer `);
}

/**
 *
 * @param {string} url
 * @param {string} proxyPath
 * @returns
 */
export function switchToProxyFor(url, proxyPath) {
  return getReplaceCommand(url, `/__perfproxy${proxyPath}`);
}

/**
 * @param {string} fullFunctionName
 */
export function disableFunctionCall(fullFunctionName) {
  // eslint-disable-next-line no-param-reassign
  fullFunctionName = fullFunctionName.trim();
  const tokens = fullFunctionName.split('.');
  const newFunctionName = `${tokens.slice(0, -1).join('.')}.perframe_${tokens.slice(-1)}`;
  return getReplaceCommand(new RegExp(`${fullFunctionName}\\s*\\(`, 'g'), `${newFunctionName}=function(){}; ${newFunctionName}(`);
}

/**
 * @param {string} url
 * @param {string} proxyPath
 */
export function loadResourceFromProxy(url, proxyPath) {
  return getReplaceCommand(url, `/__perfproxy${proxyPath}`);
}

/**
 * @param {string} url
 * @param {string} newUrl
 */
export function changeResourcePath(url, newUrl) {
  return getReplaceCommand(url, newUrl);
}
