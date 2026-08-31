#!/usr/bin/env node
/**
 * Offline blue-noise layout generator: pins every unpinned org into
 * src/data/layout.json so render-time autoPlace stays a rarely-used fallback.
 *
 * Per unpinned org, seeded by mulberry32(hashString(slug)) for reproducibility:
 * rejection-sample uniform candidates in the region's node spread ellipse,
 * accept the first with clearance >= r1 + r2 + MARGIN from every placed node
 * (pinned and freshly generated) and outside all label pill rects. If sampling
 * exhausts, keep the least-bad candidate. A short relaxation pass then nudges
 * only the newly generated nodes apart; pinned nodes never move.
 *
 * Idempotent: already-pinned orgs are untouched; with zero unpinned orgs the
 * file is left as-is. Writes atomically, appending new keys after existing
 * ones so diffs stay minimal.
 *
 * Usage: node scripts/generate-layout.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MARGIN,
  LABEL_MARGIN,
  REGION_BY_ID,
  circleHitsPill,
  hashString,
  labelRects,
  mulberry32,
  radiusFor,
  spreadEllipse,
} from "./lib/map-geometry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layoutPath = join(root, "src/data/layout.json");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

if (process.argv.includes("--help")) {
  console.log("node scripts/generate-layout.mjs [--dry-run] — pin unpinned orgs into src/data/layout.json");
  process.exit(0);
}
const dryRun = process.argv.includes("--dry-run");

const layout = read("src/data/layout.json");
const orgs = read("src/data/organizations.json");
layout.nodes ??= {};
layout.labels ??= {};

const pills = labelRects(layout.labels);
const placed = [];
for (const org of orgs) {
  const pin = layout.nodes[org.slug];
  if (pin) placed.push({ x: pin.x, y: pin.y, r: radiusFor(org, pin) });
}

const SAMPLES = 800;
const RELAX_ITERS = 120;
/** Crowded regions may overflow the base spread ellipse up to this factor
 * (0.72 * 1.25 = 0.9 of the region ellipse — still on land). */
const SPREAD_GROWTH = [1, 1.1, 1.25];

function clearance(x, y, r, others) {
  let min = Infinity;
  for (const p of others) {
    min = Math.min(min, Math.hypot(x - p.x, y - p.y) - (r + p.r + MARGIN));
  }
  for (const pill of pills) {
    if (circleHitsPill(x, y, r, pill, LABEL_MARGIN)) min = Math.min(min, -1);
  }
  return min;
}

function sample(org, region) {
  const rand = mulberry32(hashString(org.slug));
  const { cx, cy, sx, sy } = spreadEllipse(region);
  const r = radiusFor(org);
  let best = { x: cx, y: cy, score: -Infinity };
  for (const grow of SPREAD_GROWTH) {
    for (let i = 0; i < SAMPLES; i++) {
      const angle = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      const x = cx + Math.cos(angle) * sx * grow * d;
      const y = cy + Math.sin(angle) * sy * grow * d;
      const score = clearance(x, y, r, placed);
      if (score >= 0) return { x, y, r };
      if (score > best.score) best = { x, y, score };
    }
  }
  return { x: best.x, y: best.y, r };
}

function clampToEllipse(node, region) {
  const { cx, cy, sx, sy } = spreadEllipse(region);
  const grow = SPREAD_GROWTH[SPREAD_GROWTH.length - 1];
  const nx = (node.x - cx) / (sx * grow);
  const ny = (node.y - cy) / (sy * grow);
  const n = Math.hypot(nx, ny);
  if (n > 1) {
    node.x = cx + (nx / n) * sx * grow;
    node.y = cy + (ny / n) * sy * grow;
  }
}

const generated = [];
const perRegion = {};
for (const org of orgs) {
  if (layout.nodes[org.slug]) continue;
  const region = REGION_BY_ID[org.region];
  if (!region) {
    console.error(`skip ${org.slug}: unknown region "${org.region}"`);
    continue;
  }
  const node = { slug: org.slug, region, ...sample(org, region) };
  placed.push(node);
  generated.push(node);
  perRegion[region.id] = (perRegion[region.id] ?? 0) + 1;
}

for (let iter = 0; iter < RELAX_ITERS; iter++) {
  let moved = false;
  for (const node of generated) {
    // summed repulsion from every overlapping neighbour (pinned or generated)
    let fx = 0;
    let fy = 0;
    for (const other of placed) {
      if (other === node) continue;
      const d = Math.hypot(node.x - other.x, node.y - other.y);
      const deficit = node.r + other.r + MARGIN - d;
      if (deficit <= 0) continue;
      const dx = node.x - other.x || 1;
      const dy = node.y - other.y;
      const len = Math.hypot(dx, dy);
      fx += (dx / len) * (deficit / 2 + 0.5);
      fy += (dy / len) * (deficit / 2 + 0.5);
    }
    if (fx || fy) {
      node.x += fx;
      node.y += fy;
      moved = true;
    }
    for (const pill of pills) {
      if (circleHitsPill(node.x, node.y, node.r, pill, LABEL_MARGIN)) {
        const dx = node.x - pill.lx || 1;
        const dy = node.y - pill.ly;
        const len = Math.hypot(dx, dy);
        node.x += (dx / len) * 8;
        node.y += (dy / len) * 8;
        moved = true;
      }
    }
    clampToEllipse(node, node.region);
  }
  if (!moved) break;
}

if (!generated.length) {
  console.log("nothing to do: all orgs pinned");
  process.exit(0);
}

for (const { slug, x, y } of generated) layout.nodes[slug] = { x, y };

const json = JSON.stringify(layout, null, 2) + "\n";
if (dryRun) {
  console.log("[dry-run] not writing layout.json");
} else {
  const tmp = layoutPath + ".tmp";
  writeFileSync(tmp, json);
  renameSync(tmp, layoutPath);
}

console.log(`generated ${generated.length} placement(s):`);
for (const [region, n] of Object.entries(perRegion)) console.log(`  ${region}: ${n}`);
console.log(`layout.json now pins ${Object.keys(layout.nodes).length} of ${orgs.length} orgs`);
