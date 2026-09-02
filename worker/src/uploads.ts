import { requireAdmin } from "./adminAuth";
import { screen } from "./botScreen";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { clientIp, json, randHex, type Env } from "./types";
import { UPLOAD_NAME_RE } from "./validate";

const MAX_BYTES = 1_048_576;

const MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function sniffImage(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

function fake201(): Response {
  const id = `u_${randHex(24)}.png`;
  return json({ id, url: `/api/uploads/${id}` }, 201);
}

export async function createUpload(req: Request, env: Env): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ detail: "multipart form data required" }, 422);
  }
  const formToken = form.get("formToken");
  const companyUrl = form.get("companyUrl");
  const ip = clientIp(req);

  const result = await screen(env, {
    companyUrl: typeof companyUrl === "string" ? companyUrl : "",
    formToken: typeof formToken === "string" ? formToken : "",
    ip,
    turnstile: false,
    action: "upload",
  });
  if (result.kind !== "pass") {
    console.log(JSON.stringify({ event: "upload_dropped", reason: result.kind === "drop" ? result.reason : "token_expired" }));
    return fake201();
  }

  const hash = await ipHash(env.FORM_TOKEN_SECRET, ip);
  const ok = await hit(env.DB, "upl", hash, LIMITS.uploads.limit, LIMITS.uploads.windowSeconds);
  if (!ok) return json({ detail: "rate limit exceeded" }, 429);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ detail: "file field required" }, 422);
  if (file.size > MAX_BYTES) return json({ detail: "file exceeds 1 MB" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (ext === null) return json({ detail: "unsupported image type" }, 415);

  const name = `u_${randHex(24)}.${ext}`;
  await env.UPLOADS.put(name, bytes, { metadata: { contentType: MIME[ext] } });
  return json({ id: name, url: `/api/uploads/${name}` }, 201);
}

/** KV has no head(); a prefix list checks existence without fetching bytes. */
export async function uploadExists(env: Env, name: string): Promise<boolean> {
  const listed = await env.UPLOADS.list({ prefix: name, limit: 1 });
  return listed.keys.some((k) => k.name === name);
}

export async function serveUpload(req: Request, env: Env, name: string): Promise<Response> {
  if (!UPLOAD_NAME_RE.test(name)) {
    const denied = await requireAdmin(req, env);
    return denied ?? json({ detail: "not found" }, 404);
  }
  // An upload becomes public only once an org's logo_url references it; until
  // then only an admin can see it, so anonymous uploads are not a file host.
  const referenced = await env.DB.prepare("SELECT 1 FROM organizations WHERE logo_url = ?1")
    .bind(`/api/uploads/${name}`)
    .first();
  const isPublic = referenced !== null;
  if (!isPublic) {
    const denied = await requireAdmin(req, env);
    if (denied) return denied;
  }
  const { value, metadata } = await env.UPLOADS.getWithMetadata<{ contentType?: string }>(
    name,
    "arrayBuffer",
  );
  if (value === null) return json({ detail: "not found" }, 404);
  const ext = name.slice(name.lastIndexOf(".") + 1);
  return new Response(value, {
    status: 200,
    headers: {
      "content-type": metadata?.contentType ?? MIME[ext] ?? "application/octet-stream",
      "content-disposition": isPublic ? "inline" : `attachment; filename="${name}"`,
      "x-content-type-options": "nosniff",
      "cache-control": isPublic ? "public, max-age=86400, stale-while-revalidate=604800" : "private, max-age=0",
    },
  });
}
