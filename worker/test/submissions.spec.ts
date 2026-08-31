import { describe, expect, it } from "vitest";
import { LIMITS, ipHash } from "../src/rateLimit";
import {
  apiRequest,
  counterCount,
  countRows,
  dispatch,
  makeToken,
  mockTurnstile,
  seedCounter,
  submissionBody,
  testEnv,
} from "./helpers";

function post(body: string, ip = "203.0.113.7"): Request {
  return apiRequest("/api/submissions", { method: "POST", body }, ip);
}

describe("POST /api/submissions", () => {
  it("stores a valid submission and returns 201", async () => {
    const res = await dispatch(post(await submissionBody()));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: number; status: string };
    expect(data.status).toBe("pending");
    expect(await countRows("submissions")).toBe(1);
  });

  it("fake-201s the honeypot and stores nothing", async () => {
    const res = await dispatch(post(await submissionBody({ companyUrl: "https://spam.example" })));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("pending");
    expect(await countRows("submissions")).toBe(0);
  });

  it("fake-201s a too-fast token and stores nothing", async () => {
    const res = await dispatch(post(await submissionBody({ formToken: await makeToken(1) })));
    expect(res.status).toBe(201);
    expect(await countRows("submissions")).toBe(0);
  });

  it("returns a real 422 for an expired token", async () => {
    const res = await dispatch(post(await submissionBody({ formToken: await makeToken(86401) })));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { detail: string }).detail).toBe("form_token_expired");
    expect(await countRows("submissions")).toBe(0);
  });

  it("422s invalid payloads", async () => {
    const res = await dispatch(post(await submissionBody({ urls: [] })));
    expect(res.status).toBe(422);
  });

  it("fake-201s when Turnstile verification fails", async () => {
    mockTurnstile(false);
    const env = testEnv({ TURNSTILE_SECRET: "ts-secret" });
    const res = await dispatch(post(await submissionBody({ turnstileToken: "bad" })), env);
    expect(res.status).toBe(201);
    expect(await countRows("submissions")).toBe(0);
  });

  it("accepts when Turnstile verification succeeds", async () => {
    mockTurnstile(true);
    const env = testEnv({ TURNSTILE_SECRET: "ts-secret" });
    const res = await dispatch(post(await submissionBody({ turnstileToken: "good" })), env);
    expect(res.status).toBe(201);
    expect(await countRows("submissions")).toBe(1);
  });

  it("fake-201s when the token was minted for another form's action", async () => {
    mockTurnstile(true, { action: "suggest-edit" });
    const env = testEnv({ TURNSTILE_SECRET: "ts-secret" });
    const res = await dispatch(post(await submissionBody({ turnstileToken: "good" })), env);
    expect(res.status).toBe(201);
    expect(await countRows("submissions")).toBe(0);
  });

  it("fake-201s when the solving hostname is not allow-listed", async () => {
    mockTurnstile(true, { hostname: "phisher.example" });
    const env = testEnv({
      TURNSTILE_SECRET: "ts-secret",
      TURNSTILE_HOSTNAMES: "ai4democracy.world",
    });
    const res = await dispatch(post(await submissionBody({ turnstileToken: "good" })), env);
    expect(res.status).toBe(201);
    expect(await countRows("submissions")).toBe(0);
  });

  it("429s the 4th submission per IP within an hour", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await dispatch(post(await submissionBody()))).status).toBe(201);
    }
    const res = await dispatch(post(await submissionBody()));
    expect(res.status).toBe(429);
    expect(await countRows("submissions")).toBe(3);
  });

  it("does not let bot drops consume the rate limit", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await dispatch(post(await submissionBody({ companyUrl: "spam" })));
      expect(res.status).toBe(201);
    }
    expect((await dispatch(post(await submissionBody()))).status).toBe(201);
    expect(await countRows("submissions")).toBe(1);
  });

  it("keeps separate per-IP budgets", async () => {
    for (let i = 0; i < 3; i++) {
      await dispatch(post(await submissionBody(), "203.0.113.7"));
    }
    expect((await dispatch(post(await submissionBody(), "203.0.113.7"))).status).toBe(429);
    expect((await dispatch(post(await submissionBody(), "198.51.100.9"))).status).toBe(201);
  });

  it("429s once the 100/day global backstop is spent", async () => {
    await seedCounter("sub_g", "global", 86400, 100);
    const res = await dispatch(post(await submissionBody(), "198.51.100.20"));
    expect(res.status).toBe(429);
    expect(await countRows("submissions")).toBe(0);
  });

  it("never lets a bot drop touch the global backstop", async () => {
    await dispatch(post(await submissionBody({ companyUrl: "spam" })));
    await dispatch(post(await submissionBody({ formToken: await makeToken(1) })));
    expect(await counterCount("sub_g", "global", 86400)).toBe(0);
    expect((await dispatch(post(await submissionBody()))).status).toBe(201);
    expect(await counterCount("sub_g", "global", 86400)).toBe(1);
  });
});

describe("rate-limit accounting", () => {
  it("does not spend a daily slot when the hourly limit already rejected", async () => {
    const env = testEnv();
    const hash = await ipHash(env.FORM_TOKEN_SECRET, "203.0.113.7");
    await seedCounter("sub_h", hash, 3600, LIMITS.submissionsHour.limit);

    expect((await dispatch(post(await submissionBody()), env)).status).toBe(429);
    expect(await counterCount("sub_d", hash, 86400)).toBe(0);
    expect(await counterCount("sub_g", "global", 86400)).toBe(0);
  });
});
