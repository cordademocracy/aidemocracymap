import { sendMail, type SendMail } from "./email";
import { hit, ipHash } from "./rateLimit";
import { clientIp, json, randHex, type Env } from "./types";

/** Admin sessions: a one-time link mailed to DIGEST_TO, exchanged for a signed
 * cookie. The send_email binding can only reach verified destination addresses,
 * so possession of the inbox is the whole identity check. */

const SESSION_COOKIE = "admin_session";
const SESSION_DAYS = 30;
const LINK_TTL_MINUTES = 15;

const enc = new TextEncoder();

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function sign(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function sessionValid(secret: string, cookie: string): Promise<boolean> {
  const [expires, sig] = cookie.split(".");
  if (!expires || !sig) return false;
  if (!Number.isFinite(Number(expires)) || Number(expires) * 1000 < Date.now()) return false;
  return timingSafeEqual(sig, await sign(secret, `session:${expires}`));
}

export async function requireAdmin(req: Request, env: Env): Promise<Response | null> {
  if (env.DEV_ALLOW_INSECURE_ADMIN === "1") return null;
  const unauthorized = json({ detail: "unauthorized" }, 401);

  const breakGlass = req.headers.get("X-Admin-Token");
  if (breakGlass && env.ADMIN_BREAKGLASS && timingSafeEqual(breakGlass, env.ADMIN_BREAKGLASS)) {
    return null;
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  if (!cookie || !(await sessionValid(env.FORM_TOKEN_SECRET, cookie))) return unauthorized;
  return null;
}

/** POST /api/admin/login — mails a one-time link. A rate-limited caller still
 * gets 202, so flooding this route reveals nothing; a failed send returns 500
 * rather than letting the UI claim mail is on its way. */
export async function requestLoginLink(
  req: Request,
  env: Env,
  send: SendMail = sendMail,
): Promise<Response> {
  const accepted = json({ ok: true }, 202);
  const hash = await ipHash(env.FORM_TOKEN_SECRET, clientIp(req));
  if (!(await hit(env.DB, "login", hash, 5, 3600))) return accepted;

  const token = randHex(64);
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000).toISOString();
  await env.DB.prepare("INSERT INTO admin_logins (token_hash, expires_at) VALUES (?, ?)")
    .bind(await sha256Hex(token), expiresAt)
    .run();

  const link = `${env.SITE_ORIGIN}/api/admin/session?t=${token}`;
  const text = [
    `Sign in to the admin inbox (valid ${LINK_TTL_MINUTES} minutes, single use):`,
    "",
    link,
    "",
    "Not you? Ignore this — the link is useless without this inbox.",
  ].join("\n");
  try {
    await send(env, "Admin login link", text);
  } catch (err) {
    console.log(JSON.stringify({ event: "login_email_failed", error: String(err) }));
    return json({ detail: "login_email_failed" }, 500);
  }
  return accepted;
}

/** GET /api/admin/session?t= — burns the token, sets the session cookie. */
export async function consumeLoginLink(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get("t") ?? "";
  const row = token
    ? await env.DB.prepare("DELETE FROM admin_logins WHERE token_hash = ? RETURNING expires_at")
        .bind(await sha256Hex(token))
        .first<{ expires_at: string }>()
    : null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return new Response("This login link is expired or already used.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const value = `${expires}.${await sign(env.FORM_TOKEN_SECRET, `session:${expires}`)}`;
  return new Response(null, {
    status: 302,
    headers: {
      location: "/admin",
      "set-cookie": `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${
        SESSION_DAYS * 86400
      }`,
    },
  });
}
