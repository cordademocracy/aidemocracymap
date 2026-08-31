import { describe, expect, it } from "vitest";
import { ipHash } from "../src/rateLimit";
import {
  VALID_DRAFT,
  adminEnv,
  apiRequest,
  dispatch,
  insertEdit,
  insertSubmission,
  seedCounter,
  testEnv,
} from "./helpers";

function get(path: string): Request {
  return apiRequest(path);
}

function post(path: string, body?: unknown): Request {
  return apiRequest(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const V2_ORG = { v: 2, name: "Wahl Chat", email: null, urls: ["https://wahl.chat"], note: "fits" };

describe("admin auth", () => {
  it("401s every admin route without a session", async () => {
    const env = testEnv();
    const paths: Request[] = [
      get("/api/admin/submissions"),
      get("/api/admin/edits"),
      post("/api/admin/submissions/1/draft", VALID_DRAFT),
      post("/api/admin/submissions/1/approve"),
      post("/api/admin/submissions/1/reject"),
      post("/api/admin/edits/1/approve"),
      post("/api/admin/edits/1/reject"),
    ];
    for (const req of paths) {
      expect((await dispatch(req, env)).status).toBe(401);
    }
  });

  it("401s a forged session cookie", async () => {
    const env = testEnv();
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const req = apiRequest("/api/admin/submissions", {
      headers: { Cookie: `admin_session=${expires}.${"0".repeat(64)}` },
    });
    expect((await dispatch(req, env)).status).toBe(401);
  });

  it("401s a wrong break-glass token", async () => {
    const env = testEnv({ ADMIN_BREAKGLASS: "the-real-one" });
    const req = apiRequest("/api/admin/submissions", {
      headers: { "X-Admin-Token": "not-it" },
    });
    expect((await dispatch(req, env)).status).toBe(401);
  });

  it("accepts the break-glass token", async () => {
    const env = testEnv({ ADMIN_BREAKGLASS: "the-real-one" });
    const req = apiRequest("/api/admin/submissions", {
      headers: { "X-Admin-Token": "the-real-one" },
    });
    expect((await dispatch(req, env)).status).toBe(200);
  });

  it("lets the dev bypass through", async () => {
    expect((await dispatch(get("/api/admin/submissions"), adminEnv())).status).toBe(200);
  });

  it("429s past 30 admin requests per minute per IP", async () => {
    const env = adminEnv();
    await seedCounter("adm", await ipHash(env.FORM_TOKEN_SECRET, "203.0.113.7"), 60, 30);
    expect((await dispatch(get("/api/admin/submissions"), env)).status).toBe(429);
  });
});

describe("GET /api/admin/submissions", () => {
  it("returns camelCase rows with the parsed payload and a null draft", async () => {
    const env = adminEnv();
    const id = await insertSubmission(V2_ORG);
    const res = await dispatch(get("/api/admin/submissions"), env);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, org: V2_ORG, draft: null, status: "pending" });
    expect(rows[0]).toHaveProperty("contributorEmail");
    expect(rows[0]).toHaveProperty("createdAt");
  });

  it("filters by status and rejects an unknown filter", async () => {
    const env = adminEnv();
    await insertSubmission(V2_ORG);
    const pending = await dispatch(get("/api/admin/submissions?status=pending"), env);
    expect(((await pending.json()) as unknown[]).length).toBe(1);
    const approved = await dispatch(get("/api/admin/submissions?status=approved"), env);
    expect(((await approved.json()) as unknown[]).length).toBe(0);
    expect((await dispatch(get("/api/admin/submissions?status=bogus"), env)).status).toBe(422);
  });
});

describe("submission triage", () => {
  it("409s approve before a draft exists", async () => {
    const env = adminEnv();
    const id = await insertSubmission(V2_ORG);
    const res = await dispatch(post(`/api/admin/submissions/${id}/approve`), env);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { detail: string }).detail).toBe(
      "enrich the submission before approving",
    );
  });

  it("approves after a draft is saved and keeps the draft", async () => {
    const env = adminEnv();
    const id = await insertSubmission(V2_ORG);
    const draft = await dispatch(post(`/api/admin/submissions/${id}/draft`, VALID_DRAFT), env);
    expect(draft.status).toBe(200);
    const res = await dispatch(post(`/api/admin/submissions/${id}/approve`), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const row = await env.DB.prepare("SELECT status, draft, resolved_at FROM submissions WHERE id = ?1")
      .bind(id)
      .first<{ status: string; draft: string; resolved_at: string }>();
    expect(row!.status).toBe("approved");
    expect(JSON.parse(row!.draft).name).toBe(VALID_DRAFT.name);
    expect(row!.resolved_at).not.toBeNull();
  });

  it("approves a grandfathered row without org.v verbatim", async () => {
    const env = adminEnv();
    const id = await insertSubmission({ name: "Legacy Org", website: "https://legacy.example" });
    expect((await dispatch(post(`/api/admin/submissions/${id}/approve`), env)).status).toBe(200);
  });

  it("422s an invalid draft", async () => {
    const env = adminEnv();
    const id = await insertSubmission(V2_ORG);
    const res = await dispatch(
      post(`/api/admin/submissions/${id}/draft`, { ...VALID_DRAFT, region: "nowhere" }),
      env,
    );
    expect(res.status).toBe(422);
  });

  it("422s a draft whose logoUpload is missing from storage", async () => {
    const env = adminEnv();
    const id = await insertSubmission(V2_ORG);
    const res = await dispatch(
      post(`/api/admin/submissions/${id}/draft`, { ...VALID_DRAFT, logoUpload: `u_${"e".repeat(24)}.png` }),
      env,
    );
    expect(res.status).toBe(422);
  });

  it("404s an unknown id and 409s an already-resolved one", async () => {
    const env = adminEnv();
    expect((await dispatch(post("/api/admin/submissions/999/reject"), env)).status).toBe(404);
    const id = await insertSubmission(V2_ORG);
    expect((await dispatch(post(`/api/admin/submissions/${id}/reject`), env)).status).toBe(200);
    expect((await dispatch(post(`/api/admin/submissions/${id}/reject`), env)).status).toBe(409);
  });
});

describe("edit triage", () => {
  it("lists edits with camelCase fields", async () => {
    const env = adminEnv();
    const id = await insertEdit("wahl-chat");
    const res = await dispatch(get("/api/admin/edits"), env);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ id, orgSlug: "wahl-chat", changes: {}, status: "pending" });
  });

  it("approves without mutating org data", async () => {
    const env = adminEnv();
    const id = await insertEdit("wahl-chat");
    const res = await dispatch(post(`/api/admin/edits/${id}/approve`), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const row = await env.DB.prepare("SELECT status, changes FROM edits WHERE id = ?1")
      .bind(id)
      .first<{ status: string; changes: string }>();
    expect(row!.status).toBe("approved");
    expect(row!.changes).toBe("{}");
  });

  it("404s an unknown id and 409s an already-resolved one", async () => {
    const env = adminEnv();
    expect((await dispatch(post("/api/admin/edits/999/approve"), env)).status).toBe(404);
    const id = await insertEdit("wahl-chat");
    expect((await dispatch(post(`/api/admin/edits/${id}/reject`), env)).status).toBe(200);
    expect((await dispatch(post(`/api/admin/edits/${id}/approve`), env)).status).toBe(409);
  });
});
