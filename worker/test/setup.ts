import { env, reset } from "cloudflare:test";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(async () => {
  vi.stubGlobal("fetch", () => {
    throw new Error("outbound fetch is not allowed in tests; stub it explicitly");
  });
  await reset();
  const statements = env.SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
});

afterEach(() => vi.unstubAllGlobals());
