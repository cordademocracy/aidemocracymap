/**
 * Downloads a logo for every organization into public/logos/<slug>.png.
 * Sources tried in order: Clearbit logo API → icon.horse → Google favicons.
 * Skips files that already exist. Run: bun run fetch-logos
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const orgs = JSON.parse(await readFile(path.join(root, "src/data/organizations.json"), "utf8"));
const outDir = path.join(root, "public/logos");
await mkdir(outDir, { recursive: true });

const sources = (domain) => [
  `https://logo.clearbit.com/${domain}?size=128`,
  `https://icon.horse/icon/${domain}`,
  `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
];

async function fetchLogo(org) {
  const dest = path.join(outDir, `${org.slug}.png`);
  try {
    await access(dest);
    return { slug: org.slug, status: "cached" };
  } catch {}
  for (const url of sources(org.logoDomain)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 400) continue; // skip empty/default globes
      await writeFile(dest, buf);
      return { slug: org.slug, status: "ok", source: new URL(url).hostname, bytes: buf.length };
    } catch {
      /* try next source */
    }
  }
  return { slug: org.slug, status: "FAILED" };
}

const CONCURRENCY = 8;
const queue = [...orgs];
const results = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const org = queue.shift();
      const r = await fetchLogo(org);
      results.push(r);
      console.log(`${r.status.padEnd(7)} ${r.slug}${r.source ? `  (${r.source}, ${r.bytes}b)` : ""}`);
    }
  })
);

const failed = results.filter((r) => r.status === "FAILED");
console.log(`\nDone: ${results.length - failed.length}/${results.length} logos.`);
if (failed.length) console.log("Missing:", failed.map((f) => f.slug).join(", "));
