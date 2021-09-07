import * as ShopifyPages from "./ShopifyPages";

export interface SubResource {
  url: string;
  type: string;
  description: string;
  website: string;
}

interface RouteData {
  version: string;
  parsedUrl: URL;
  pageType: ShopifyPages.PageType | null;
  auditConfig: AuditConfig;
  reportHtml: string;
}

export interface Route {
  path: string;
  response: {
    headers?: Record<string, string>;
    content?: string | ((store: RouteData) => Response);
    fetch?: string;
  };
}

export type Routes = Route[];

export default interface AuditConfig {
  // Must start with /
  routes: Routes;
  pages: ShopifyPages.ShopifyPages;
  website: string;
  resources: SubResource[];
}
