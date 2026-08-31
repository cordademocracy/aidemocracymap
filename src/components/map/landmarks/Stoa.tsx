import { memo } from "react";
import {
  INK_LINE,
  M_DARK,
  SHADOW,
  SNOW,
  STONE_D,
  STONE_L,
  WALL,
  type LandmarkProps,
} from "./palette";

const COLS = [-27.5, -16.5, -5.5, 5.5, 16.5, 27.5];
const COL_W = 6.6;
const COL_SHADE = 2.1;
const COL_TOP = -22.4;
const COL_BASE = -4;

const LINE_X = 27.5;
const LINE_Y = -20.5;
/** slack line as one quadratic; the off-centre control drops its low point over
 * the loaded bays, so x(t) is non-linear and must be inverted, not lerped */
const CTRL_X = -10;
const CTRL_Y = -10.5;

/** `sway` staggers .stoa-clause: mutually non-harmonic periods and negative
 * delays, so the four are already spread across the cycle on load and never
 * come back into step. */
const CLAUSES = [
  { x: -22, w: 3, h: 9, tilt: -1.5, sway: { animationDuration: "6.1s", animationDelay: "-1.7s" } },
  { x: -11, w: 3, h: 7.8, tilt: 2, sway: { animationDuration: "4.7s", animationDelay: "-3.4s" } },
  { x: 0, w: 3, h: 7.6, tilt: -1, sway: { animationDuration: "5.3s", animationDelay: "-0.6s" } },
  { x: 11, w: 3, h: 8.2, tilt: 2, sway: { animationDuration: "6.8s", animationDelay: "-4.2s" } },
];

/** Governance Grove: a colonnade with four blank clauses hung on a slack line —
 * oversight drafted, aired out, and still in square brackets. */
export const Stoa = memo(function Stoa({ x, y, s = 1 }: LandmarkProps) {
  const a = -2 * CTRL_X;
  const b = 2 * LINE_X + 2 * CTRL_X;
  const at = (cx: number) => {
    const t = (-b + Math.sqrt(b * b + 4 * a * (LINE_X + cx))) / (2 * a);
    const dy = LINE_Y * (1 - 2 * t + 2 * t * t) + 2 * CTRL_Y * (t - t * t);
    return { x: x + cx * s, y: y + dy * s };
  };
  const l = at(-LINE_X);
  const r = at(LINE_X);

  return (
    <g>
      <ellipse cx={x} cy={y + 2.5 * s} rx={34 * s} ry={4.6 * s} fill={SHADOW} />

      {/* the void behind the colonnade: one unbroken dark mass, so the clauses
          hang on the darkest value in the object */}
      <rect x={x - 31.2 * s} y={y - 24 * s} width={62.4 * s} height={20 * s} fill={INK_LINE} />

      {COLS.map((cx, i) => {
        const w = i === 0 || i === COLS.length - 1 ? COL_W + 0.6 : COL_W;
        const wt = w - 0.9;
        const bo = y + COL_BASE * s;
        const to = y + COL_TOP * s;
        return (
          <g key={cx}>
            <path
              d={`M ${x + (cx - w / 2) * s} ${bo} L ${x + (cx - wt / 2) * s} ${to}
                  L ${x + (cx + wt / 2) * s} ${to} L ${x + (cx + w / 2) * s} ${bo} Z`}
              fill={STONE_D}
            />
            <path
              d={`M ${x + (cx - w / 2) * s} ${bo} L ${x + (cx - wt / 2) * s} ${to}
                  L ${x + (cx - wt / 2 + COL_SHADE) * s} ${to}
                  L ${x + (cx - w / 2 + COL_SHADE) * s} ${bo} Z`}
              fill={M_DARK}
            />
            <rect
              x={x + (cx - w / 2 - 0.7) * s}
              y={y - 24 * s}
              width={(w + 1.4) * s}
              height={1.7 * s}
              fill={STONE_L}
            />
          </g>
        );
      })}

      {/* entablature: shaded fascia under a lit roof slab */}
      <rect x={x - 31.8 * s} y={y - 26.2 * s} width={63.6 * s} height={2.2 * s} fill={STONE_D} />
      <rect x={x - 33.2 * s} y={y - 30 * s} width={66.4 * s} height={3.8 * s} fill={WALL} />

      {/* stylobate */}
      <rect x={x - 31.5 * s} y={y - 4 * s} width={63 * s} height={2.2 * s} fill={STONE_L} />
      <rect x={x - 33 * s} y={y - 1.8 * s} width={66 * s} height={2 * s} fill={STONE_D} />

      {/* the hanging tilt stays on the wrapper: .stoa-clause's own transform
          would otherwise replace it, since CSS beats the presentation attribute */}
      {CLAUSES.map((c) => {
        const p = at(c.x);
        return (
          <g key={c.x} transform={`rotate(${c.tilt} ${p.x} ${p.y})`}>
            <rect
              className="stoa-clause"
              style={c.sway}
              x={p.x - (c.w / 2) * s}
              y={p.y - 0.9 * s}
              width={c.w * s}
              height={c.h * s}
              fill={SNOW}
            />
          </g>
        );
      })}

      {/* drawn over the clause tops so the line reads as carrying them */}
      <path
        d={`M ${l.x} ${l.y} Q ${x + CTRL_X * s} ${y + CTRL_Y * s} ${r.x} ${r.y}`}
        fill="none"
        stroke={INK_LINE}
        strokeWidth={1.3 * s}
        strokeLinecap="round"
      />
      {[l, r].map((p) => (
        <rect key={p.x} x={p.x - 1.1 * s} y={p.y - 1.1 * s} width={2.2 * s} height={2.2 * s} fill={INK_LINE} />
      ))}
    </g>
  );
});

export const preview = {
  id: "stoa",
  region: "governance-grove",
  fill: "#3f8f7e",
  hw: 38,
  hh: 26,
  render: (p: LandmarkProps) => <Stoa {...p} y={p.y + 14} />,
};
