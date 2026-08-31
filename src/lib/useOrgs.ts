import { useEffect, useState } from "react";
import type { OrgSummary } from "../data/types";
import { fetchOrgs } from "./api";

export interface OrgsState {
  /** null for the first render, then the full summary list */
  orgs: OrgSummary[] | null;
}

/** Dataset loader: summaries from the bundled dataset. The promise is
 * module-cached so Header, MapPage and CardsPage share one load. */
let orgsPromise: Promise<OrgSummary[]> | null = null;

function loadOrgs(): Promise<OrgSummary[]> {
  orgsPromise ??= fetchOrgs();
  return orgsPromise;
}

export function useOrgs(): OrgsState {
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOrgs().then((next) => {
      if (!cancelled) setOrgs(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { orgs };
}
