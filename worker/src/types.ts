export interface Env {
  DB: D1Database;
  UPLOADS: KVNamespace;
  DIGEST_EMAIL: SendEmail;
  FORM_TOKEN_SECRET: string;
  TURNSTILE_SECRET?: string;
  /** Comma-separated hostnames siteverify results must match; empty disables the check. */
  TURNSTILE_HOSTNAMES?: string;
  DIGEST_FROM: string;
  DIGEST_TO: string;
  /** Public origin, used to build admin login links. */
  SITE_ORIGIN: string;
  /** Optional recovery credential for the X-Admin-Token header if email is down. */
  ADMIN_BREAKGLASS?: string;
  DEV_ALLOW_INSECURE_ADMIN?: string;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? "127.0.0.1";
}

export function randHex(chars: number): string {
  const bytes = new Uint8Array(chars / 2);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
