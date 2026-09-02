import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { UPLOAD_NAME_RE } from "../src/validate";
import { adminEnv, apiRequest, dispatch, pngFile, seedOrg, testEnv, uploadRequest } from "./helpers";

async function uploadedKeys(): Promise<string[]> {
  const listed = await env.UPLOADS.list();
  return listed.keys.map((k) => k.name);
}

describe("POST /api/uploads", () => {
  it("stores a PNG and returns its id", async () => {
    const res = await dispatch(await uploadRequest(pngFile()));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string; url: string };
    expect(data.id).toMatch(UPLOAD_NAME_RE);
    expect(data.url).toBe(`/api/uploads/${data.id}`);
    expect(await uploadedKeys()).toEqual([data.id]);
  });

  it("415s a file that is not a supported image", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "doc.pdf");
    const res = await dispatch(await uploadRequest(file));
    expect(res.status).toBe(415);
    expect(await uploadedKeys()).toEqual([]);
  });

  it("413s a file larger than 1 MB", async () => {
    const res = await dispatch(await uploadRequest(pngFile(1_048_577)));
    expect(res.status).toBe(413);
    expect(await uploadedKeys()).toEqual([]);
  });

  it("422s a request with no file field", async () => {
    expect((await dispatch(await uploadRequest(null))).status).toBe(422);
  });

  it("fake-201s a too-fast token with a phantom id and stores nothing", async () => {
    const res = await dispatch(await uploadRequest(pngFile(), 1));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(UPLOAD_NAME_RE);
    expect(await uploadedKeys()).toEqual([]);
  });

  it("fake-201s an expired token instead of 422ing", async () => {
    const res = await dispatch(await uploadRequest(pngFile(), 86401));
    expect(res.status).toBe(201);
    expect(await uploadedKeys()).toEqual([]);
  });

  it("429s the 4th upload per IP within a minute", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await dispatch(await uploadRequest(pngFile()))).status).toBe(201);
    }
    expect((await dispatch(await uploadRequest(pngFile()))).status).toBe(429);
    expect((await uploadedKeys()).length).toBe(3);
  });
});

describe("GET /api/uploads/{name}", () => {
  it("401s without an Access assertion", async () => {
    const res = await dispatch(apiRequest(`/api/uploads/u_${"c".repeat(24)}.png`), testEnv());
    expect(res.status).toBe(401);
  });

  it("serves the stored bytes as an attachment for an admin", async () => {
    const created = await dispatch(await uploadRequest(pngFile()));
    const { id } = (await created.json()) as { id: string };
    const res = await dispatch(apiRequest(`/api/uploads/${id}`), adminEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });

  it("serves an org-referenced upload publicly, inline and cacheable", async () => {
    const created = await dispatch(await uploadRequest(pngFile()));
    const { id } = (await created.json()) as { id: string };
    await seedOrg({ slug: "logo-org", logo_url: `/api/uploads/${id}` });
    const res = await dispatch(apiRequest(`/api/uploads/${id}`), testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("keeps an unreferenced upload admin-only", async () => {
    const created = await dispatch(await uploadRequest(pngFile()));
    const { id } = (await created.json()) as { id: string };
    expect((await dispatch(apiRequest(`/api/uploads/${id}`), testEnv())).status).toBe(401);
  });

  it("404s a phantom id and a malformed name for an admin", async () => {
    const admin = adminEnv();
    expect((await dispatch(apiRequest(`/api/uploads/u_${"d".repeat(24)}.png`), admin)).status).toBe(404);
    expect((await dispatch(apiRequest("/api/uploads/not-an-upload.png"), admin)).status).toBe(404);
  });
});
