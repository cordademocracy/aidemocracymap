import { memo } from "react";
import {
  PINE_D,
  PINE_EDGE,
  PINE_L,
  SHADOW,
  STONE_D,
  STONE_L,
  TRUNK,
  type LandmarkProps,
} from "./palette";

/** cx, cy, rx, ry */
type Lobe = [number, number, number, number];

/** the crown is the union of these; every cusp where two meet is a lump in the
 * silhouette, which is what separates an oak from a shrub */
const CROWN: Lobe[] = [
  [-10, -35.6, 9.5, 8],
  [8, -33.1, 10, 7.5],
  [-15, -25.1, 10, 8],
  [14, -25.6, 10, 8],
  [-1, -28.1, 7.5, 5.5],
  [-22, -21.6, 5.5, 4.5],
  [21, -22.1, 5.5, 4.5],
];

/** the shade is the crown itself dropped down-left and clipped back to it, so the
 * terminator echoes the canopy's own lumps and can never escape the silhouette */
const SHADE_DX = -4;
const SHADE_DY = 11;

/** declared weight halves once the second pass covers every interior arc */
const EDGE_W = 2.4;

/** Funding Forest: the tree every pine in the district grows under, with the
 * foundation's cornerstone lying on the ground against its root flare. */
export const EndowmentOak = memo(function EndowmentOak({ x, y, s = 1 }: LandmarkProps) {
  const p = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  const lobe = (l: Lobe, key: string, props: Record<string, unknown>) => (
    <ellipse key={key} cx={x + l[0] * s} cy={y + l[1] * s} rx={l[2] * s} ry={l[3] * s} {...props} />
  );
  /** must not collide if the oak is ever mounted twice (map + editor preview) */
  const uid = `oak-${x}-${y}-${s}`.replace(/[^a-zA-Z0-9]/g, "_");

  /** bole and both root wedges are one mass; the roots break to the ground at a
   * visible angle and the ground line scoops up between them */
  const mass = `M ${p(-15, 0)}
    L ${p(-9.6, -3.5)} L ${p(-6.8, -10)}
    C ${p(-6.4, -13.6)} ${p(-6, -17.6)} ${p(-5.9, -21.6)}
    C ${p(-5.8, -26.6)} ${p(-5.6, -29.6)} ${p(-5.5, -32.6)}
    L ${p(5.5, -32.6)}
    C ${p(5.6, -29.6)} ${p(5.8, -26.6)} ${p(5.9, -21.6)}
    C ${p(6, -17.6)} ${p(6.4, -13.6)} ${p(6.8, -10)}
    L ${p(9.6, -3.5)} L ${p(15, 0)}
    C ${p(9.2, 1)} ${p(5.6, -1.2)} ${p(0, -1.2)}
    C ${p(-5.6, -1.2)} ${p(-9.2, 1)} ${p(-15, 0)} Z`;

  /** turned flank: a third of the bole, stopping short of the root break */
  const boleShade = `M ${p(-6.8, -10)}
    C ${p(-6.4, -13.6)} ${p(-6, -17.6)} ${p(-5.9, -21.6)}
    C ${p(-5.8, -26.6)} ${p(-5.6, -29.6)} ${p(-5.5, -32.6)}
    L ${p(-3, -32.6)}
    C ${p(-3.1, -28.6)} ${p(-3.3, -24.6)} ${p(-3.4, -20.6)}
    C ${p(-3.5, -16.6)} ${p(-3.9, -13.1)} ${p(-4.5, -10)} Z`;

  /** the left wedge turns away from the light; the right one keeps its lit top plane */
  const rootShadeL = `M ${p(-6.8, -10)}
    L ${p(-9.6, -3.5)} L ${p(-14.4, -0.3)}
    C ${p(-10.4, 0.6)} ${p(-7.6, -1)} ${p(-6.1, -1.1)}
    L ${p(-4.7, -7.2)} Z`;

  return (
    <g>
      <defs>
        <clipPath id={uid}>{CROWN.map((l, i) => lobe(l, `c${i}`, {}))}</clipPath>
      </defs>

      <ellipse cx={x + 2.2 * s} cy={y + 0.8 * s} rx={19.5 * s} ry={4.8 * s} fill={SHADOW} />

      <path d={mass} fill={TRUNK} />
      <path d={boleShade} fill={SHADOW} />
      <path d={rootShadeL} fill={SHADOW} />

      {/* cornerstone: set down on the ground across the right root, top face turned to the sky */}
      <path d={`M ${p(11, -3.8)} L ${p(20, -3.8)} L ${p(20, 0)} L ${p(11, 0)} Z`} fill={STONE_D} />
      <path d={`M ${p(11, -3.8)} L ${p(9, -6.8)} L ${p(18, -6.8)} L ${p(20, -3.8)} Z`} fill={STONE_L} />

      {/* crown in two passes: stroked lobes, then the same lobes filled — the fills
          bury every interior arc, so only the union's outer edge keeps half a stroke */}
      {CROWN.map((l, i) =>
        lobe(l, `e${i}`, { fill: PINE_L, stroke: PINE_EDGE, strokeWidth: EDGE_W * s })
      )}
      {CROWN.map((l, i) => lobe(l, `f${i}`, { fill: PINE_L }))}
      <g clipPath={`url(#${uid})`}>
        {CROWN.map((l, i) =>
          lobe([l[0] + SHADE_DX, l[1] + SHADE_DY, l[2], l[3]], `s${i}`, { fill: PINE_D })
        )}
      </g>
    </g>
  );
});

export const preview = {
  id: "endowment-oak",
  region: "funding-forest",
  fill: "#5a7a4a",
  hw: 30,
  hh: 30,
  render: (p: LandmarkProps) => <EndowmentOak {...p} y={p.y + 20} />,
};
