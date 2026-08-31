import { memo } from "react";
import {
  BRONZE,
  GLASS,
  INK_LINE,
  M_DARK,
  M_LIGHT,
  ROOF,
  SHADOW,
  STONE_D,
  STONE_L,
  type LandmarkProps,
} from "./palette";

/** column left edges relative to the temple axis; 5 wide (the aliasing floor),
 * 2.5 apart so the intercolumniation survives 1x */
const COLUMN_DX = [-17.5, -10, -2.5, 5, 12.5];
/** seating rows back-to-front: [x0, y0, x1, y1, sag]. Each row owns its sag and
 * its flank ends. The x0 values are the treads of `bowl`'s left staircase, so a
 * row moved here must move there too or its band escapes the cut. Moving an end
 * changes the arc: keep sag = midY − (y0+y1)/2 (mids −17.9 / −13.1 / −8.3). */
const ROWS: [number, number, number, number, number][] = [
  [-19.1, -21.8, 13.05, -22.8, 4.4],
  [-14.4, -17.5, 12.2, -18.3, 4.8],
  [-11.5, -12.8, 10.8, -13.6, 4.9],
];
const RISER_H = 2.6;

/** the shed's three LEDs, staggered the way the Stoa's clauses are: periods that
 * share no common multiple, negative delays to spread them on load */
const LEDS = [
  { dx: 20.9, blink: { animationDuration: "3.7s", animationDelay: "-2.4s" } },
  { dx: 23.5, blink: { animationDuration: "5.9s", animationDelay: "-0.9s" } },
  { dx: 26.1, blink: { animationDuration: "4.6s", animationDelay: "-3.3s" } },
];

/** Deliberation Delta: a temple crowning the rock, the Pnyx cut into its foot —
 * and a server shed wired into the speaker's platform. */
