#!/usr/bin/env node
/**
 * Layout integrity guard for src/data/layout.json, run in CI.
 *
 * Fails on:
 *  - orphan node keys (no matching org slug in organizations.json)
 *  - hard node overlap: centers closer than max(r1, r2) — one circle's center
 *    inside the other, i.e. badly stacked logos
 *  - a node center inside a region title pill rect (logo hidden by the pill)
 *  - a node circle intersecting a pill rect expanded by LABEL_MARGIN
 *
 * Warns on (kept non-fatal so historic hand-pinned art stays CI-green):
 *  - soft overlap: distance < r1 + r2 + MARGIN (the generator's spacing rule)
 *  - node outside its region ellipse (normalized radius > 1.2; some pins sit
 *    on the wobbly coastline or are parked in another district on purpose)
 *
 * Usage: node scripts/check-layout.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MARGIN,
  LABEL_MARGIN,
  REGION_BY_ID,
  circleHitsPill,
  labelRects,
  radiusFor,
} from "./lib/map-geometry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

if (process.argv.includes("--help")) {
  console.log(`node scripts/check-layout.mjs — assert layout.json integrity + geometric quality

Fail thresholds (hard): orphan keys; centers closer than max(r1,r2) (stacked
circles); node center inside a title pill; node circle intersecting a title
pill expanded by LABEL_MARGIN=${LABEL_MARGIN} (pill clearance beats position fidelity for
every node, hand-pinned or generated). Spacing (r1+r2+${MARGIN}) and region
containment stay warning-only, because pre-generator hand-pins intentionally
violate them in places and CI must stay green on those historic art choices.`);
  process.exit(0);
}

const layout = read("src/data/layout.json");
const orgs = read("src/data/organizations.json");

const bySlug = new Map(orgs.map((o) => [o.slug, o]));
const pinnedSlugs = Object.keys(layout.nodes ?? {});
const orphans = pinnedSlugs.filter((slug) => !bySlug.has(slug));

let failures = 0;
let warnings = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.warn(`warn ${msg}`);
};

if (orphans.length) {
  fail(`${orphans.length} node key(s) with no matching org slug:`);
  for (const slug of orphans) console.error(`  - ${slug}`);
}

const nodes = pinnedSlugs
  .filter((slug) => bySlug.has(slug))
  .map((slug) => {
    const pin = layout.nodes[slug];
    return { slug, x: pin.x, y: pin.y, r: radiusFor(bySlug.get(slug), pin) };
  });

// pairwise overlap
const offenders = [];
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i];
    const b = nodes[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < Math.max(a.r, b.r)) {
      fail(`stacked nodes: ${a.slug} / ${b.slug} centers ${d.toFixed(1)} apart (< max radius ${Math.max(a.r, b.r).toFixed(1)})`);
    } else if (d < a.r + b.r + MARGIN) {
      offenders.push({ a, b, d, deficit: a.r + b.r + MARGIN - d });
    }
  }
}
offenders.sort((p, q) => q.deficit - p.deficit);
for (const { a, b, d, deficit } of offenders) {
  warn(`soft overlap: ${a.slug} / ${b.slug} dist ${d.toFixed(1)}, ${deficit.toFixed(1)} short of ${(a.r + b.r + MARGIN).toFixed(1)}`);
}

// label pills
const pills = labelRects(layout.labels ?? {});
for (const n of nodes) {
  for (const pill of pills) {
    if (Math.abs(n.x - pill.lx) < pill.hw && Math.abs(n.y - pill.ly) < pill.hh) {
      fail(`node under pill: ${n.slug} center inside "${pill.id}" title pill`);
    } else if (circleHitsPill(n.x, n.y, n.r, pill, LABEL_MARGIN)) {
      fail(`node overlaps pill: ${n.slug} within ${LABEL_MARGIN}px of "${pill.id}" title pill`);
    }
  }
}

// region containment
for (const n of nodes) {
  const region = REGION_BY_ID[bySlug.get(n.slug).region];
  if (!region) continue;
  const norm = Math.hypot((n.x - region.cx) / region.rx, (n.y - region.cy) / region.ry);
  if (norm > 1.2) {
    warn(`outside region: ${n.slug} at ${norm.toFixed(2)}x the "${region.id}" ellipse`);
  }
}

if (failures) {
  console.error(`layout check failed: ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(1);
}
console.log(
  `layout ok: ${pinnedSlugs.length} pinned, ${bySlug.size - pinnedSlugs.length} unpinned of ${bySlug.size} orgs; ${warnings} warning(s)`
);
