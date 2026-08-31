/**
 * Illustrated SVG decor for the island map: layered mountains, pines, houses,
 * castle, boats, clouds, animated bird flocks, and the erupting volcano.
 * Flat vector art in the AISafety.com map style — no emoji, everything drawn.
 */
import { memo, useEffect, useState } from "react";
import { fractalBlobPath, mulberry32 } from "../lib/geometry";

/** Tracks the OS reduced-motion preference; SMIL animations ignore CSS media queries. */
const supportsMatchMedia = typeof window !== "undefined" && typeof window.matchMedia === "function";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => supportsMatchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (!supportsMatchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ── palette ─────────────────────────────────────────────────────────── */
const M_DARK = "#a04424";
const M_LIGHT = "#d9713f";
const SNOW = "#f6f1e7";
const TRUNK = "#6b4423";
const PINE_D = "#175c43";
const PINE_L = "#1f7a5a";
/** Silhouette edge so pines survive the near-isoluminant Funding Forest fill. */
const PINE_EDGE = "#0e4132";
const WALL = "#f4e3c2";
const ROOF = "#b3502b";
const SHADOW = "rgba(10, 20, 30, 0.18)";

/* ── mountains ───────────────────────────────────────────────────────── */
export function Mountain({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const px = x;
  const py = y - 54 * s;
  return (
    <g>
      <ellipse cx={x} cy={y + 2 * s} rx={40 * s} ry={6 * s} fill={SHADOW} />
      {/* left face (shaded) */}
      <path d={`M ${px} ${py} L ${x - 40 * s} ${y} L ${x + 2 * s} ${y} Z`} fill={M_DARK} />
      {/* right face (lit) */}
      <path d={`M ${px} ${py} L ${x + 2 * s} ${y} L ${x + 40 * s} ${y} Z`} fill={M_LIGHT} />
      {/* snow cap with jagged bottom edge */}
      <path
        d={`M ${x - 11 * s} ${y - 37 * s}
            L ${px} ${py}
            L ${x + 11 * s} ${y - 37 * s}
            L ${x + 6.5 * s} ${y - 41 * s}
            L ${x + 2 * s} ${y - 35 * s}
            L ${x - 3 * s} ${y - 42 * s}
            L ${x - 7 * s} ${y - 36 * s} Z`}
        fill={SNOW}
      />
    </g>
  );
}

export function MountainRange({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <Mountain x={x - 42 * s} y={y + 4 * s} s={0.72 * s} />
      <Mountain x={x + 46 * s} y={y + 6 * s} s={0.6 * s} />
      <Mountain x={x} y={y} s={1.05 * s} />
    </g>
  );
}

/* ── trees ───────────────────────────────────────────────────────────── */
export function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 8 * s} rx={9 * s} ry={2.5 * s} fill={SHADOW} />
      <rect x={x - 1.6 * s} y={y + 2 * s} width={3.2 * s} height={6 * s} fill={TRUNK} />
      <path
        d={`M ${x - 9 * s} ${y + 3 * s} L ${x} ${y - 10 * s} L ${x + 9 * s} ${y + 3 * s} Z`}
        fill={PINE_L}
        stroke={PINE_EDGE}
        strokeWidth={1.1 * s}
        strokeLinejoin="round"
      />
      <path d={`M ${x - 7 * s} ${y - 5 * s} L ${x} ${y - 16 * s} L ${x + 7 * s} ${y - 5 * s} Z`} fill={PINE_D} />
    </g>
  );
}

export function PineCluster({ x, y, seed, s = 1 }: { x: number; y: number; seed: number; s?: number }) {
  const rand = mulberry32(seed);
  return (
    <g>
      <Pine x={x - 14 * s - rand() * 6} y={y + 4 * s} s={0.8 * s} />
      <Pine x={x + 12 * s + rand() * 6} y={y + 2 * s} s={0.9 * s} />
      <Pine x={x - 1 * s} y={y - 6 * s} s={1.1 * s} />
    </g>
  );
}

