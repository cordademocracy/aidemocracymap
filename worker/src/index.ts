import {
  approveEdit,
  approveSubmission,
  listEdits,
  listSubmissions,
  rejectEdit,
  rejectSubmission,
  reopen,
  saveSubmissionDraft,
  updateOrg,
} from "./admin";
import { consumeLoginLink, requestLoginLink } from "./adminAuth";
import { getMeta, runDigest } from "./digest";
import { createEdit } from "./edits";
import { issueToken } from "./formToken";
import { exportOrgs, getOrg, listOrgs } from "./orgs";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { createSubmission } from "./submissions";
import { clientIp, json, type Env } from "./types";
import { createUpload, serveUpload } from "./uploads";

const UPLOAD_ROUTE = /^\/api\/uploads\/([A-Za-z0-9_.-]+)$/;
const ADMIN_SUBMISSION_ACTION = /^\/api\/admin\/submissions\/(\d+)\/(draft|approve|reject|reopen)$/;
const ADMIN_EDIT_ACTION = /^\/api\/admin\/edits\/(\d+)\/(approve|reject|reopen)$/;
const ADMIN_ORG = /^\/api\/admin\/orgs\/([a-z0-9-]+)$/;

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "GET" && path === "/api/health") {
    return json({ ok: true, digestLastSent: await getMeta(env.DB, "digest_last_sent") });
  }

  if (method === "GET" && path === "/api/form-token") {
    const hash = await ipHash(env.FORM_TOKEN_SECRET, clientIp(req));
    const ok = await hit(env.DB, "tok", hash, LIMITS.token.limit, LIMITS.token.windowSeconds);
    if (!ok) return json({ detail: "rate limit exceeded" }, 429);
    return json({ token: await issueToken(env.FORM_TOKEN_SECRET) });
  }

  if (method === "GET" && path === "/api/export") {
    const hash = await ipHash(env.FORM_TOKEN_SECRET, clientIp(req));
    const ok = await hit(env.DB, "exp", hash, 10, 3600);
    if (!ok) return json({ detail: "rate limit exceeded" }, 429);
    return exportOrgs(env);
  }

  if (method === "GET" && path === "/api/orgs") return listOrgs(req, env);
  const orgMatch = path.match(/^\/api\/orgs\/([a-z0-9-]+)$/);
  if (method === "GET" && orgMatch) return getOrg(env, orgMatch[1]!);

  if (method === "POST" && path === "/api/submissions") return createSubmission(req, env);
  if (method === "POST" && path === "/api/edits") return createEdit(req, env);
  if (method === "POST" && path === "/api/uploads") return createUpload(req, env);

  const uploadMatch = path.match(UPLOAD_ROUTE);
  if (method === "GET" && uploadMatch) return serveUpload(req, env, uploadMatch[1]!);

  if (method === "POST" && path === "/api/admin/login") return requestLoginLink(req, env);
  if (method === "GET" && path === "/api/admin/session") return consumeLoginLink(env, url);

  if (method === "GET" && path === "/api/admin/submissions") return listSubmissions(req, env, url);
  if (method === "GET" && path === "/api/admin/edits") return listEdits(req, env, url);

  const subMatch = path.match(ADMIN_SUBMISSION_ACTION);
  if (method === "POST" && subMatch) {
    const id = Number(subMatch[1]);
    if (subMatch[2] === "draft") return saveSubmissionDraft(req, env, id);
    if (subMatch[2] === "approve") return approveSubmission(req, env, id);
    if (subMatch[2] === "reopen") return reopen(req, env, "submissions", id);
    return rejectSubmission(req, env, id);
  }

  const editMatch = path.match(ADMIN_EDIT_ACTION);
  if (method === "POST" && editMatch) {
    const id = Number(editMatch[1]);
    if (editMatch[2] === "approve") return approveEdit(req, env, id);
    if (editMatch[2] === "reopen") return reopen(req, env, "edits", id);
    return rejectEdit(req, env, id);
  }

  const orgMatchAdmin = path.match(ADMIN_ORG);
  if (method === "PUT" && orgMatchAdmin) return updateOrg(req, env, orgMatchAdmin[1]!);

  return json({ detail: "not found" }, 404);
}

/** Dev only: vite serves the app on another port while the Worker owns /api.
 * No allow-credentials, so the admin session cookie never rides a cross-origin call. */
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function corsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (origin === null || !DEV_ORIGIN.test(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req);
    if (cors === null) return handle(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const handled = await handle(req, env);
    const res = new Response(handled.body, handled);
    for (const [key, value] of Object.entries(cors)) res.headers.set(key, value);
    return res;
  },
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runDigest(env, new Date());
  },
};

export default worker;
