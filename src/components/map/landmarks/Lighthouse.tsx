import { memo } from "react";
import {
  BRONZE,
  GLASS,
  INK_LINE,
  M_DARK,
  M_LIGHT,
  ROOF,
  SHADOW,
  SNOW,
  STONE_D,
  STONE_L,
  TRUNK,
  type LandmarkProps,
} from "./palette";

const TOWER_BOT = -9;
const TOWER_TOP = -45;
const HALF_BOT = 8.5;
const HALF_TOP = 5.2;
/** shaded left face covers this fraction of the tower's width */
const SHADE_F = 0.38;

const halfAt = (u: number) => HALF_BOT + (HALF_TOP - HALF_BOT) * ((TOWER_BOT - u) / (TOWER_BOT - TOWER_TOP));

const BANDS = [-24, -33, -42];
const BAND_H = 4;

const LAMP_V = -53.2;
/** one cone truncated four times: same apex, staggered tips, brightest near the lamp */
const APEX_U = 3.6;
const APEX_H = 1;
const SPREAD = 0.55;
const coneH = (u: number) => APEX_H + SPREAD * (u - APEX_U);
/** [top tip, bottom tip, opacity] — longest and faintest first; the cuts are staggered
 * and non-parallel so the beam ends in a broken edge instead of one vertical line */
const WEDGES: [number, number, number][] = [
  [24.5, 26, 0.1],
  [21.5, 22.8, 0.16],
  [15, 16.2, 0.22],
  [9.5, 8.5, 0.26],
];

const ROCK_FACET: [number, number][] = [
  [-3, -12.6],
  [-8.6, -10.4],
  [-9.8, -5.2],
  [-14.2, -3.2],
  [-16.5, 0],
  [-6, 0],
];

const ROCK: [number, number][] = [
  [-16.5, 0],
  [-14.2, -3.2],
  [-9.8, -5.2],
  [-8.6, -10.4],
  [-3, -12.6],
  [3.4, -12.8],
  [8.8, -10.2],
  [10.2, -6.2],
  [14.4, -4],
  [16.8, 0],
];

/** Integrity Inlet: a banded tower whose beam catches watching eyes —
 * detection under deliberate deception, drawn without naming it. */
