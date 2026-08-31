/**
 * Full-island preview: server-renders the map's terrain layers (the same pure
 * components IslandMap composes) plus org nodes and label pills, then
 * rasterizes. This is how landmark placement gets judged in context.
 *
 *   bun scripts/render-island.tsx                     # whole island
 *   bun scripts/render-island.tsx --district voting-village
 *   bun scripts/render-island.tsx --width 2200 --no-nodes
 *
 * Interactive bits (pan/zoom, hit targets, hover) are deliberately absent —
 * this renders what the art looks like, not what it does.
 */
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CompassRose,
  GroundDetail,
  IslandBase,
  IslandScatter,
  OceanDecor,
  RegionDecor,
  RegionShape,
} from "../src/components/map/Terrain";
import { Volcano } from "../src/components/MapDecor";
import { MapTitle } from "../src/components/IslandMap";
import { REGIONS, REGION_BY_ID } from "../src/data/regions";
import { labelBox, labelHome } from "../src/components/map/labels";
import { hashString, mulberry32 } from "../src/lib/geometry";
import LAYOUT from "../src/data/layout.json" with { type: "json" };
import ORGS from "../src/data/organizations.json" with { type: "json" };

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const outDir = path.resolve(root, flag("out", ".claude/tmp/island"));
const district = flag("district", "");
const width = Number(flag("width", district ? "1400" : "2000"));
const showNodes = !args.includes("--no-nodes");

const NODE_R: Record<string, number> = { core: 17.5, adjacent: 14.5, broad: 12.5 };
const nodeRadius = (slug: string, ring: string) =>
  NODE_R[ring] + (mulberry32(hashString(slug))() - 0.5) * 3;

type Org = { slug: string; region: string; depthRing: string };
const pins = (LAYOUT as { nodes: Record<string, { x: number; y: number; r?: number }> }).nodes;

const nodes = (ORGS as Org[])
  .filter((o) => pins[o.slug])
  .map((o) => ({
    slug: o.slug,
    region: o.region,
    x: pins[o.slug].x,
    y: pins[o.slug].y,
    r: pins[o.slug].r ?? nodeRadius(o.slug, o.depthRing),
  }));

const labels = REGIONS.map((r) => {
  const ov = (LAYOUT as { labels: Record<string, { x?: number; y?: number; s?: number }> }).labels[r.id];
  const s = ov?.s ?? 1;
  const home = labelHome(r);
  const { w, h } = labelBox(r.name);
  return { id: r.id, name: r.name, x: ov?.x ?? home.x, y: ov?.y ?? home.y, w: w * s, h: h * s };
});

const scene = (
  <g>
    <OceanDecor />
    <IslandBase />
    {REGIONS.map((r) => (
      <RegionShape key={r.id} region={r} />
    ))}
    <IslandScatter />
    <GroundDetail />
    {REGIONS.map((r) => (
      <RegionDecor key={r.id} region={r} />
    ))}
    <CompassRose x={1470} y={250} />
    <Volcano x={1219} y={602} />
    <MapTitle />
  </g>
);

const pills = labels
  .map(
    (l) =>
      `<g><rect x="${l.x - l.w / 2}" y="${l.y - l.h / 2}" width="${l.w}" height="${l.h}" rx="${l.h / 2}" fill="#0e1730" opacity="0.82"/>` +
      `<text x="${l.x}" y="${l.y + 4.5}" text-anchor="middle" fill="#fff" font-size="13.5" font-family="monospace">${l.name}</text></g>`
  )
  .join("");

const circles = showNodes
  ? nodes
      .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="#fff" stroke="#14203a" stroke-width="2.5"/>`)
      .join("")
  : "";

let vb = "0 0 1600 1000";
if (district) {
  const r = REGION_BY_ID[district];
  if (!r) {
    console.error(`unknown district. known: ${REGIONS.map((x) => x.id).join(", ")}`);
    process.exit(1);
  }
  const pad = 1.55;
  vb = `${r.cx - r.rx * pad} ${r.cy - r.ry * pad} ${r.rx * 2 * pad} ${r.ry * 2 * pad}`;
}

// the app inherits the mono face from CSS; a standalone SVG would fall back to
// serif and misrepresent every glyph width
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${width}" font-family="monospace">
<style>.map-title{fill:#e6ded0}</style>
<rect x="0" y="0" width="1600" height="1000" fill="#0c1a24"/>
${renderToStaticMarkup(scene)}${pills}${circles}</svg>`;

fs.mkdirSync(outDir, { recursive: true });
const name = district ? `district-${district}` : "island";
const file = path.join(outDir, `${name}.png`);
await sharp(Buffer.from(svg)).png().toFile(file);
fs.writeFileSync(path.join(outDir, `${name}.svg`), svg);
console.log(`${file}  ${width}px  ${showNodes ? nodes.length + " nodes" : "no nodes"}`);
