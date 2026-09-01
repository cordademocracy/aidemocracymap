import { json, type Env } from "./types";
import { getMeta, setMeta } from "./digest";

const SUMMARY_COLUMNS =
  "slug,name,website,category,region,tagline,focus_tags,location,logo_url,depth_ring";

interface OrgRow {
  slug: string; name: string; website: string; category: string; region: string;
  tagline: string; description?: string; ai_democracy_angle?: string; focus_tags: string;
  location: string; founded?: number | null; funders?: string; key_projects?: string;
  logo_domain?: string; logo_url: string | null; depth_ring: string;
}

export function orgRowToSummary(r: OrgRow) {
  return {
    slug: r.slug, name: r.name, website: r.website, category: r.category, region: r.region,
    tagline: r.tagline, focusTags: JSON.parse(r.focus_tags), location: r.location,
    logoUrl: r.logo_url, depthRing: r.depth_ring,
  };
}

export function orgRowToFull(r: OrgRow) {
  return {
    ...orgRowToSummary(r),
    description: r.description ?? "",
    aiDemocracyAngle: r.ai_democracy_angle ?? "",
    founded: r.founded ?? null,
    funders: JSON.parse(r.funders ?? "[]"),
    keyProjects: JSON.parse(r.key_projects ?? "[]"),
    logoDomain: r.logo_domain ?? "",
  };
}

/** Any org write bumps this; the ETag is derived from it, so a stale cache
 * cannot survive an approval. */
export async function bumpOrgsVersion(env: Env): Promise<void> {
  const current = Number((await getMeta(env.DB, "orgs_version")) ?? "0");
  await setMeta(env.DB, "orgs_version", String(current + 1));
}

export async function listOrgs(req: Request, env: Env): Promise<Response> {
  const version = (await getMeta(env.DB, "orgs_version")) ?? "0";
  const { results } = await env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM organizations ORDER BY name`,
  ).all<OrgRow>();
  const etag = `W/"${version}-${results.length}"`;
  const headers = {
    etag,
    "cache-control": "public, max-age=60, stale-while-revalidate=300, stale-if-error=86400",
    "x-content-type-options": "nosniff",
  };
  if (req.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return json(results.map(orgRowToSummary), 200, headers);
}

// Fixed key order keeps the weekly sync diff readable; logoUrl is omitted (not null) when unset.
const KEY_ORDER = [
  "slug", "name", "website", "category", "region", "tagline", "description",
  "aiDemocracyAngle", "focusTags", "location", "founded", "funders", "keyProjects",
  "logoDomain", "logoUrl", "depthRing",
] as const;

export async function exportOrgs(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT * FROM organizations ORDER BY slug").all<OrgRow>();
  const ordered = results.map((r) => {
    const full = orgRowToFull(r) as Record<string, unknown>;
    return Object.fromEntries(
      KEY_ORDER.filter((k) => !(k === "logoUrl" && full[k] == null)).map((k) => [k, full[k]]),
    );
  });
  return json(ordered);
}

export async function getOrg(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM organizations WHERE slug = ?1")
    .bind(slug)
    .first<OrgRow>();
  return row === null ? json({ detail: "organization not found" }, 404) : json(orgRowToFull(row));
}
