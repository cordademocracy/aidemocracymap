export const MIN_FILL_SECONDS = 3;
export const MAX_AGE_SECONDS = 86400;

export type TokenReason = "token_invalid" | "token_expired" | "too_fast";

const enc = new TextEncoder();

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function issueToken(secret: string, nowMs = Date.now()): Promise<string> {
  const tsPart = toB64url(enc.encode(String(Math.floor(nowMs / 1000))));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(tsPart));
  return `${tsPart}.${toB64url(new Uint8Array(sig))}`;
}

export async function tokenReason(
  secret: string,
  token: string | undefined,
  nowMs = Date.now(),
): Promise<TokenReason | null> {
  if (!token) return "token_invalid";
  const parts = token.split(".");
  if (parts.length !== 2) return "token_invalid";
  const [tsPart, sigPart] = parts as [string, string];
  let sig: Uint8Array;
  let tsRaw: string;
  try {
    sig = fromB64url(sigPart);
    tsRaw = new TextDecoder().decode(fromB64url(tsPart));
  } catch {
    return "token_invalid";
  }
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(tsPart));
  if (!ok) return "token_invalid";
  const issued = Number(tsRaw);
  if (!Number.isFinite(issued)) return "token_invalid";
  const age = nowMs / 1000 - issued;
  if (age > MAX_AGE_SECONDS) return "token_expired";
  if (age < MIN_FILL_SECONDS) return "too_fast";
  return null;
}
