/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
import { log } from "./logger";
import * as html from './html';


/**
 * @param {import("./ShopifyPages").Optimization['changes'][0]} change
 * @param {URL} parsedUrl
 * @returns boolean|2|0  2 in case dynamically disabled. 0 in case of dynamically enabling. true in case it is disabled through config.
 */
export function getDisabledStatus(change, parsedUrl) {
  if (!change.id) {
    throw new Error('changeId not available');
  }
  const disabledChangesQuery = parsedUrl.searchParams.get('__perframe_disable_changes') || null;
  const enabledChangesQuery = parsedUrl.searchParams.get('__perframe_enable_changes') || null;
  const onlyTheseChangesQuery = parsedUrl.searchParams.get('__perframe_only_changes') || null;
  const disableAllBreakingChanges = parsedUrl.searchParams.get('__perframe_disable_all_breaking_changes') !== null;
  const onlyTheseChanges = [];

  if (onlyTheseChangesQuery) {
    onlyTheseChanges.push(...onlyTheseChangesQuery.split(',').map((item) => +item));
    if (onlyTheseChanges.indexOf(change.id) > -1) {
      return !change.disabled ? change.disabled : 0;
    }
    return change.disabled ? change.disabled : 2;
  }

  /**
   *  @type number[]
   */
  const disabledChanges = [];

  /**
   *  @type number[]
   */
  const enabledChanges = [];

  if (disabledChangesQuery) {
    disabledChangesQuery.split(',').forEach((disabledChangeId) => {
      disabledChanges.push(+(disabledChangeId.trim()));
    });
  }

  if (enabledChangesQuery) {
    enabledChangesQuery.split(',').forEach((enabledChangeId) => {
      enabledChanges.push(+(enabledChangeId.trim()));
    });
  }

  if (enabledChanges.indexOf(change.id) !== -1) {
    return 0;
  }

  if (disabledChanges.indexOf(change.id) > -1) {
    return 2;
  }
  if (change.disabled) {
    return change.disabled;
  }

  if (disableAllBreakingChanges && change.breaking) {
    return 2;
  }

  return change.disabled;
}

/**
 * @param {string} textResponse
 * @param {import('./html').Replace[]} replaceParams
 */
function replaceText(textResponse, replaceParams) {
  /** @type string[]*/
  let errors = [];
  replaceParams.forEach((replaceCmd) => {
    let newTextResponse = "";
    // @ts-ignore
    newTextResponse = textResponse.replace(
      replaceCmd.toReplace,
      replaceCmd.replaceWith
    );
    if (newTextResponse === textResponse) {
      let error = `Failed to replace \`${replaceCmd.toReplace}\` with \`${replaceCmd.replaceWith}\``
      errors.push(error)
    }
    // eslint-disable-next-line no-param-reassign
    textResponse = newTextResponse;
  });
  return { result: textResponse, error: errors.join("\n") };
}

/* eslint-disable import/prefer-default-export */
/**
 *  @param {{optimizations:import("./ShopifyPages").Optimization[], textResponse: string, route: null|string|undefined, auditConfig: any, parsedMainDocUrl: URL}} obj
 */
export function optimize({
  optimizations,
  textResponse: _textResponse,
  route,
  auditConfig,
  parsedMainDocUrl
}) {
  const fnStartTime = 0;
  const fnEndTime = 0;

  let textResponse = _textResponse;
  if (route === "MAIN_DOC" || (route && auditConfig.routes[route])) {
    optimizations.forEach((opt) => {
      const { changes } = opt;
      changes.forEach((change) => {
        // eslint-disable-next-line no-underscore-dangle
        if (!change._command) {
          throw new Error('_command not set');
        }
        // @ts-ignore
        if (+parsedMainDocUrl.searchParams.get("__perframe_debug_change_id") === change.id) {
          // eslint-disable-next-line no-debugger
          debugger;
        }

        if (getDisabledStatus(change, parsedMainDocUrl)) {
          log.log(`Skipping Disabled Change(${change.id}): ${change.description}`);
          return;
        }
        if (route === "MAIN_DOC") {
          let result;
          result = replaceText(textResponse, change._command);
          textResponse = result.result;
          change.failedToApply = result.error;
        } else if (change.subresources) {
          change.subresources.forEach((subresourceChange) => {
            if (!subresourceChange._command) {
              throw new Error('_command not set');
            }
            if (subresourceChange.route === route) {
              let result;
              result = replaceText(
                textResponse,
                subresourceChange._command
              );
              textResponse = result.result;
              if (result.error) {
                subresourceChange.failedToApply = result.error;
              }
            }
          });
        }
      });
    });
  }
  return { textResponse, time: fnStartTime - fnEndTime };
}

export function isInServiceWorker() {
  try {
    return !!self.navigator;
  } catch (e) {
    return false;
  }
}

/**
 * @param {import('./ShopifyPages').ShopifyPages } pages
 */
export function prepareChanges(pages) {

  /**
   * @param change {import('./ShopifyPages').Change}
   */
  function validate(change) {
    // Validations
    if (change.disabled && !change.disabledReason) {
      throw new Error(`Must specify disabled reason for change: ${change.description}`);
    }
  }

  /**
   * @param change {import('./ShopifyPages').Change}
   */
  function addHtmlUtilities(change) {
    // Add html utilities
    change._command = change.replace.apply({ changeId, ...html });
    change.subresources && change.subresources.forEach((subresource) => {
      subresource._command = subresource.replace.apply({ changeId, ...html });
    });
  }

  let changeId = 0;
  for (const [i, page] of Object.entries(pages)) {
    page.optimizations && page.optimizations.forEach((opt) => {
      const { changes } = opt;
      changes.forEach((change) => {
        changeId += 1;
        change.id = changeId;
        validate(change);
        addHtmlUtilities(change);
      });
    });
  }
}

/**
 * @param {import('./ShopifyPages') } pages
 * @param {URL|null} parsedUrl
 * @returns {import('./ShopifyPages').PageType | null}
 */
export function getPageType(pages, parsedUrl) {
  let pageType = null;
  if (!parsedUrl) {
    return pageType;
  }
  // TODO: A website can clearly define it's pages using RegExps or functions
  Object.entries(pages).some(([category, config]) => {
    if (config.checker(parsedUrl.origin + parsedUrl.pathname)) {
      pageType = category;
      return true;
    }
  });
  return pageType;
}


export function getTimeMs() {
  let time = 0;
  if (self.performance) {
    time = performance.now();
  }
  return time;
}

/**
 *  @param {string|null} contentType
 */
export function isContentTypeText(contentType) {
  if (!contentType) {
    return false;
  }
  return contentType.indexOf('text') > -1 || contentType.indexOf('/json') > -1 || contentType.indexOf('/javascript') > -1;
}
