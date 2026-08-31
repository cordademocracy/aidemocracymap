import { memo } from "react";
import {
  GLASS,
  INK_LINE,
  PENNANT,
  PINE_D,
  PINE_EDGE,
  PINE_L,
  SHADOW,
  SNOW,
  TRUNK,
  type LandmarkProps,
} from "./palette";

const SAND = "#e8c89a";
const BAND_LOW = "#f4a87a";

/** Grass tufts; blade endpoints are offsets from the tuft root. */
const TUFTS: { x: number; y: number; k: number; blades: [number, number][] }[] = [
  { x: -44, y: -20.3, k: 0.85, blades: [[-3.0, -5.2], [-0.4, -6.4], [2.4, -4.8]] },
  { x: -22, y: -22.7, k: 1, blades: [[-3.4, -4.8], [-1.4, -6.6], [0.9, -6.2], [3.2, -4.4]] },
  { x: 2, y: -21.9, k: 0.8, blades: [[-2.4, -5.0], [0.6, -6.0], [2.8, -4.2]] },
  { x: 22, y: -19.7, k: 0.6, blades: [[-2.8, -5.0], [-0.2, -6.2], [2.6, -4.6]] },
];

const GX = 50;
const STAFF_W = 3;
const STAFF_TOP = -17.1;
const STAFF_H = 19.1;
const BAND_H = 2.3;
/** SNOW / PENNANT / #f4a87a, high to low; the lowest sits clear above the waterline. */
const BANDS: [number, string][] = [
  [-17.1, SNOW],
  [-14.8, PENNANT],
  [-12.5, BAND_LOW],
];
const TICKS: [number, number][] = [
  [-14.8, 3.4],
  [-12.5, 2.2],
  [-10.2, 3.4],
  [-7.9, 2.2],
];

/** Backsliding Bay: a long earth levee holding a sea that stands part-way up its
 * seaward flank, a graduated tide staff planted on the beach beside it. The
 * waterline sits well below the lowest band — the line is being held. */
export const LeveeGauge = memo(function LeveeGauge({ x, y, s = 1 }: LandmarkProps) {
  const P = (a: number, b: number) => `${x + a * s} ${y + b * s}`;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;

  const litCrest =
    `M ${P(-64, 0)}` +
    ` C ${P(-60, -7)} ${P(-53, -18)} ${P(-46, -20)}` +
    ` C ${P(-36, -22.2)} ${P(-25, -23)} ${P(-14, -22.6)}` +
    ` C ${P(-6, -22.3)} ${P(3, -22)} ${P(10, -21.4)}`;

  const crest =
    litCrest +
    ` C ${P(17, -20.6)} ${P(21, -19.6)} ${P(24, -18.6)}` +
    ` C ${P(29, -16.9)} ${P(33, -14.4)} ${P(36, -11)}` +
    ` C ${P(38.5, -7.4)} ${P(40.5, -3.6)} ${P(42, 0)}`;

  /** Lit top plane folds to the shaded flank at one hard knee, Mountain-style. */
  const litFace = `${litCrest} L ${P(-10, -8.8)} L ${P(-62.7, -2.2)} Z`;

  const ripple = ` q ${4.5 * s} ${-2 * s} ${9 * s} 0`;
  const water =
    `M ${P(26, -6)}` +
    ripple.repeat(6) +
    ` C ${P(84, -4.6)} ${P(87, -0.6)} ${P(88, 3.6)}` +
    ` C ${P(70, 3.2)} ${P(56, 2.4)} ${P(44.5, 1.4)}` +
    ` C ${P(40, 0.2)} ${P(34, -0.6)} ${P(26, -1)} Z`;

  const sand =
    `M ${P(44, 1.3)}` +
    ` C ${P(44.2, 1.3)} ${P(44.4, 1.35)} ${P(44.5, 1.4)}` +
    ` C ${P(56, 2.4)} ${P(70, 3.2)} ${P(88, 3.6)}` +
    ` L ${P(90, 6.2)}` +
    ` C ${P(70, 5.8)} ${P(54, 5)} ${P(46, 4)}` +
    ` C ${P(44.8, 3.4)} ${P(44.1, 2.4)} ${P(44, 1.3)} Z`;

  return (
    <g>
      <ellipse cx={px(-16)} cy={py(1.4)} rx={50 * s} ry={3.6 * s} fill={SHADOW} />

      <path d={water} fill={GLASS} />

      <path d={`${crest} L ${P(-64, 0)} Z`} fill={PINE_D} />
      <path d={litFace} fill={PINE_L} />
      <path d={crest} fill="none" stroke={PINE_EDGE} strokeWidth={1.4 * s} strokeLinecap="round" />

      <path d={sand} fill={SAND} />

      <g stroke={PINE_EDGE} strokeWidth={0.9 * s} strokeLinecap="round" fill="none">
        {TUFTS.map((t) => (
          <g key={t.x}>
            {t.blades.map(([bx, by]) => (
              <path
                key={bx}
                d={`M ${P(t.x, t.y)} q ${bx * 0.18 * t.k * s} ${by * 0.62 * t.k * s} ${bx * t.k * s} ${by * t.k * s}`}
              />
            ))}
          </g>
        ))}
      </g>

      {/* tide staff: graduated above, plain below — the gap is the held margin */}
      <path
        d={`M ${P(GX - STAFF_W / 2, -2.2)} L ${P(45, 2.2)}`}
        stroke={INK_LINE}
        strokeWidth={1.1 * s}
        strokeLinecap="round"
      />
      <rect x={px(GX - STAFF_W / 2)} y={py(STAFF_TOP)} width={STAFF_W * s} height={STAFF_H * s} fill={TRUNK} />
      {BANDS.map(([top, fill]) => (
        <rect key={fill} x={px(GX - STAFF_W / 2)} y={py(top)} width={STAFF_W * s} height={BAND_H * s} fill={fill} />
      ))}
      <rect
        x={px(GX - STAFF_W / 2)}
        y={py(STAFF_TOP)}
        width={STAFF_W * s}
        height={STAFF_H * s}
        fill="none"
        stroke={INK_LINE}
        strokeWidth={0.8 * s}
      />
      <g stroke={INK_LINE} strokeWidth={0.8 * s} strokeLinecap="round">
        {TICKS.map(([ty, len]) => (
          <path key={ty} d={`M ${P(GX + STAFF_W / 2, ty)} L ${P(GX + STAFF_W / 2 + len, ty)}`} />
        ))}
      </g>
      <rect x={px(GX - 3.2)} y={py(1.4)} width={6.4 * s} height={1.1 * s} fill={INK_LINE} />
    </g>
  );
});

export const preview = {
  id: "levee-gauge",
  region: "backsliding-bay",
  fill: "#9e4a3a",
  hw: 70,
  hh: 24,
  render: (p: LandmarkProps) => <LeveeGauge {...p} y={p.y + 8} />,
};
