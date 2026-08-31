/**
 * Map geometry shared by the offline layout scripts.
 * Constants mirror src/lib/geometry.ts, src/data/regions.ts,
 * src/components/map/labels.ts and radiusFor/autoPlace in
 * src/components/IslandMap.tsx — keep them in sync when the map changes.
 */

/** Min clearance between node circles (matches autoPlace's `r + p.r + 8`). */
export const MARGIN = 8;
/** Min clearance between a node circle and a label pill rect. */
export const LABEL_MARGIN = 6;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const NODE_R = { core: 17.5, adjacent: 14.5, broad: 12.5 };

/** Node radius: manual override wins, else depth-ring base + seeded jitter. */
export function radiusFor(org, override) {
  if (override?.r != null) return override.r;
  const jitter = (mulberry32(hashString(org.slug))() - 0.5) * 3;
  return NODE_R[org.depthRing] + jitter;
}

export const REGIONS = [
  { id: "research-range", name: "Research Range", cx: 1010, cy: 470, rx: 170, ry: 120 },
  { id: "power-peaks", name: "Power Peaks", cx: 1240, cy: 585, rx: 150, ry: 130 },
  { id: "governance-grove", name: "Governance Grove", cx: 860, cy: 345, rx: 160, ry: 95 },
  { id: "funding-forest", name: "Funding Forest", cx: 640, cy: 400, rx: 145, ry: 100 },
  { id: "deliberation-delta", name: "Deliberation Delta", cx: 560, cy: 585, rx: 165, ry: 115 },
  { id: "integrity-inlet", name: "Integrity Inlet", cx: 870, cy: 570, rx: 150, ry: 105, nodeDy: -42, spreadY: 0.46 },
  { id: "voting-village", name: "Voting Village", cx: 555, cy: 785, rx: 160, ry: 95, spreadY: 0.56 },
  { id: "cooperation-cove", name: "Cooperation Cove", cx: 855, cy: 775, rx: 155, ry: 90 },
  { id: "backsliding-bay", name: "Backsliding Bay", cx: 1140, cy: 780, rx: 165, ry: 95 },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** Node-cluster spread ellipse: center + semi-axes of a region. */
export function spreadEllipse(region) {
  return {
    cx: region.cx + (region.nodeDx ?? 0),
    cy: region.cy + (region.nodeDy ?? 0),
    sx: region.rx * (region.spreadX ?? 0.72),
    sy: region.ry * (region.spreadY ?? 0.64),
  };
}

/** Region title pill rects (center + half extents), honouring layout overrides. */
export function labelRects(layoutLabels = {}) {
  return REGIONS.map((r) => {
    const lo = layoutLabels[r.id];
    const s = lo?.s ?? 1;
    const w = r.name.length * 8 + 26;
    const h = 29;
    return {
      id: r.id,
      lx: lo?.x ?? r.cx + (r.nodeDx ?? 0),
      ly: lo?.y ?? r.cy + (r.nodeDy ?? 0),
      hw: (w * s) / 2,
      hh: (h * s) / 2,
    };
  });
}

/** Does a circle at (x,y,r) intersect the pill rect expanded by `pad`? */
export function circleHitsPill(x, y, r, pill, pad = 0) {
  return Math.abs(x - pill.lx) < pill.hw + r + pad && Math.abs(y - pill.ly) < pill.hh + r + pad;
}
