import type { Category, OrgSummary, RegionId } from "../data/types";

/**
 * Preferred logo source for an org. An approved logo upload (org.logoUrl,
 * shaped like "/api/uploads/<id>") wins over the bundled /logos/<slug>-80.webp;
 * in dev it is prefixed with the Worker host so the image resolves off :8787.
 */
export function logoSrc(org: Pick<OrgSummary, "slug" | "logoUrl">): string {
  if (org.logoUrl) {
    if (import.meta.env.DEV && org.logoUrl.startsWith("/api/")) {
      return `http://localhost:8787${org.logoUrl}`;
    }
    return org.logoUrl;
  }
  return `/logos/${org.slug}-80.webp`;
}

/** srcset for bundled logos (D7); uploads are single-file, so none there. */
export function logoSrcSet(org: Pick<OrgSummary, "slug" | "logoUrl">): string | undefined {
  if (org.logoUrl) return undefined;
  return `/logos/${org.slug}-80.webp 2x, /logos/${org.slug}-120.webp 3x`;
}

/** Admin-gated URL for an upload id ("u_<hex>.png"), dev-prefixed to reach :8787. */
export function uploadUrl(id: string): string {
  const path = `/api/uploads/${id}`;
  return import.meta.env.DEV ? `http://localhost:8787${path}` : path;
}

export function orgsByRegion(list: OrgSummary[]): Record<RegionId, OrgSummary[]> {
  const map = {} as Record<RegionId, OrgSummary[]>;
  for (const org of list) {
    (map[org.region] ??= []).push(org);
  }
  // core orgs first so they sit at the center of each region cluster
  const rank = { core: 0, adjacent: 1, broad: 2 } as const;
  for (const list of Object.values(map)) {
    list.sort((a, b) => rank[a.depthRing] - rank[b.depthRing] || a.name.localeCompare(b.name));
  }
  return map;
}

export function categoryCounts(list: OrgSummary[]): Record<Category, number> {
  const counts = {
    research: 0,
    tools: 0,
    "policy-advocacy": 0,
    funder: 0,
    community: 0,
    media: 0,
  } as Record<Category, number>;
  for (const org of list) counts[org.category]++;
  return counts;
}

export function searchOrgs(
  list: OrgSummary[],
  query: string,
  category?: Category | "all"
): OrgSummary[] {
  const q = query.trim().toLowerCase();
  return list.filter((o) => {
    if (category && category !== "all" && o.category !== category) return false;
    if (!q) return true;
    const hay = [o.name, o.tagline, o.location, ...o.focusTags].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