/* ── buildings ───────────────────────────────────────────────────────── */
export function House({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  const k = flip ? -1 : 1;
  return (
    <g>
      <ellipse cx={x} cy={y + 6 * s} rx={13 * s} ry={3 * s} fill={SHADOW} />
      <rect x={x - 9 * s} y={y - 5 * s} width={18 * s} height={11 * s} fill={WALL} />
      <path d={`M ${x - 11.5 * s} ${y - 5 * s} L ${x} ${y - 14 * s} L ${x + 11.5 * s} ${y - 5 * s} Z`} fill={ROOF} />
      <rect x={x + 3.5 * s * k} y={y - 12.5 * s} width={2.6 * s} height={4 * s} fill={M_DARK} />
      <rect x={x - 2 * s} y={y + 0.5 * s} width={4 * s} height={5.5 * s} rx={1.5 * s} fill={TRUNK} />
      <rect x={x - 6.5 * s * k} y={y - 2.5 * s} width={3 * s} height={3 * s} fill="#c0e4ec" />
    </g>
  );
}

export function Castle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const t = (dx: number) => (
    <g>
      <rect x={x + dx - 5 * s} y={y - 22 * s} width={10 * s} height={24 * s} fill="#e2d9c3" />
      <path d={`M ${x + dx - 6.5 * s} ${y - 22 * s} L ${x + dx} ${y - 32 * s} L ${x + dx + 6.5 * s} ${y - 22 * s} Z`} fill="#c25c33" />
      <path d={`M ${x + dx} ${y - 32 * s} L ${x + dx} ${y - 38 * s} L ${x + dx + 7 * s} ${y - 35.5 * s} L ${x + dx} ${y - 33 * s}`} fill="#f2849a" stroke="#f2849a" strokeWidth={1.4 * s} />
      <rect x={x + dx - 1.6 * s} y={y - 18 * s} width={3.2 * s} height={4.5 * s} rx={1.6 * s} fill="#5d4a33" />
    </g>
  );
  return (
    <g>
      <ellipse cx={x} cy={y + 4 * s} rx={26 * s} ry={5 * s} fill={SHADOW} />
      <rect x={x - 15 * s} y={y - 13 * s} width={30 * s} height={15 * s} fill={WALL} />
      {[-9, 0, 9].map((dx) => (
        <rect key={dx} x={x + (dx - 2) * s} y={y - 16 * s} width={4 * s} height={4 * s} fill={WALL} />
      ))}
      <rect x={x - 3 * s} y={y - 6 * s} width={6 * s} height={8 * s} rx={2.5 * s} fill={TRUNK} />
      {t(-15 * s)}
      {t(15 * s)}
    </g>
  );
}

export function FlagBanner({ x, y, s = 1, alt = false }: { x: number; y: number; s?: number; alt?: boolean }) {
  return (
    <g>
      <rect x={x - 0.9 * s} y={y - 18 * s} width={1.8 * s} height={20 * s} fill="#16223c" rx={0.9 * s} />
      <path d={`M ${x + 0.9 * s} ${y - 18 * s} L ${x + 13 * s} ${y - 14.5 * s} L ${x + 0.9 * s} ${y - 11 * s} Z`} fill={alt ? "#f4a87a" : "#f2849a"} />
    </g>
  );
}

