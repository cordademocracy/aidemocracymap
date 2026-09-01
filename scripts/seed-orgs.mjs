/**
 * Seeds D1's organizations table from the canonical JSON. Idempotent: an
 * existing slug is left untouched, so it can never clobber curated live data.
 *
 *   node scripts/seed-orgs.mjs --local
 *   node scripts/seed-orgs.mjs --remote
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mode = process.argv.includes("--remote") ? "--remote" : "--local";
const orgs = JSON.parse(readFileSync(path.join(root, "src/data/organizations.json"), "utf8"));

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
const now = new Date().toISOString();

const statements = orgs.map((o) =>
  `INSERT OR IGNORE INTO organizations (slug,name,website,category,region,tagline,description,` +
  `ai_democracy_angle,focus_tags,location,founded,funders,key_projects,logo_domain,logo_url,` +
  `depth_ring,updated_at) VALUES (${q(o.slug)},${q(o.name)},${q(o.website)},${q(o.category)},` +
  `${q(o.region)},${q(o.tagline)},${q(o.description)},${q(o.aiDemocracyAngle)},` +
  `${q(JSON.stringify(o.focusTags ?? []))},${q(o.location ?? "")},` +
  `${o.founded == null ? "NULL" : Number(o.founded)},${q(JSON.stringify(o.funders ?? []))},` +
  `${q(JSON.stringify(o.keyProjects ?? []))},${q(o.logoDomain ?? "")},${q(o.logoUrl ?? null)},` +
  `${q(o.depthRing)},${q(now)});`
);

const file = path.join(root, ".seed-orgs.sql");
writeFileSync(file, statements.join("\n"));
execFileSync("npx", ["wrangler", "d1", "execute", "ai4democracy", mode, "--yes", "--file", file], {
  cwd: path.join(root, "worker"),
  stdio: "inherit",
});
console.log(`seeded ${orgs.length} orgs (${mode})`);
