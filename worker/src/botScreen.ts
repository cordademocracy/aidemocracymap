import { tokenReason } from "./formToken";
import type { Env } from "./types";

export type ScreenResult =
  | { kind: "pass" }
  | { kind: "drop"; reason: string }
  | { kind: "expired" };

interface ScreenInput {
  companyUrl?: string | null;
  formToken?: string | null;
  turnstileToken?: string | null;
  ip: string;
  turnstile: boolean;
  /** Expected Turnstile action, as rendered by the widget on that form. */
  action: string;
}

const MAX_TOKEN_LEN = 2048;
const SITEVERIFY_TIMEOUT_MS = 10_000;

interface SiteverifyResult {
  success?: boolean;
  action?: string;
  hostname?: string;
}

async function verifyTurnstile(env: Env, input: ScreenInput): Promise<boolean> {
  const token = input.turnstileToken ?? "";
  if (!token || token.length > MAX_TOKEN_LEN) return false;
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET ?? "",
    response: token,
    remoteip: input.ip,
  });
  let data: SiteverifyResult;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    data = (await res.json()) as SiteverifyResult;
  } catch {
    return false;
  }
  if (data.success !== true || data.action !== input.action) return false;
  const allowed = (env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(data.hostname ?? "");
}

export async function screen(env: Env, input: ScreenInput): Promise<ScreenResult> {
  if (input.companyUrl) return { kind: "drop", reason: "honeypot" };
  if (input.turnstile && env.TURNSTILE_SECRET) {
    if (!(await verifyTurnstile(env, input))) return { kind: "drop", reason: "turnstile" };
  }
  const reason = await tokenReason(env.FORM_TOKEN_SECRET, input.formToken ?? undefined);
  if (reason === "token_expired") return { kind: "expired" };
  if (reason !== null) return { kind: "drop", reason };
  return { kind: "pass" };
}
