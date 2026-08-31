const enc = new TextEncoder();

export const LIMITS = {
  submissionsHour: { limit: 3, windowSeconds: 3600 },
  submissionsDay: { limit: 10, windowSeconds: 86400 },
  submissionsGlobal: { limit: 100, windowSeconds: 86400 },
  edits: { limit: 5, windowSeconds: 60 },
  editsDay: { limit: 30, windowSeconds: 86400 },
  editsGlobal: { limit: 300, windowSeconds: 86400 },
  uploads: { limit: 3, windowSeconds: 60 },
  admin: { limit: 30, windowSeconds: 60 },
  token: { limit: 120, windowSeconds: 60 },
} as const;

const RETENTION_MS = 2 * 86400 * 1000;

export async function ipHash(secret: string, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hit(
  db: D1Database,
  scope: string,
  id: string,
  limit: number,
  windowSeconds: number,
  nowMs = Date.now(),
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs).toISOString();
  const key = `${scope}:${id}:${windowStart}`;
  const row = await db
    .prepare(
      "INSERT INTO rate_counters (key, window_start, count) VALUES (?1, ?2, 1) " +
        "ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;
  if (count === 1) {
    await db
      .prepare("DELETE FROM rate_counters WHERE window_start < ?1")
      .bind(new Date(nowMs - RETENTION_MS).toISOString())
      .run();
  }
  return count <= limit;
}
