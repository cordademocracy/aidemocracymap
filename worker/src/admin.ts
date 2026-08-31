import { requireAdmin } from "./adminAuth";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { clientIp, json, type Env } from "./types";
import { uploadExists } from "./uploads";
import { validateDraft } from "./validate";

const STATUSES = ["pending", "approved", "rejected"] as const;

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
  await resolve(env, "submissions", id, "approved");
  return json({ ok: true });
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
  await resolve(env, "edits", id, "approved");
  return json({ ok: true });
}

export async function rejectEdit(req: Request, env: Env, id: number): Promise<Response> {
  const denied = await gate(req, env);
  if (denied) return denied;
  const pending = await loadPending(env, "edits", id);
  if (pending instanceof Response) return pending;
  await resolve(env, "edits", id, "rejected");
  return json({ ok: true });
}
