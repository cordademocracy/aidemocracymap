import { readFileSync } from "node:fs";

const srcPath = new URL("../src/components/map/useMapViewport.ts", import.meta.url);
const src = readFileSync(srcPath, "utf8");
// strip the small set of TS-only annotations this function uses so `new Function`
// (plain JS) can evaluate it — targeted, not a general TS stripper
const stripTsTypes = (fn) => fn.replace(/\(v: ViewState, size: Size, base: Base\): ViewState/, "(v, size, base)");

const body = stripTsTypes(src.match(/function clampView[\s\S]*?\n}\n/)[0]);
const constants = src.match(/const W = \d+;[\s\S]*?const ISLAND_CY = \d+;/)[0];
const blendStart = src.match(/const BLEND_START = [\d.]+;/)[0];
const clampView = new Function(`${constants}\n${blendStart}\n${body}\nreturn clampView;`)();

// reference (old) implementation — hard branch, no blend
function oldClampView(v, size, base) {
  const W = 1600;
  const H = 1000;
  const ISLAND_CX = 880;
  const ISLAND_CY = 565;
  const contentW = v.k * base.k * W;
  const contentH = v.k * base.k * H;

  let x;
  if (contentW <= size.w) {
    x = size.w / 2 - v.k * base.x - v.k * base.k * ISLAND_CX;
  } else {
    const maxX = -v.k * base.x;
    const minX = size.w - contentW - v.k * base.x;
    x = Math.min(maxX, Math.max(minX, v.x));
  }

  let y;
  if (contentH <= size.h) {
    y = size.h / 2 - v.k * base.y - v.k * base.k * ISLAND_CY;
  } else {
    const maxY = -v.k * base.y;
    const minY = size.h - contentH - v.k * base.y;
    y = Math.min(maxY, Math.max(minY, v.y));
  }

  return { k: v.k, x, y };
}

function fitScale(w, h) {
  return Math.min(w / 1600, h / 1000) * 0.98;
}

const ISLAND_CX = 880;
const ISLAND_CY = 565;

const viewports = [
  { w: 1400, h: 900 },
  { w: 1200, h: 800 },
  { w: 390, h: 750 },
];

let overallFailed = false;

for (const size of viewports) {
  const bk = fitScale(size.w, size.h);
  const base = { k: bk, x: size.w / 2 - ISLAND_CX * bk, y: size.h / 2 - ISLAND_CY * bk };

  let prev = null;
  let maxStep = 0;
  let failed = false;
  for (let i = 0; i <= 300; i++) {
    // the band is [max(BLEND_START, resting fill), 1] per axis; this sweep crosses
    // both of its edges on both axes for every viewport below
    const k = 0.8 + i * 0.002;
    const v = clampView({ k, x: prev ? prev.x : 0, y: prev ? prev.y : 0 }, size, base);
    if (prev) {
      const step = Math.hypot(v.x - prev.x, v.y - prev.y);
      maxStep = Math.max(maxStep, step);
      if (step > 12) {
        console.log(`[${size.w}x${size.h}] FAIL: ${step.toFixed(1)}px jump at k=${k.toFixed(3)}`);
        failed = true;
      }
    }
    prev = v;
  }
  console.log(`[${size.w}x${size.h}] max single-step movement: ${maxStep.toFixed(1)}px`);

  // endpoint assertions: outside the blend band, new must equal old exactly.
  // base.k bakes in fitScale's 0.98 margin, so fill ~= 0.98*k on the width-limited
  // axis: k=0.8 (fill~0.78) sits below the band start on both axes, k=1.4 above 1.
  const kFits = 0.8;
  const kOverflow = 1.4;
  const vFits = clampView({ k: kFits, x: 0, y: 0 }, size, base);
  const oFits = oldClampView({ k: kFits, x: 0, y: 0 }, size, base);
  const vOver = clampView({ k: kOverflow, x: 0, y: 0 }, size, base);
  const oOver = oldClampView({ k: kOverflow, x: 0, y: 0 }, size, base);

  const eq = (a, b) => Math.abs(a - b) < 1e-9;
  if (!eq(vFits.x, oFits.x) || !eq(vFits.y, oFits.y)) {
    console.log(
      `[${size.w}x${size.h}] FAIL: k=${kFits} endpoint mismatch — new (${vFits.x},${vFits.y}) old (${oFits.x},${oFits.y})`
    );
    failed = true;
  }
  if (!eq(vOver.x, oOver.x) || !eq(vOver.y, oOver.y)) {
    console.log(
      `[${size.w}x${size.h}] FAIL: k=${kOverflow} endpoint mismatch — new (${vOver.x},${vOver.y}) old (${oOver.x},${oOver.y})`
    );
    failed = true;
  }

  // k=1 is the default/resting view (load, resetView, every resize): the blend
  // band opens at the resting fill, so it must land on the old exact-center value
  const vRest = clampView({ k: 1, x: 0, y: 0 }, size, base);
  const oRest = oldClampView({ k: 1, x: 0, y: 0 }, size, base);
  if (!eq(vRest.x, oRest.x) || !eq(vRest.y, oRest.y)) {
    console.log(
      `[${size.w}x${size.h}] FAIL: resting view (k=1) off old center — new (${vRest.x.toFixed(1)},${vRest.y.toFixed(1)}) old (${oRest.x.toFixed(1)},${oRest.y.toFixed(1)})`
    );
    failed = true;
  } else {
    console.log(`[${size.w}x${size.h}] resting view (k=1) matches old center exactly (x=${vRest.x}, y=${vRest.y})`);
  }

  if (failed) overallFailed = true;
}

process.exit(overallFailed ? 1 : 0);
