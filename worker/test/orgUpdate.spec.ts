import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAX_KEY_PROJECTS } from "../src/validate";
import { adminEnv, apiRequest, dispatch, seedOrg, testEnv } from "./helpers";

const projects = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `p${i}` }));

async function detail(res: Response): Promise<string> {
  return ((await res.json()) as { detail: string }).detail;
}

const put = (p: string, body: unknown) =>
  apiRequest(p, { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("PUT /api/admin/orgs/:slug", () => {
  it("requires admin auth", async () => {
    await seedOrg({ slug: "alpha" });
    expect((await dispatch(put("/api/admin/orgs/alpha", { tagline: "x" }), testEnv())).status).toBe(401);
  });

  it("updates fields and key projects, and bumps the version", async () => {
    await seedOrg({ slug: "alpha", name: "Alpha", tagline: "old" });
    const before = (await dispatch(apiRequest("/api/orgs"), adminEnv())).headers.get("etag");
    const res = await dispatch(
      put("/api/admin/orgs/alpha", {
        tagline: "new",
        keyProjects: [{ name: "Checks", url: "https://example.org" }],
      }),
      adminEnv(),
    );
    expect(res.status).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/alpha"), adminEnv())).json()) as {
      tagline: string; keyProjects: { name: string; url: string }[];
    };
    expect(org.tagline).toBe("new");
    expect(org.keyProjects[0]!.url).toBe("https://example.org");
    const after = (await dispatch(apiRequest("/api/orgs"), adminEnv())).headers.get("etag");
    expect(after).not.toBe(before);
  });

  it("404s an unknown slug and 422s a bad payload", async () => {
    await seedOrg({ slug: "alpha" });
    expect((await dispatch(put("/api/admin/orgs/nope", { tagline: "x" }), adminEnv())).status).toBe(404);
    expect((await dispatch(put("/api/admin/orgs/alpha", { category: "not-a-category" }), adminEnv())).status).toBe(422);
    expect((await dispatch(put("/api/admin/orgs/alpha", { keyProjects: [{ name: "x", url: "javascript:alert(1)" }] }), adminEnv())).status).toBe(422);
  });

  it("rejects a non-http website and accepts an absolute one", async () => {
    await seedOrg({ slug: "alpha" });
    for (const website of ["javascript:alert(1)", "data:text/html,<script>", "example.org", ""]) {
      expect((await dispatch(put("/api/admin/orgs/alpha", { website }), adminEnv())).status).toBe(422);
    }
    expect((await dispatch(put("/api/admin/orgs/alpha", { website: "https://moved.example" }), adminEnv())).status).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/alpha"), adminEnv())).json()) as { website: string };
    expect(org.website).toBe("https://moved.example");
  });

  it(`accepts ${MAX_KEY_PROJECTS} key projects and names the limit when there are more`, async () => {
    await seedOrg({ slug: "alpha" });
    expect(
      (await dispatch(put("/api/admin/orgs/alpha", { keyProjects: projects(MAX_KEY_PROJECTS) }), adminEnv())).status,
    ).toBe(200);
    const res = await dispatch(put("/api/admin/orgs/alpha", { keyProjects: projects(MAX_KEY_PROJECTS + 1) }), adminEnv());
    expect(res.status).toBe(422);
    expect(await detail(res)).toContain(String(MAX_KEY_PROJECTS));
  });

  it("keeps the per-project note and trims the url", async () => {
    await seedOrg({ slug: "alpha" });
    const res = await dispatch(
      put("/api/admin/orgs/alpha", {
        keyProjects: [{ name: " Checks ", url: "  https://e.example  ", note: " why it matters " }],
      }),
      adminEnv(),
    );
    expect(res.status).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/alpha"), adminEnv())).json()) as {
      keyProjects: { name: string; url: string; note: string }[];
    };
    expect(org.keyProjects[0]).toEqual({ name: "Checks", url: "https://e.example", note: "why it matters" });
  });

  it("refuses to blank a required text field but still clears optional ones", async () => {
    await seedOrg({ slug: "alpha", ai_democracy_angle: "angle", location: "Berlin" });
    for (const field of ["name", "tagline", "description"]) {
      const res = await dispatch(put("/api/admin/orgs/alpha", { [field]: "   " }), adminEnv());
      expect(res.status).toBe(422);
      expect(await detail(res)).toContain(field);
    }
    expect(
      (await dispatch(put("/api/admin/orgs/alpha", { aiDemocracyAngle: "", location: "" }), adminEnv())).status,
    ).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/alpha"), adminEnv())).json()) as { name: string };
    expect(org.name).toBe("Test Org");
  });

  it("applies the draft route's limits to tags, funders and founded", async () => {
    await seedOrg({ slug: "alpha" });
    const rejected: Record<string, unknown>[] = [
      { focusTags: Array.from({ length: 7 }, (_, i) => `t${i}`) },
      { focusTags: ["x".repeat(41)] },
      { focusTags: ["  "] },
      { funders: ["x".repeat(121)] },
      { founded: 1500 },
    ];
    for (const body of rejected) {
      expect((await dispatch(put("/api/admin/orgs/alpha", body), adminEnv())).status).toBe(422);
    }
    expect(
      (await dispatch(put("/api/admin/orgs/alpha", { focusTags: [" elections "], founded: 1999 }), adminEnv())).status,
    ).toBe(200);
    const org = (await (await dispatch(apiRequest("/api/orgs/alpha"), adminEnv())).json()) as { focusTags: string[] };
    expect(org.focusTags).toEqual(["elections"]);
    // clearing a list stays legal — the dataset has an org with no focus tags
    expect(
      (await dispatch(put("/api/admin/orgs/alpha", { focusTags: [], funders: [], keyProjects: [] }), adminEnv())).status,
    ).toBe(200);
  });

  it("404s when the row disappears between the existence check and the write", async () => {
    await seedOrg({ slug: "alpha" });
    const db = new Proxy(env.DB, {
      get(target, prop, receiver) {
        if (prop !== "batch") return Reflect.get(target, prop, target);
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare("DELETE FROM organizations WHERE slug = ?1").bind("alpha").run();
          return target.batch(statements);
        };
      },
    });
    const res = await dispatch(
      put("/api/admin/orgs/alpha", { tagline: "new" }),
      testEnv({ DB: db, DEV_ALLOW_INSECURE_ADMIN: "1" }),
    );
    expect(res.status).toBe(404);
    expect(await detail(res)).toBe("organization not found");
  });
});