export const Lighthouse = memo(function Lighthouse({ x, y, s = 1 }: LandmarkProps) {
  const X = (u: number) => x + u * s;
  const Y = (v: number) => y + v * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${X(a)},${Y(b)}`).join(" ");
  const line = (pts: [number, number][]) => `M ${pts.map(([a, b]) => `${X(a)} ${Y(b)}`).join(" L ")}`;

  const band = (u: number, lit: boolean) => {
    const b = halfAt(u);
    const t = halfAt(u + BAND_H);
    const k = 2 * SHADE_F - 1;
    const [b0, t0] = lit ? [b * k, t * k] : [-b, -t];
    const [b1, t1] = lit ? [b, t] : [b * k, t * k];
    return `M ${X(b0)} ${Y(u)} L ${X(b1)} ${Y(u)} L ${X(t1)} ${Y(u + BAND_H)} L ${X(t0)} ${Y(u + BAND_H)} Z`;
  };

  const wedge = (topTip: number, botTip: number) =>
    `M ${APEX_U * s} ${-APEX_H * s}
     L ${topTip * s} ${-coneH(topTip) * s}
     L ${botTip * s} ${coneH(botTip) * s}
     L ${APEX_U * s} ${APEX_H * s} Z`;

  /** h = fill half-height, w = 1.5h; gaze offsets the pupil back toward the lamp */
  const eye = (cx: number, cy: number, h: number, sw: number, gy: number) => {
    const w = h * 1.5;
    return (
      <g key={cx}>
        <path
          d={`M ${(cx - w) * s} ${cy * s}
              Q ${cx * s} ${(cy - 2 * h) * s} ${(cx + w) * s} ${cy * s}
              Q ${cx * s} ${(cy + 2 * h) * s} ${(cx - w) * s} ${cy * s} Z`}
          fill={SNOW}
          stroke={INK_LINE}
          strokeWidth={sw * s}
          strokeLinejoin="round"
        />
        <circle cx={(cx - w * 0.28) * s} cy={(cy + gy) * s} r={h * 0.5 * s} fill={INK_LINE} />
      </g>
    );
  };

  return (
    <g>
      <ellipse cx={x} cy={Y(1.6)} rx={18 * s} ry={4.6 * s} fill={SHADOW} />

      {/* tower first — the rock is laid over its foot so it reads as bedded in, not standing on */}
      <path
        d={`M ${X(-HALF_BOT)} ${Y(TOWER_BOT)} L ${X(-HALF_TOP)} ${Y(TOWER_TOP)} L ${X(HALF_TOP)} ${Y(TOWER_TOP)} L ${X(HALF_BOT)} ${Y(TOWER_BOT)} Z`}
        fill={SNOW}
      />
      <path
        d={`M ${X(-HALF_BOT)} ${Y(TOWER_BOT)} L ${X(-HALF_TOP)} ${Y(TOWER_TOP)}
            L ${X(HALF_TOP * (2 * SHADE_F - 1))} ${Y(TOWER_TOP)} L ${X(HALF_BOT * (2 * SHADE_F - 1))} ${Y(TOWER_BOT)} Z`}
        fill={STONE_D}
      />
      {BANDS.map((u) => (
        <g key={u}>
          <path d={band(u, false)} fill={M_DARK} />
          <path d={band(u, true)} fill={M_LIGHT} />
        </g>
      ))}
      <path
        d={`M ${X(-2.4)} ${Y(-9.5)} L ${X(-2.4)} ${Y(-16.2)} Q ${x} ${Y(-19.2)} ${X(2.4)} ${Y(-16.2)} L ${X(2.4)} ${Y(-9.5)} Z`}
        fill={TRUNK}
      />

      {/* rock plinth: lit seaward mass, a landward facet dropped a full step by the ink
          overlay, and a bedding plane at the foot */}
      <polygon points={poly(ROCK)} fill={STONE_L} />
      <polygon points={poly(ROCK_FACET)} fill={STONE_D} />
      <polygon points={poly(ROCK_FACET)} fill={INK_LINE} opacity="0.2" />
      <polygon points={poly([[-6, 0], [-0.5, -2], [6.5, -2.4], [9.6, -4.2], [14.4, -4], [16.8, 0]])} fill={STONE_D} />
      <path
        d={line(ROCK)}
        fill="none"
        stroke={INK_LINE}
        strokeWidth={0.95 * s}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* beam under the lantern housing: the light leaves from behind the glass, not beside it.
          pre-translated so .lh-beam's local origin is the lamp — the sweep must pivot there */}
      <g transform={`translate(${x} ${Y(LAMP_V)})`} pointerEvents="none">
        <g className="lh-beam">
          <g transform="rotate(-7)">
            {WEDGES.map(([t, b, o]) => (
              <path key={t} d={wedge(t, b)} fill={SNOW} opacity={o} />
            ))}
            {eye(9, 0, 1.5, 0.85, 0)}
            {eye(15.2, -2.6, 2.25, 0.95, 0.5)}
            {eye(17.6, 4, 2.2, 0.95, -0.5)}
          </g>
        </g>
      </g>

      <rect
        x={X(-4.8)}
        y={Y(-58)}
        width={9.6 * s}
        height={10 * s}
        fill={GLASS}
        stroke={INK_LINE}
        strokeWidth={1.3 * s}
      />
      <ellipse cx={x} cy={Y(-53.2)} rx={2.6 * s} ry={3.2 * s} fill={SNOW} />
      <path d={`M ${X(-6.9)} ${Y(-58)} L ${x} ${Y(-64.6)} L ${X(6.9)} ${Y(-58)} Z`} fill={ROOF} />
      <rect x={X(-0.7)} y={Y(-67.2)} width={1.4 * s} height={3 * s} fill={BRONZE} />
      <circle cx={x} cy={Y(-67.6)} r={1.7 * s} fill={BRONZE} />

      {/* gallery: deck, its dark underside so the overhang reads, then the rail across the lantern */}
      <rect x={X(-9)} y={Y(-48)} width={18 * s} height={2.8 * s} fill={STONE_L} />
      <rect x={X(-9)} y={Y(-45.2)} width={18 * s} height={1.2 * s} fill={INK_LINE} />
      <rect x={X(-8.6)} y={Y(-50.8)} width={17.2 * s} height={1.4 * s} fill={INK_LINE} />
      {[-6.6, -3.3, 0, 3.3, 6.6].map((u) => (
        <rect key={u} x={X(u - 0.5)} y={Y(-50.8)} width={1 * s} height={2.8 * s} fill={INK_LINE} />
      ))}
    </g>
  );
});

export const preview = {
  id: "lighthouse",
  region: "integrity-inlet",
  fill: "#6e8f6a",
  hw: 40,
  hh: 40,
  render: (p: LandmarkProps) => <Lighthouse {...p} y={p.y + 30} />,
};
