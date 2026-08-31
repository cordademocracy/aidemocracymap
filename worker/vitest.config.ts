import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const schema = readFileSync(fileURLToPath(new URL("./schema.sql", import.meta.url)), "utf-8");

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        // Bounded by the workerd bundled with vitest-pool-workers, not by wrangler.jsonc.
        compatibilityDate: "2026-07-22",
        d1Databases: ["DB"],
        kvNamespaces: ["UPLOADS"],
        bindings: {
          SCHEMA_SQL: schema,
          FORM_TOKEN_SECRET: "test-secret",
          DIGEST_FROM: "digest@ai4democracy.world",
          DIGEST_TO: "baran@cordademocracy.org",
        },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
