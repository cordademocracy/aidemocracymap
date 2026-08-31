/**
 * Landmark preview renderer: rasterizes a landmark onto its district fill so it
 * can be eyeballed at real map scale.
 *
 *   bun scripts/render-landmark.tsx <id> [--zoom 1] [--out dir]
 *   bun scripts/render-landmark.tsx --all
 *
 * Auto-discovers any `src/components/map/landmarks/*.tsx` exporting `preview`.
 * Rest zoom on desktop is base.k ≈ 0.88, so --zoom 1 ≈ what a visitor sees
 * before touching the map; --zoom 4 is for inspecting craft.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface LandmarkPreview {
  id: string;
  region: string;
  /** district fill to stage against */
  fill: string;
  /** crop half-extents around the anchor */
  hw: number;
  hh: number;
  render: (p: { x: number; y: number; s?: number }) => ReactElement;
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, "src/components/map/landmarks");
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const outDir = path.resolve(root, flag("out", ".claude/tmp/landmarks"));
const zoom = Number(flag("zoom", "1"));
const REST_K = 0.88;

const previews: LandmarkPreview[] = [];
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".tsx") || file === "index.tsx") continue;
  const mod = await import(path.join(dir, file));
  if (mod.preview) previews.push(mod.preview as LandmarkPreview);
}

const wanted = args.filter((a) => !a.startsWith("--") && !/^[\d.]+$/.test(a));
const selected = args.includes("--all")
  ? previews
  : previews.filter((p) => wanted.includes(p.id));

if (selected.length === 0) {
  console.error(`no match. known ids: ${previews.map((p) => p.id).join(", ") || "(none)"}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
for (const p of selected) {
  const inner = renderToStaticMarkup(p.render({ x: 0, y: 0 }));
  const vb = `${-p.hw} ${-p.hh} ${p.hw * 2} ${p.hh * 2}`;
  const px = Math.max(24, Math.round(p.hw * 2 * REST_K * zoom));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${px}">
<rect x="${-p.hw}" y="${-p.hh}" width="${p.hw * 2}" height="${p.hh * 2}" fill="${p.fill}"/>
${inner}</svg>`;
  const file = path.join(outDir, `${p.id}@${zoom}x.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  fs.writeFileSync(path.join(outDir, `${p.id}.svg`), svg);
  console.log(`${file}  ${px}px wide  on ${p.fill} (${p.region})`);
}