export const AcropolisAssembly = memo(function AcropolisAssembly({ x, y, s = 1 }: LandmarkProps) {
  const u = (n: number) => n * s;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const P = (a: number, b: number) => `${px(a)} ${py(b)}`;

  /** quadratic whose midpoint sags `sag` below the chord */
  const arcTo = (x0: number, y0: number, x1: number, y1: number, sag: number) =>
    `Q ${P((x0 + x1) / 2, (y0 + y1) / 2 + 2 * sag)} ${P(x1, y1)}`;
  const band = (x0: number, y0: number, x1: number, y1: number, sag: number, h = RISER_H) =>
    `M ${P(x0, y0)} ${arcTo(x0, y0, x1, y1, sag)} L ${P(x1, y1 + h)}` +
    ` ${arcTo(x1, y1 + h, x0, y0 + h, sag)} Z`;

  const tx = 5; // temple axis
  const bx = -0.5; // bema axis, on the lip arc's low point

  /** table rock: shelves stepping down the shaded left slope, sheer lit cliff right */
  const crag =
    `M ${P(-33, 1)} L ${P(-29, -11)} L ${P(-24.5, -12.5)} L ${P(-22, -24)} L ${P(-20.5, -25.8)}` +
    ` L ${P(-17.5, -26.1)} L ${P(-17.5, -28.6)} L ${P(27.5, -29)} L ${P(33.5, 1)} Z`;
  const cragShade =
    `M ${P(-17.5, -28.6)} L ${P(-20, -18)} L ${P(-19, 1)} L ${P(-33, 1)} L ${P(-29, -11)}` +
    ` L ${P(-24.5, -12.5)} L ${P(-22, -24)} L ${P(-20.5, -25.8)} L ${P(-17.5, -26.1)} Z`;

  /** the cut itself: sheer on the right, a staircase of rock on the left where
   * each row of seating dies at its own depth into the shaded slope */
  const bowl =
    `M ${P(-19.6, -24)} ${arcTo(-19.6, -24, 14, -25, 4.4)} L ${P(11.5, -11.6)}` +
    ` ${arcTo(11.5, -11.6, -12, -10, 7.3)} L ${P(-12, -14.3)} L ${P(-14.9, -14.7)}` +
    ` L ${P(-14.9, -18.6)} L ${P(-19.6, -19)} Z`;

  return (
    <g>
      <ellipse cx={px(0)} cy={py(4)} rx={u(34)} ry={u(5)} fill={SHADOW} />

      <path d={crag} fill={M_LIGHT} />
      <path d={cragShade} fill={M_DARK} />

      {/* Pnyx: bowl carved out of the rock, three risers stepping down to the lip */}
      <path d={bowl} fill={STONE_L} />
      <path d={band(-19.4, -24, 13.5, -25, 4.4, 2.2)} fill={SHADOW} />
      {ROWS.map(([x0, y0, x1, y1, sag]) => (
        <path key={y0} d={band(x0, y0, x1, y1, sag)} fill={STONE_D} />
      ))}

      {/* bema straddling the lip, one speaker leaning into the rows */}
      <rect x={px(bx - 5.5)} y={py(-8.2)} width={u(11)} height={u(1.2)} fill={STONE_L} />
      <rect x={px(bx - 5.5)} y={py(-7)} width={u(11)} height={u(2.8)} fill={STONE_D} />
      <path
        d={`M ${P(bx - 2.5, -8.2)} L ${P(bx - 2.3, -14)} L ${P(bx + 0.5, -14)} L ${P(bx + 2.5, -8.2)} Z`}
        fill={INK_LINE}
      />
      <path
        d={`M ${P(bx + 0.2, -13.2)} L ${P(bx + 2.9, -16)}`}
        stroke={INK_LINE}
        strokeWidth={u(1.1)}
        strokeLinecap="round"
      />
      <circle cx={px(bx - 1.4)} cy={py(-15.6)} r={u(1.4)} fill={INK_LINE} />

      {/* temple, seated on the plateau */}
      <ellipse cx={px(tx)} cy={py(-28)} rx={u(20)} ry={u(2.6)} fill={SHADOW} />
      <rect x={px(tx - 20.5)} y={py(-30.6)} width={u(41)} height={u(2.2)} fill={STONE_D} />
      <rect x={px(tx - 19)} y={py(-33)} width={u(38)} height={u(2.4)} fill={STONE_L} />
      <rect x={px(tx - 17.5)} y={py(-42)} width={u(35)} height={u(9)} fill={INK_LINE} />
      {COLUMN_DX.map((dx) => (
        <g key={dx}>
          <rect x={px(tx + dx)} y={py(-42)} width={u(1.3)} height={u(9)} fill={STONE_D} />
          <rect x={px(tx + dx + 1.3)} y={py(-42)} width={u(3.7)} height={u(9)} fill={STONE_L} />
        </g>
      ))}
      <rect x={px(tx - 18.5)} y={py(-43)} width={u(37)} height={u(1)} fill={STONE_D} />
      <rect x={px(tx - 18.5)} y={py(-46.5)} width={u(37)} height={u(3.5)} fill={STONE_L} />
      <path d={`M ${P(tx - 19.5, -46.5)} L ${P(tx, -53)} L ${P(tx + 19.5, -46.5)} Z`} fill={STONE_L} />
      <path d={`M ${P(tx - 14.5, -47.4)} L ${P(tx, -52)} L ${P(tx + 14.5, -47.4)} Z`} fill={ROOF} />
      <circle cx={px(tx)} cy={py(-54.3)} r={u(1.3)} fill={BRONZE} />

      {/* the shed nobody voted on */}
      <rect x={px(17.2)} y={py(0)} width={u(11.6)} height={u(0.9)} fill={INK_LINE} />
      <rect x={px(18)} y={py(-9.2)} width={u(10)} height={u(9.2)} fill={STONE_D} />
      <rect x={px(17)} y={py(-11.2)} width={u(12)} height={u(2)} fill={INK_LINE} />
      <rect x={px(20)} y={py(-14.2)} width={u(3)} height={u(3)} fill={INK_LINE} />
      <rect x={px(19)} y={py(-6.4)} width={u(8.5)} height={u(3.6)} fill={INK_LINE} />
      {LEDS.map((l) => (
        <circle
          key={l.dx}
          className="shed-led"
          style={l.blink}
          cx={px(l.dx)}
          cy={py(-4.6)}
          r={u(1.15)}
          fill={GLASS}
        />
      ))}

      <path
        d={`M ${P(18, -2)} C ${P(14.5, -1.2)}, ${P(10, -2.6)}, ${P(5.7, -5)}`}
        stroke={INK_LINE}
        strokeWidth={u(0.95)}
        strokeLinecap="round"
        fill="none"
      />
      <rect x={px(5.1)} y={py(-6)} width={u(1.6)} height={u(1.6)} fill={INK_LINE} />
    </g>
  );
});

export const preview = {
  id: "acropolis-assembly",
  region: "deliberation-delta",
  fill: "#4a7d9c",
  hw: 36,
  hh: 34,
  render: (p: LandmarkProps) => <AcropolisAssembly {...p} y={p.y + 23} />,
};
