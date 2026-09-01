import { screen } from "./botScreen";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { clientIp, json, type Env } from "./types";
import { uploadExists } from "./uploads";
import { validateEdit } from "./validate";

function fake201(): Response {
  return json({ id: 100 + Math.floor(Math.random() * 9900), status: "pending" }, 201);
}

export async function createEdit(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ detail: "invalid json body" }, 422);
  }
  const v = validateEdit(body);
  if (!v.ok) return json({ detail: v.detail }, 422);

  const ip = clientIp(req);
  const result = await screen(env, {
    companyUrl: v.value.companyUrl,
    formToken: v.value.formToken,
    turnstileToken: v.value.turnstileToken,
    ip,
    turnstile: true,
    action: "suggest-edit",
  });
  if (result.kind === "expired") return json({ detail: "form_token_expired" }, 422);
  if (result.kind === "drop") {
    console.log(JSON.stringify({ event: "edit_dropped", reason: result.reason }));
    return fake201();
  }

  const hash = await ipHash(env.FORM_TOKEN_SECRET, ip);
  const limited = json({ detail: "rate limit exceeded" }, 429);
  const minuteOk = await hit(env.DB, "edit", hash, LIMITS.edits.limit, LIMITS.edits.windowSeconds);
  if (!minuteOk) return limited;
  const dayOk = await hit(env.DB, "edit_d", hash, LIMITS.editsDay.limit, LIMITS.editsDay.windowSeconds);
  if (!dayOk) return limited;
  const globalOk = await hit(
    env.DB,
    "edit_g",
    "global",
    LIMITS.editsGlobal.limit,
    LIMITS.editsGlobal.windowSeconds,
  );
  if (!globalOk) return json({ detail: "too many edits today, try again tomorrow" }, 429);

  const logoUpload = v.value.changes.logoUpload;
  if (typeof logoUpload === "string" && !(await uploadExists(env, logoUpload))) {
    return json({ detail: "logoUpload does not reference an existing upload" }, 422);
  }

  const row = await env.DB.prepare(
    "INSERT INTO edits (org_slug, changes, contributor_name, contributor_email, status, created_at, ip_hash, user_agent) " +
      "VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7) RETURNING id",
  )
    .bind(
      v.value.orgSlug,
      JSON.stringify(v.value.changes),
      v.value.contributorName,
      v.value.contributorEmail,
      new Date().toISOString(),
      hash,
      req.headers.get("user-agent") ?? "",
    )
    .first<{ id: number }>();
  return json({ id: row!.id, status: "pending" }, 201);
}
