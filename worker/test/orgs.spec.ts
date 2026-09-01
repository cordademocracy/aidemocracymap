import { describe, expect, it } from "vitest";
import { apiRequest, dispatch, seedOrg } from "./helpers";

const get = (p: string, init: RequestInit = {}) => apiRequest(p, { method: "GET", ...init });

describe("GET /api/orgs", () => {
  it("returns summaries and a weak ETag, and 304s on a matching If-None-Match", async () => {
    await seedOrg({ slug: "alpha", name: "Alpha" });
    const res = await dispatch(get("/api/orgs"));
    expect(res.status).toBe(200);
    const etag = res.headers.get("etag")!;
    expect(etag).toMatch(/^W\//);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body[0]!.slug).toBe("alpha");
    expect(body[0]).not.toHaveProperty("description");

    const again = await dispatch(get("/api/orgs", { headers: { "If-None-Match": etag } }));
    expect(again.status).toBe(304);
  });

  it("returns the full record for a slug and 404s otherwise", async () => {
    await seedOrg({ slug: "beta", name: "Beta", description: "full text" });
    const ok = await dispatch(get("/api/orgs/beta"));
    expect(((await ok.json()) as { description: string }).description).toBe("full text");
    expect((await dispatch(get("/api/orgs/nope"))).status).toBe(404);
  });
});

describe("GET /api/export", () => {
  it("exports every org sorted by slug with canonical key order", async () => {
    await seedOrg({ slug: "zeta", name: "Zeta" });
    await seedOrg({ slug: "alpha", name: "Alpha" });
    const body = (await (await dispatch(get("/api/export"))).json()) as Record<string, unknown>[];
    expect(body.map((o) => o.slug)).toEqual(["alpha", "zeta"]);
    expect(Object.keys(body[0]!)[0]).toBe("slug");
  });
});
