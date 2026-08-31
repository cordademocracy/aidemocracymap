/**
 * Deterministic organic shapes + node layout for the island map.
 * No Math.random — everything is seeded so the map is stable across renders.
 */

/** Mulberry32 seeded PRNG */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Wobbly organic blob path around an ellipse (a "region" landmass).
 * Uses smooth Catmull-Rom → bezier conversion for soft coastlines.
 */
export function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  points = 14,
  wobble = 0.14
): string {
  const rand = mulberry32(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const k = 1 - wobble + rand() * wobble * 2;
    pts.push([cx + Math.cos(angle) * rx * k, cy + Math.sin(angle) * ry * k]);
  }
  return catmullRomClosed(pts);
}

function catmullRomClosed(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return d + "Z";
}

/**
 * Fractal blob: multi-octave radial noise for coastline-like borders.
 * Octaves of smoothly interpolated seeded noise are summed so the outline has
 * large bays, medium coves, and fine jitter. Returns a closed smooth path.
 */
export function fractalBlobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  points = 64,
  octaves: { freq: number; amp: number }[] = [
    { freq: 5, amp: 0.1 },
    { freq: 11, amp: 0.055 },
    { freq: 23, amp: 0.028 },
  ]
): string {
  const layers = octaves.map((o, i) => {
    const rand = mulberry32(seed + i * 7919);
    const vals = Array.from({ length: o.freq }, () => rand() * 2 - 1);
    return { ...o, vals };
  });
  const noiseAt = (t: number) => {
    let sum = 0;
    for (const { freq, amp, vals } of layers) {
      const ft = t * freq;
      const i0 = Math.floor(ft) % freq;
      const i1 = (i0 + 1) % freq;
      const frac = ft - Math.floor(ft);
      const sm = frac * frac * (3 - 2 * frac); // smoothstep
      sum += amp * (vals[i0] * (1 - sm) + vals[i1] * sm);
    }
    return sum;
  };
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const t = i / points;
    const angle = t * Math.PI * 2;
    const k = 1 + noiseAt(t);
    pts.push([cx + Math.cos(angle) * rx * k, cy + Math.sin(angle) * ry * k]);
  }
  return catmullRomClosed(pts);
}

/**
 * Phyllotaxis (sunflower) layout: places n nodes inside an ellipse without
 * collisions, deterministically. Returns offsets relative to region center.
 */
export function phyllotaxis(
  n: number,
  rx: number,
  ry: number,
  spacing: number,
  seed: number
): [number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rand = mulberry32(seed);
  const rot = rand() * Math.PI * 2;
  const out: [number, number][] = [];
  const maxR = Math.min(rx, ry);
  const scaleX = rx / maxR;
  const scaleY = ry / maxR;
  for (let i = 0; i < n; i++) {
    const r = spacing * Math.sqrt(i + 0.6);
    const theta = i * golden + rot;
    out.push([
      Math.cos(theta) * r * scaleX,
      Math.sin(theta) * r * scaleY,
    ]);
  }
  return out;
}
