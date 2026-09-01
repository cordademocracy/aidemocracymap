import { requireAdmin } from "./adminAuth";
import { bumpOrgsVersion } from "./orgs";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { clientIp, json, type Env } from "./types";
import { uploadExists } from "./uploads";
import { validateDraft, validateKeyProjects, validateOrgUpdate } from "./validate";

const STATUSES = ["pending", "approved", "rejected"] as const;

// allow-list stops arbitrary keys in `changes` from reaching SQL as column names;
// `note` is curator-facing only and must never be added here
const COLUMN: Record<string, string> = {
  tagline: "tagline",
  description: "description",
  aiDemocracyAngle: "ai_democracy_angle",
  website: "website",
};

export const APPLIED_EDIT_KEYS = new Set([...Object.keys(COLUMN), "logoUpload", "keyProjects"]);

async function gate(req: Request, env: Env): Promise<Response | null> {
  const hash = await ipHash(env.FORM_TOKEN_SECRET, clientIp(req));
  const ok = await hit(env.DB, "adm", hash, LIMITS.admin.limit, LIMITS.admin.windowSeconds);
  if (!ok) return json({ detail: "rate limit exceeded" }, 429);
  return requireAdmin(req, env);
}

function statusFilter(url: URL): { ok: boolean; value: string | null } {
  const status = url.searchParams.get("status");
  if (status === null) return { ok: true, value: null };
  if ((STATUSES as readonly string[]).includes(status)) return { ok: true, value: status };
  return { ok: false, value: null };
}

interface SubmissionRow {
  id: number;
  org: string;
  draft: string | null;
  contributor_name: string | null;
  contributor_email: string | null;
  status: string;
  created_at: string;
}

interface EditRow {
  id: number;
  org_slug: string;
  changes: string;
  contributor_name: string | null;
  contributor_email: string | null;
  status: string;
  created_at: string;
}

export async function listSubmissions(req: Request, env: Env, url: URL): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const filter = statusFilter(url);
  if (!filter.ok) return json({ detail: "invalid status filter" }, 422);
  const base =
    "SELECT id, org, draft, contributor_name, contributor_email, status, created_at FROM submissions";
  const stmt = filter.value
    ? env.DB.prepare(`${base} WHERE status = ?1 ORDER BY created_at DESC, id DESC`).bind(filter.value)
    : env.DB.prepare(`${base} ORDER BY created_at DESC, id DESC`);
  const { results } = await stmt.all<SubmissionRow>();
  return json(
    results.map((r) => ({
      id: r.id,
      org: JSON.parse(r.org),
      draft: r.draft === null ? null : JSON.parse(r.draft),
      contributorName: r.contributor_name,
      contributorEmail: r.contributor_email,
      status: r.status,
      createdAt: r.created_at,
    })),
  );
}

export async function listEdits(req: Request, env: Env, url: URL): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const filter = statusFilter(url);
  if (!filter.ok) return json({ detail: "invalid status filter" }, 422);
  const base =
    "SELECT id, org_slug, changes, contributor_name, contributor_email, status, created_at FROM edits";
  const stmt = filter.value
    ? env.DB.prepare(`${base} WHERE status = ?1 ORDER BY created_at DESC, id DESC`).bind(filter.value)
    : env.DB.prepare(`${base} ORDER BY created_at DESC, id DESC`);
  const { results } = await stmt.all<EditRow>();
  return json(
    results.map((r) => ({
      id: r.id,
      orgSlug: r.org_slug,
      changes: JSON.parse(r.changes),
      contributorName: r.contributor_name,
      contributorEmail: r.contributor_email,
      status: r.status,
      createdAt: r.created_at,
    })),
  );
}

async function loadPending(
  env: Env,
  table: "submissions" | "edits",
  id: number,
): Promise<{ status: string; org?: string; draft?: string | null } | Response> {
  const row = await env.DB.prepare(
    table === "submissions"
      ? "SELECT status, org, draft FROM submissions WHERE id = ?1"
      : "SELECT status FROM edits WHERE id = ?1",
  )
    .bind(id)
    .first<{ status: string; org?: string; draft?: string | null }>();
  if (row === null) return json({ detail: `${table.slice(0, -1)} not found` }, 404);
  if (row.status !== "pending") return json({ detail: `${table.slice(0, -1)} already resolved` }, 409);
  return row;
}

