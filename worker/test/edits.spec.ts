import { describe, expect, it } from "vitest";
import { APPLIED_EDIT_KEYS } from "../src/admin";
import { LIMITS, ipHash } from "../src/rateLimit";
import { ACCEPTED_EDIT_KEYS } from "../src/validate";
import {
  adminEnv,
  apiRequest,
  countRows,
  dispatch,
  editBody,
  insertEdit,
  makeToken,
  mockTurnstile,
  seedCounter,
  seedOrg,
  testEnv,
} from "./helpers";

function post(body: string, ip = "203.0.113.7"): Request {
  return apiRequest("/api/edits", { method: "POST", body }, ip);
}

describe("POST /api/edits", () => {
  it("stores a valid edit and returns 201", async () => {
    const res = await dispatch(post(await editBody()));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("pending");
    expect(await countRows("edits")).toBe(1);
  });

  it("soft-accepts an unknown slug", async () => {
    const res = await dispatch(post(await editBody({ orgSlug: "not-on-the-map" })));
    expect(res.status).toBe(201);
    expect(await countRows("edits")).toBe(1);
  });

  it("fake-201s the honeypot and stores nothing", async () => {
    const res = await dispatch(post(await editBody({ companyUrl: "https://spam.example" })));
    expect(res.status).toBe(201);
    expect(await countRows("edits")).toBe(0);
  });

  it("fake-201s a too-fast token and stores nothing", async () => {
    const res = await dispatch(post(await editBody({ formToken: await makeToken(1) })));
    expect(res.status).toBe(201);
    expect(await countRows("edits")).toBe(0);
  });

  it("returns a real 422 for an expired token", async () => {
    const res = await dispatch(post(await editBody({ formToken: await makeToken(86401) })));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { detail: string }).detail).toBe("form_token_expired");
    expect(await countRows("edits")).toBe(0);
  });

  it("fake-201s when Turnstile verification fails", async () => {
    mockTurnstile(false);
    const res = await dispatch(post(await editBody()), testEnv({ TURNSTILE_SECRET: "ts-secret" }));
    expect(res.status).toBe(201);
    expect(await countRows("edits")).toBe(0);
  });

  it("422s an empty changes object", async () => {
    expect((await dispatch(post(await editBody({ changes: {} })))).status).toBe(422);
  });

  it("422s an unknown changes field", async () => {
    const res = await dispatch(post(await editBody({ changes: { slug: "renamed" } })));
    expect(res.status).toBe(422);
  });

  it("422s an over-long tagline", async () => {
    const res = await dispatch(post(await editBody({ changes: { tagline: "x".repeat(201) } })));
    expect(res.status).toBe(422);
  });

  it("422s a logoUpload that does not exist in storage", async () => {
    const res = await dispatch(
      post(await editBody({ changes: { logoUpload: `u_${"a".repeat(24)}.png` } })),
    );
    expect(res.status).toBe(422);
    expect(await countRows("edits")).toBe(0);
  });

  it("accepts a logoUpload that exists in storage", async () => {
    const env = testEnv();
    const name = `u_${"b".repeat(24)}.png`;
    await env.UPLOADS.put(name, new Uint8Array([1, 2, 3]));
    const res = await dispatch(post(await editBody({ changes: { logoUpload: name } })), env);
    expect(res.status).toBe(201);
    expect(await countRows("edits")).toBe(1);
  });

  it("429s the 6th edit per IP within a minute", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await dispatch(post(await editBody()))).status).toBe(201);
    }
    expect((await dispatch(post(await editBody()))).status).toBe(429);
    expect(await countRows("edits")).toBe(5);
  });

  it("does not let bot drops consume the rate limit", async () => {
    for (let i = 0; i < 8; i++) {
      await dispatch(post(await editBody({ companyUrl: "spam" })));
    }
    expect((await dispatch(post(await editBody()))).status).toBe(201);
  });

  it("accepts key projects and a note on an edit suggestion", async () => {
    const body = await editBody({
      changes: { keyProjects: [{ name: "Checks", url: "https://example.org" }], note: "second link" },
    });
    const res = await dispatch(apiRequest("/api/edits", { method: "POST", body }));
    expect(res.status).toBe(201);
  });

  it("carries the per-project note into the admin queue so the diff can show it", async () => {
    const env = adminEnv();
    await seedOrg({ slug: "wahl-chat" });
    const body = await editBody({
      changes: { keyProjects: [{ name: "Checks", url: "https://example.org", note: "why it matters" }] },
    });
    expect((await dispatch(post(body))).status).toBe(201);
    const rows = (await (await dispatch(apiRequest("/api/admin/edits"), env)).json()) as {
      changes: { keyProjects: { note?: string }[] };
    }[];
    expect(rows[0]!.changes.keyProjects[0]!.note).toBe("why it matters");
  });

  it("rejects a non-https key project url", async () => {
    const body = await editBody({ changes: { keyProjects: [{ name: "x", url: "http://example.org" }] } });
    expect((await dispatch(apiRequest("/api/edits", { method: "POST", body }))).status).toBe(422);
  });

  it("applies approved key projects to the org row but never the note", async () => {
    const env = adminEnv();
    await seedOrg({ slug: "gamma" });
    const id = await insertEdit("gamma");
    await env.DB.prepare("UPDATE edits SET changes = ?1 WHERE id = ?2")
      .bind(JSON.stringify({ keyProjects: [{ name: "Checks", url: "https://example.org" }], note: "hi" }), id)
      .run();
    expect(
      (await dispatch(apiRequest(`/api/admin/edits/${id}/approve`, { method: "POST" }), env)).status,
    ).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/gamma"), env)).json()) as {
      keyProjects: { name: string }[];
      description: string;
    };
    expect(org.keyProjects[0]!.name).toBe("Checks");
    expect(org.description).not.toContain("hi");
  });
});

describe("edit field-set consistency", () => {
  it("every accepted edit key is either applied or explicitly curator-only", () => {
    const CURATOR_ONLY = new Set(["note"]);
    for (const key of ACCEPTED_EDIT_KEYS) {
      if (CURATOR_ONLY.has(key)) continue;
      expect(APPLIED_EDIT_KEYS.has(key), `${key} is accepted but never applied`).toBe(true);
    }
  });
});

describe("edit ceilings", () => {
  it("429s once the daily per-IP cap is spent", async () => {
    const env = testEnv();
    const hash = await ipHash(env.FORM_TOKEN_SECRET, "203.0.113.7");
    await seedCounter("edit_d", hash, 86400, LIMITS.editsDay.limit);
    expect((await dispatch(post(await editBody()), env)).status).toBe(429);
    expect(await countRows("edits")).toBe(0);
  });

  it("429s once the global daily backstop is spent", async () => {
    await seedCounter("edit_g", "global", 86400, LIMITS.editsGlobal.limit);
    const res = await dispatch(post(await editBody(), "198.51.100.30"));
    expect(res.status).toBe(429);
    expect(await countRows("edits")).toBe(0);
  });
});
