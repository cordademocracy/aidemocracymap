import { screen } from "./botScreen";
import { LIMITS, hit, ipHash } from "./rateLimit";
import { clientIp, json, type Env } from "./types";
import { validateSubmission } from "./validate";

function fake201(): Response {
  return json({ id: 100 + Math.floor(Math.random() * 9900), status: "pending" }, 201);
}

export async function createSubmission(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ detail: "invalid json body" }, 422);
  }
  const v = validateSubmission(body);
  if (!v.ok) return json({ detail: v.detail }, 422);

  const ip = clientIp(req);
  const result = await screen(env, {
    companyUrl: v.value.companyUrl,
    formToken: v.value.formToken,
    turnstileToken: v.value.turnstileToken,
    ip,
    turnstile: true,
    action: "submit-org",
  });
  if (result.kind === "expired") return json({ detail: "form_token_expired" }, 422);
  if (result.kind === "drop") {
    console.log(JSON.stringify({ event: "submission_dropped", reason: result.reason }));
    return fake201();
  }

  const hash = await ipHash(env.FORM_TOKEN_SECRET, ip);
  const limited = json({ detail: "rate limit exceeded" }, 429);
  // Each counter is checked before the next is incremented, so an hourly
  // rejection does not also spend a daily slot.
  const hourOk = await hit(env.DB, "sub_h", hash, LIMITS.submissionsHour.limit, LIMITS.submissionsHour.windowSeconds);
  if (!hourOk) return limited;
  const dayOk = await hit(env.DB, "sub_d", hash, LIMITS.submissionsDay.limit, LIMITS.submissionsDay.windowSeconds);
  if (!dayOk) return limited;
  const globalOk = await hit(
    env.DB,
    "sub_g",
    "global",
    LIMITS.submissionsGlobal.limit,
    LIMITS.submissionsGlobal.windowSeconds,
  );
  if (!globalOk) return json({ detail: "too many submissions today, try again tomorrow" }, 429);

  const org = JSON.stringify({
    v: 2,
    name: v.value.name,
    email: v.value.email,
    urls: v.value.urls,
    note: v.value.note,
  });
  const row = await env.DB.prepare(
    "INSERT INTO submissions (org, contributor_email, status, created_at, ip_hash, user_agent) " +
      "VALUES (?1, ?2, 'pending', ?3, ?4, ?5) RETURNING id",
  )
    .bind(org, v.value.email, new Date().toISOString(), hash, req.headers.get("user-agent") ?? "")
    .first<{ id: number }>();
  return json({ id: row!.id, status: "pending" }, 201);
}