/** Always non-empty: a slug is the org PK and the only handle `/api/orgs/:slug` accepts. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug === "" ? "org" : slug;
}

/** Suffixes -2, -3 … so a repeat name can never collide with the slug PK. */
export async function uniqueSlug(env: Env, base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const hit = await env.DB.prepare("SELECT 1 FROM organizations WHERE slug = ?1")
      .bind(candidate)
      .first();
    if (hit === null) return candidate;
  }
}

async function resolve(env: Env, table: "submissions" | "edits", id: number, status: string): Promise<void> {
  await env.DB.prepare(`UPDATE ${table} SET status = ?1, resolved_at = ?2 WHERE id = ?3`)
    .bind(status, new Date().toISOString(), id)
    .run();
}

export async function saveSubmissionDraft(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "submissions", id);
  if (pending instanceof Response) return pending;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ detail: "invalid json body" }, 422);
  }
  const v = validateDraft(body);
  if (!v.ok) return json({ detail: v.detail }, 422);
  if (v.value.logoUpload && !(await uploadExists(env, v.value.logoUpload))) {
    return json({ detail: "logoUpload does not reference an existing upload" }, 422);
  }
  await env.DB.prepare("UPDATE submissions SET draft = ?1 WHERE id = ?2")
    .bind(JSON.stringify(v.value), id)
    .run();
  return json({ ok: true });
}

export async function approveSubmission(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "submissions", id);
  if (pending instanceof Response) return pending;
  if (pending.draft == null) {
    const org = JSON.parse(pending.org ?? "{}") as { v?: number };
    if (org.v === 2) return json({ detail: "enrich the submission before approving" }, 409);
  }
  const draft = JSON.parse(pending.draft ?? "null") as Record<string, unknown> | null;
  let slug: string | null = null;
  if (draft !== null) {
    slug = await uniqueSlug(env, slugify(String(draft.name)));
    const host = (() => { try { return new URL(String(draft.website)).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    await env.DB.prepare(
      `INSERT INTO organizations (slug,name,website,category,region,tagline,description,
       ai_democracy_angle,focus_tags,location,founded,funders,key_projects,logo_domain,logo_url,
       depth_ring,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`,
    )
      .bind(
        slug, String(draft.name), String(draft.website), String(draft.category),
        String(draft.region), String(draft.tagline), String(draft.description ?? ""),
        String(draft.aiDemocracyAngle ?? ""), JSON.stringify(draft.focusTags ?? []),
        String(draft.location ?? ""), draft.founded == null ? null : Number(draft.founded),
        JSON.stringify(draft.funders ?? []), JSON.stringify(draft.keyProjects ?? []),
        host, draft.logoUpload == null ? null : `/api/uploads/${String(draft.logoUpload)}`,
        String(draft.depthRing ?? "core"), new Date().toISOString(),
      )
      .run();
    await bumpOrgsVersion(env);
  }
  await resolve(env, "submissions", id, "approved");
  return json({ ok: true, slug });
}

export async function rejectSubmission(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "submissions", id);
  if (pending instanceof Response) return pending;
  await resolve(env, "submissions", id, "rejected");
  return json({ ok: true });
}

export async function approveEdit(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "edits", id);
  if (pending instanceof Response) return pending;
  const row = await env.DB.prepare("SELECT changes, org_slug FROM edits WHERE id = ?1")
    .bind(id)
    .first<{ changes: string; org_slug: string }>();
  if (row !== null) {
    const changes = JSON.parse(row.changes) as Record<string, unknown>;
    const now = new Date().toISOString();
    const updates: D1PreparedStatement[] = [];
    for (const [key, value] of Object.entries(changes)) {
      const column = COLUMN[key];
      if (column === undefined) continue;
      updates.push(
        env.DB.prepare(`UPDATE organizations SET ${column} = ?1, updated_at = ?2 WHERE slug = ?3`)
          .bind(value as string, now, row.org_slug),
      );
    }
    if (typeof changes.logoUpload === "string") {
      updates.push(
        env.DB.prepare("UPDATE organizations SET logo_url = ?1, updated_at = ?2 WHERE slug = ?3")
          .bind(`/api/uploads/${changes.logoUpload}`, now, row.org_slug),
      );
    }
    if (changes.keyProjects !== undefined) {
      // JSON-encoded column skips the plain COLUMN path; re-validate since the row
      // may have been stored under older rules and this is the last gate before it's public
      const projects = validateKeyProjects(changes.keyProjects);
      if (!projects.ok) return json({ detail: projects.detail }, 422);
      updates.push(
        env.DB.prepare("UPDATE organizations SET key_projects = ?1, updated_at = ?2 WHERE slug = ?3")
          .bind(JSON.stringify(projects.value), now, row.org_slug),
      );
    }
    if (updates.length > 0) {
      const applied = await env.DB.batch(updates);
      if (applied.some((result) => result.meta.changes === 0)) {
        return json({ detail: "organization not found" }, 404);
      }
    }
    await bumpOrgsVersion(env);
  }
  await resolve(env, "edits", id, "approved");
  return json({ ok: true });
}

