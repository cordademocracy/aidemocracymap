import { describe, expect, it } from "vitest";
import { tokenReason } from "../src/formToken";
import { ipHash } from "../src/rateLimit";
import { apiRequest, dispatch, seedCounter, testEnv } from "./helpers";

describe("GET /api/health", () => {
  it("reports ok and a null digest timestamp before the first send", async () => {
    const res = await dispatch(apiRequest("/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, digestLastSent: null });
  });

  it("surfaces digest_last_sent once set", async () => {
    const env = testEnv();
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('digest_last_sent', ?1)")
      .bind("2026-08-29T08:00:00.000Z")
      .run();
    const res = await dispatch(apiRequest("/api/health"), env);
    expect(await res.json()).toEqual({ ok: true, digestLastSent: "2026-08-29T08:00:00.000Z" });
  });
});

describe("GET /api/form-token", () => {
  it("issues a token that verifies as too_fast immediately", async () => {
    const env = testEnv();
    const res = await dispatch(apiRequest("/api/form-token"), env);
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(await tokenReason(env.FORM_TOKEN_SECRET, token)).toBe("too_fast");
  });

  it("429s past 120 issues per minute per IP", async () => {
    const env = testEnv();
    await seedCounter("tok", await ipHash(env.FORM_TOKEN_SECRET, "203.0.113.7"), 60, 120);
    expect((await dispatch(apiRequest("/api/form-token"), env)).status).toBe(429);
  });
});

describe("CORS for the two-server dev setup", () => {
  const devOrigin = { Origin: "http://localhost:5199" };

  it("answers a preflight with 204 and the echoed origin", async () => {
    const res = await dispatch(
      apiRequest("/api/submissions", { method: "OPTIONS", headers: devOrigin }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5199");
    expect(res.headers.get("access-control-allow-headers")).toContain("content-type");
  });

  it("allows the origin on an actual response", async () => {
    const res = await dispatch(apiRequest("/api/form-token", { headers: devOrigin }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5199");
    expect((await res.json()) as { token: string }).toHaveProperty("token");
  });

  it("sends no allow-origin to a non-localhost origin", async () => {
    const res = await dispatch(
      apiRequest("/api/health", { headers: { Origin: "https://evil.example" } }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("never allows credentials, so an Access cookie cannot ride along", async () => {
    const res = await dispatch(apiRequest("/api/health", { headers: devOrigin }));
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("unknown routes", () => {
  it("404s a path with no matching handler", async () => {
    expect((await dispatch(apiRequest("/api/nope"))).status).toBe(404);
  });
});