/* ── water & sky ─────────────────────────────────────────────────────── */
export function Boat({ x, y, s = 1, dir = 1 }: { x: number; y: number; s?: number; dir?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${dir * s}, ${s})`} opacity="0.95">
      <path d="M -18 8 Q 0 17 18 8 L 13 13 Q 0 19 -13 13 Z" fill="#b3502b" />
      <rect x="-1" y="-18" width="2" height="26" fill="#16223c" />
      <path d="M 2 -18 L 16 4 L 2 4 Z" fill={SNOW} />
      <path d="M -2 -14 L -13 4 L -2 4 Z" fill="#f4a87a" />
    </g>
  );
}

export function CloudPuff({
  x,
  y,
  s = 1,
  slow = false,
  delay,
}: {
  x: number;
  y: number;
  s?: number;
  slow?: boolean;
  /** negative offset into the drift cycle; half the duration, so a pair on the
   * same track never reaches its turning points together */
  delay?: string;
}) {
  return (
    <g
      className={slow ? "cloud-drift-slow" : "cloud-drift"}
      style={delay ? { animationDelay: delay } : undefined}
      opacity="0.92"
    >
      <ellipse cx={x} cy={y} rx={34 * s} ry={12 * s} fill="#e9eef4" />
      <ellipse cx={x + 22 * s} cy={y - 7 * s} rx={20 * s} ry={9 * s} fill="#e9eef4" />
      <ellipse cx={x - 20 * s} cy={y - 5 * s} rx={16 * s} ry={7.5 * s} fill="#dfe7f0" />
    </g>
  );
}

function Bird({ dx = 0, dy = 0, s = 1 }: { dx?: number; dy?: number; s?: number }) {
  return (
    <g transform={`translate(${dx} ${dy}) scale(${s})`} stroke="#131d33" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8">
      <path className="bird-wing-l" d="M 0 0 Q -6 -5 -11 -3" />
      <path className="bird-wing-r" d="M 0 0 Q 6 -5 11 -3" />
    </g>
  );
}

/** A small flock following an invisible path across the map (SMIL). */
export function Flock({ path, dur, s = 1 }: { path: string; dur: number; s?: number }) {
  const reducedMotion = useReducedMotion();
  // the birds are placed only by animateMotion (relative dx/dy otherwise) — without
  // it the flock would stack at the canvas origin, so drop it entirely
  if (reducedMotion) return null;
  return (
    <g>
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} />
      <Bird s={s} />
      <Bird dx={30 * s} dy={12 * s} s={0.82 * s} />
      <Bird dx={-26 * s} dy={16 * s} s={0.72 * s} />
    </g>
  );
}

/* ── decorative islets ───────────────────────────────────────────────── */
/** A miniature of the main island: fractal coast + a short extruded slab side. */
export function Islet({ x, y, s = 1, seed = 1 }: { x: number; y: number; s?: number; seed?: number }) {
  const T = 11 * s; // slab thickness
  const octaves = [
    { freq: 5, amp: 0.13 },
    { freq: 11, amp: 0.07 },
  ];
  const sand = fractalBlobPath(x, y, 66 * s, 25 * s, seed, 44, octaves);
  const green = fractalBlobPath(x, y, 51 * s, 18 * s, seed + 5, 44, octaves);
  return (
    <g>
      <path d={sand} fill="#04070f" opacity="0.34" transform={`translate(0 ${T + 6})`} />
      <path d={sand} fill="#241608" transform={`translate(0 ${T})`} />
      <path d={sand} fill="#3f2c17" transform={`translate(0 ${T * 0.55})`} />
      <path d={sand} fill="#e8c89a" />
      <path d={green} fill="#2b8560" />
      <Mountain x={x + 16 * s} y={y + 4 * s} s={0.5 * s} />
      <PineCluster x={x - 22 * s} y={y + 2 * s} seed={seed} s={0.8 * s} />
    </g>
  );
}

/* ── the volcano scene ───────────────────────────────────────────────── */
export const Volcano = memo(function Volcano({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const cx = x;
  const cy = y - 58 * s; // crater center
  return (
    <g>
      <g className="v-shake">
        <ellipse cx={x} cy={y + 8 * s} rx={66 * s} ry={9 * s} fill={SHADOW} />
        {/* cone: wide trapezoid split into shaded + lit faces */}
        <path d={`M ${x - 64 * s} ${y + 8 * s} L ${x - 11 * s} ${cy} L ${x - 2 * s} ${cy} L ${x - 14 * s} ${y + 8 * s} Z`} fill="#7e3418" />
        <path d={`M ${x - 2 * s} ${cy} L ${x + 11 * s} ${cy} L ${x + 64 * s} ${y + 8 * s} L ${x - 14 * s} ${y + 8 * s} Z`} fill="#9c4423" />
        {/* ridge lines for texture */}
        <path d={`M ${x - 26 * s} ${y - 22 * s} L ${x - 38 * s} ${y + 6 * s}`} stroke="#6e2d13" strokeWidth={1.6 * s} opacity="0.6" />
        <path d={`M ${x + 24 * s} ${y - 24 * s} L ${x + 40 * s} ${y + 6 * s}`} stroke="#83381b" strokeWidth={1.6 * s} opacity="0.6" />
        {/* lava streaks down the cone */}
        <path d={`M ${x - 4 * s} ${cy + 3 * s} q -5 ${18 * s} -13 ${32 * s}`} stroke="#ff7a3d" strokeWidth={3 * s} fill="none" strokeLinecap="round" opacity="0.9" />
        <path d={`M ${x + 4 * s} ${cy + 3 * s} q 6 ${16 * s} 15 ${28 * s}`} stroke="#ffb15c" strokeWidth={2.2 * s} fill="none" strokeLinecap="round" opacity="0.85" />
        {/* crater rim + pool */}
        <ellipse cx={cx} cy={cy} rx={11 * s} ry={4 * s} fill="#5e2712" />
        <ellipse className="v-pool" cx={cx} cy={cy} rx={8 * s} ry={2.8 * s} fill="#ff7a3d" />
      </g>

      {/* eruption glow */}
      <ellipse className="v-glow" cx={cx} cy={cy - 3} rx={17 * s} ry={8 * s} fill="#ffb15c" />

      {/* lava bombs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          className={`v-p v-p${i}`}
          cx={cx}
          cy={cy - 3}
          r={(i % 2 ? 3.6 : 5) * s}
          fill={i % 2 ? "#ffb15c" : "#ff7a3d"}
        />
      ))}

      {/* resting plume + embers — 7s harmonics, so they never drift into the burst */}
      {[0, 1].map((i) => (
        <circle key={i} className={`v-idle v-idle${i}`} cx={cx + (i ? 3.5 : -3.5)} cy={cy - 8} r={(5 + i * 1.8) * s} fill="#6b7183" />
      ))}
      {[0, 1].map((i) => (
        <circle key={i} className={`v-ember v-ember${i}`} cx={cx + (i ? 2 : -2)} cy={cy - 4} r={(i ? 3 : 3.8) * s} fill={i ? "#ffb15c" : "#ff7a3d"} />
      ))}

      {/* smoke */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className={`v-smoke v-smoke${i}`} cx={cx + (i - 1) * 6} cy={cy - 10} r={(6.5 + i * 2.5) * s} fill="#454a58" />
      ))}

      {/* steam venting off the cooling crater — the calm-down phase */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className={`v-steam v-steam${i}`} cx={cx + (i - 1) * 12} cy={cy - 6} r={7 * s} fill="#e4f2ee" />
      ))}
    </g>
  );
});