/** Puts a resolved row back in the pending list. An approved submission stays
 * closed: `submissions` records no slug, so approving it twice would insert a
 * second org row. An approved edit reopens; re-applying it is idempotent. */
export async function reopen(
  req: Request,
  env: Env,
  table: "submissions" | "edits",
  id: number,
): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const row = await env.DB.prepare(`SELECT status FROM ${table} WHERE id = ?1`)
    .bind(id)
    .first<{ status: string }>();
  if (row === null) return json({ detail: `${table.slice(0, -1)} not found` }, 404);
  if (row.status === "pending") return json({ detail: `${table.slice(0, -1)} already pending` }, 409);
  if (table === "submissions" && row.status !== "rejected") {
    return json({ detail: "an approved submission cannot be reopened; edit the published org instead" }, 409);
  }
  await env.DB.prepare(`UPDATE ${table} SET status = 'pending', resolved_at = NULL WHERE id = ?1`)
    .bind(id)
    .run();
  return json({ ok: true });
}

// allow-list stops arbitrary keys in the request body from reaching SQL as column names
const ORG_COLUMN: Record<string, string> = {
  name: "name", website: "website", tagline: "tagline", description: "description",
  aiDemocracyAngle: "ai_democracy_angle", location: "location", logoDomain: "logo_domain",
  category: "category", region: "region", depthRing: "depth_ring", founded: "founded",
  focusTags: "focus_tags", funders: "funders", keyProjects: "key_projects",
};
const ORG_JSON_FIELDS = new Set(["focusTags", "funders", "keyProjects"]);

export async function updateOrg(req: Request, env: Env, slug: string): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const exists = await env.DB.prepare("SELECT 1 FROM organizations WHERE slug = ?1").bind(slug).first();
  if (exists === null) return json({ detail: "organization not found" }, 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ detail: "invalid json body" }, 422);
  }
  const parsed = validateOrgUpdate(body);
  if (!parsed.ok) return json({ detail: parsed.detail }, 422);

  const now = new Date().toISOString();
  const statements = Object.entries(parsed.value).map(([key, value]) =>
    env.DB.prepare(`UPDATE organizations SET ${ORG_COLUMN[key]} = ?1, updated_at = ?2 WHERE slug = ?3`)
      .bind(ORG_JSON_FIELDS.has(key) ? JSON.stringify(value) : value, now, slug),
  );
  const applied = await env.DB.batch(statements);
  if (applied.some((result) => result.meta.changes === 0)) {
    return json({ detail: "organization not found" }, 404);
  }
  await bumpOrgsVersion(env);
  return json({ ok: true, slug });
}

export async function rejectEdit(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "edits", id);
  if (pending instanceof Response) return pending;
  await resolve(env, "edits", id, "rejected");
  return json({ ok: true });
}
