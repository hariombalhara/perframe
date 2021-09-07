import type { Replace } from "./html";
import * as html from "./html";

export type PageType = "Collection" | "HomePage" | "ProductPage";

export type Change = {
  // Autogenerated
  id?: number;

  _command?: Replace[];

  // If the change fails to apply, then what are the errors.
  failedToApply?: string;

  // Describe the Change
  description: any;

  // Something that breaks the functionality of the page
  // 2 is potentially breaking - To be verified
  breaking?: boolean | 2;

  // Disable the change
  disabled?: boolean;

  onlyMe?: boolean;

  disabledReason?: string;

  // A list of subresources that need modification to achieve the Change
  subresources?: ({
    _command?: Replace[];
    replace: () => Replace[];
    route: string;
  } & ThisType<typeof html>)[];

  // Implementation Details for Developers of the website
  implementation?: {
    effort: "High" | "Low" | "Medium";
    comments?: string[] | string;
    suggestion?: string;
  };

  // Commands to achieve the change
  replace: () => Replace[];

  devCommentary?: string[];
} & ThisType<typeof html>;

export type Changes = Change[];

export type Optimization = {
  targets: string[];
  changes: Change[];
  improvements?: Record<string, string>[];
};

type PageConfig = {
  samples?: any[];
  checker: (url: string) => {};
  optimizations: null | Optimization[];
};

export type ShopifyPages = Record<PageType, PageConfig>;
export default ShopifyPages;
