import { useEffect } from "react";
import { m } from "../paraglide/messages.js";

/** Sets document.title for the current route; restores nothing on unmount
 * since the next page's own call immediately overwrites it. */
export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = `${m["common.brandName"]()} — ${pageTitle ?? m["common.siteTitle"]()}`;
  }, [pageTitle]);
}
