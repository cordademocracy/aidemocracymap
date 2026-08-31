import { env } from "cloudflare:test";
import { vi } from "vitest";
import { issueToken } from "../src/formToken";
import type { Env } from "../src/types";
import worker from "../src/index";

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com/";

interface TurnstileReply {
  action?: string;
  hostname?: string;
}

export function mockTurnstile(success: boolean, reply: TurnstileReply = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(TURNSTILE_ORIGIN)) throw new Error(`unexpected outbound fetch: ${url}`);
      return Response.json({
        success,
        action: reply.action ?? "submit-org",
        hostname: reply.hostname ?? "ai4democracy.world",
      });
    }),
  );
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...(env as unknown as Env), ...overrides };
}

export function makeToken(ageSeconds = 10): Promise<string> {
  return issueToken(env.FORM_TOKEN_SECRET, Date.now() - ageSeconds * 1000);
}

export function apiRequest(path: string, init: RequestInit = {}, ip = "203.0.113.7"): Request {
  const headers = new Headers(init.headers);
  headers.set("CF-Connecting-IP", ip);
  if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  return new Request(`https://example.com${path}`, { ...init, headers });
}

export function dispatch(req: Request, envArg: Env = testEnv()): Promise<Response> {
  return worker.fetch(req, envArg);
}

export async function submissionBody(overrides: Record<string, unknown> = {}): Promise<string> {
  return JSON.stringify({
    name: "Test Org",
    email: "tester@example.org",
    urls: ["https://example.org"],
    note: "why it belongs",
    companyUrl: "",
    formToken: await makeToken(),
    turnstileToken: "",
    ...overrides,
  });
}

export async function editBody(overrides: Record<string, unknown> = {}): Promise<string> {
  return JSON.stringify({
    orgSlug: "wahl-chat",
    changes: { tagline: "sharper tagline" },
    companyUrl: "",
    formToken: await makeToken(),
    turnstileToken: "",
    ...overrides,
  });
}

export async function countRows(table: "submissions" | "edits"): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

export function adminEnv(): Env {
  return testEnv({ DEV_ALLOW_INSECURE_ADMIN: "1" });
}

export async function seedCounter(
  scope: string,
  id: string,
  windowSeconds: number,
  count: number,
): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  await env.DB.prepare("INSERT INTO rate_counters (key, window_start, count) VALUES (?1, ?2, ?3)")
    .bind(`${scope}:${id}:${windowStart}`, windowStart, count)
    .run();
}

export async function counterCount(scope: string, id: string, windowSeconds: number): Promise<number> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const row = await env.DB.prepare("SELECT count FROM rate_counters WHERE key = ?1")
    .bind(`${scope}:${id}:${windowStart}`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function insertSubmission(
  org: Record<string, unknown>,
  createdAt = new Date().toISOString(),
): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO submissions (org, status, created_at, ip_hash) VALUES (?1, 'pending', ?2, 'h') RETURNING id",
  )
    .bind(JSON.stringify(org), createdAt)
    .first<{ id: number }>();
  return row!.id;
}

export async function insertEdit(
  orgSlug: string,
  createdAt = new Date().toISOString(),
): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO edits (org_slug, changes, status, created_at, ip_hash) VALUES (?1, '{}', 'pending', ?2, 'h') RETURNING id",
  )
    .bind(orgSlug, createdAt)
    .first<{ id: number }>();
  return row!.id;
}

export const VALID_DRAFT = {
  name: "Wahl Chat",
  website: "https://wahl.chat",
  tagline: "Election chatbot",
  description: "A chatbot answering election questions from party manifestos.",
  category: "tools",
  region: "voting-village",
  focusTags: ["elections"],
  depthRing: "core",
  funders: [],
  keyProjects: [],
} as const;

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

export function pngFile(size = PNG_BYTES.length): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_BYTES.subarray(0, Math.min(size, PNG_BYTES.length)));
  return new File([bytes], "logo.png", { type: "image/png" });
}

export async function uploadRequest(file: File | null, ageSeconds = 10, ip = "203.0.113.7"): Promise<Request> {
  const form = new FormData();
  form.set("formToken", await makeToken(ageSeconds));
  if (file) form.set("file", file);
  const headers = new Headers({ "CF-Connecting-IP": ip });
  return new Request("https://example.com/api/uploads", { method: "POST", body: form, headers });
}
