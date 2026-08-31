import { describe, expect, it } from "vitest";
import { LIMITS, ipHash } from "../src/rateLimit";
import {
  apiRequest,
  countRows,
  dispatch,
  editBody,
  makeToken,
  mockTurnstile,
  seedCounter,
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
