import { sendMail, type SendMail } from "./email";
import type { Env } from "./types";

const EPOCH = "1970-01-01T00:00:00.000Z";
const ADMIN_URL = "https://ai4democracy.world/admin";

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM meta WHERE key = ?1").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare("INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2")
    .bind(key, value)
    .run();
}

interface DigestSubmission {
  org: string;
  created_at: string;
}

interface DigestEdit {
  org_slug: string;
  created_at: string;
}

export function composeDigest(submissions: DigestSubmission[], edits: DigestEdit[]): string {
  const lines: string[] = [
    `${submissions.length} new submission(s), ${edits.length} new edit(s) since the last digest.`,
    "",
  ];
  if (submissions.length > 0) {
    lines.push("Submissions:");
    for (const s of submissions) {
      const org = JSON.parse(s.org) as { name?: string; urls?: string[] };
      const url = org.urls?.[0] ?? "-";
      lines.push(`- ${org.name ?? "?"} — ${url} — ${s.created_at.slice(0, 10)}`);
    }
    lines.push("");
  }
  if (edits.length > 0) {
    lines.push("Edits:");
    for (const e of edits) {
      lines.push(`- ${e.org_slug} — ${e.created_at.slice(0, 10)}`);
    }
    lines.push("");
  }
  lines.push(`Review: ${ADMIN_URL}`);
  return lines.join("\n");
}

export async function runDigest(
  env: Env,
  now: Date,
  send: SendMail = sendMail,
): Promise<{ sent: boolean; body?: string }> {
  const last = (await getMeta(env.DB, "digest_last_sent")) ?? EPOCH;
  const subs = await env.DB.prepare(
    "SELECT org, created_at FROM submissions WHERE created_at > ?1 ORDER BY created_at",
  )
    .bind(last)
    .all<DigestSubmission>();
  const edits = await env.DB.prepare(
    "SELECT org_slug, created_at FROM edits WHERE created_at > ?1 ORDER BY created_at",
  )
    .bind(last)
    .all<DigestEdit>();
  if (subs.results.length === 0 && edits.results.length === 0) return { sent: false };

  const body = composeDigest(subs.results, edits.results);
  const subject = `AI4Democracy map: ${subs.results.length} submission(s), ${edits.results.length} edit(s) pending`;
  await send(env, subject, body);
  await setMeta(env.DB, "digest_last_sent", now.toISOString());
  return { sent: true, body };
}
