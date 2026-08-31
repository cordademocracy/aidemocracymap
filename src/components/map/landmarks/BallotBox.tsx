import { memo } from "react";
import {
  BRONZE,
  INK_LINE,
  OCHRE_EDGE,
  PENNANT,
  SHADOW,
  SNOW,
  STONE_D,
  STONE_L,
  TRUNK,
  type LandmarkProps,
} from "./palette";

/** Voting Village: a sealed oak chest standing on the ground under a stone lid,
 * one folded ballot half-swallowed by the slot cut through it, wax across the
 * joint and a padlock hung from the hasp. Secrecy plus tamper-evidence, drawn
 * boring on purpose because trust technology usually is. */
export const BallotBox = memo(function BallotBox({ x, y, s = 1 }: LandmarkProps) {
  const e = 1.2 * s;
  const u = (n: number) => n * s;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${px(a)},${py(b)}`).join(" ");
  const uid = `bb-${x}-${y}-${s}`.replace(/[^a-zA-Z0-9]/g, "_");

  return (
    <g>
      {/* -25.6 is the swallow line: the card clip and the front-lip overdraw both key
          off it, so moving the slot means moving both */}
      <defs>
        <clipPath id={`${uid}-slot`}>
          <rect x={px(-32)} y={py(-72)} width={u(64)} height={u(46.4)} />
        </clipPath>
      </defs>

      {/* outside the hit region on purpose: it reaches within 37 units of a node
          centre, the chest and lid stay past 40 */}
      <ellipse cx={px(0)} cy={py(1.2)} rx={u(17)} ry={u(3.6)} fill={SHADOW} pointerEvents="none" />

      <rect x={px(-11.6)} y={py(-2.2)} width={u(23.2)} height={u(2.2)} fill={INK_LINE} />
      <rect x={px(-10.8)} y={py(-19.6)} width={u(21.6)} height={u(17.4)} fill={TRUNK} />
      <rect x={px(-10.8)} y={py(-19.6)} width={u(21.6)} height={u(1.3)} fill={INK_LINE} opacity={0.3} />
      {[-15.2, -11.4].map((v) => (
        <rect key={v} x={px(-10.8)} y={py(v)} width={u(21.6)} height={u(0.7)} fill={INK_LINE} opacity={0.22} />
      ))}

      <rect
        x={px(-10.8)}
        y={py(-7.2)}
        width={u(21.6)}
        height={u(2.8)}
        fill={BRONZE}
        stroke={OCHRE_EDGE}
        strokeWidth={e}
      />

      {/* shackle first: the lock body swallows its legs, the hasp tongue its crown */}
      <g transform={`rotate(4 ${px(0)} ${py(-19.4)})`}>
        <path
          d={`M ${px(-2.4)} ${py(-13)} L ${px(-2.4)} ${py(-17)}
              A ${u(2.4)} ${u(2.4)} 0 0 1 ${px(2.4)} ${py(-17)} L ${px(2.4)} ${py(-13)}`}
          fill="none"
          stroke={INK_LINE}
          strokeWidth={u(1.4)}
        />
        <polygon
          points={poly([
            [-3.6, -12.7], [-2.7, -13.6], [2.7, -13.6], [3.6, -12.7],
            [3.6, -10.3], [2.7, -9.4], [-2.7, -9.4], [-3.6, -10.3],
          ])}
          fill={BRONZE}
          stroke={OCHRE_EDGE}
          strokeWidth={e}
          strokeLinejoin="round"
        />
        <circle cx={px(0)} cy={py(-11.5)} r={u(0.85)} fill={INK_LINE} />
      </g>

      {/* lid: one silhouette in the shaded stone, its lit top plane laid over the face */}
      <polygon
        points={poly([[-12.4, -19.6], [12.4, -19.6], [12.4, -22.2], [9.4, -28.4], [-9.4, -28.4], [-12.4, -22.2]])}
        fill={STONE_D}
        stroke={OCHRE_EDGE}
        strokeWidth={e}
        strokeLinejoin="round"
      />
      <polygon points={poly([[-12.4, -22.2], [12.4, -22.2], [9.4, -28.4], [-9.4, -28.4]])} fill={STONE_L} />

      {/* wax across the lid-to-chest joint */}
      <circle cx={px(-8.4)} cy={py(-19.6)} r={u(1.5)} fill={PENNANT} />

      <polygon
        points={poly([[-1.4, -22], [1.4, -22], [1.4, -18.4], [0.75, -17.6], [-0.75, -17.6], [-1.4, -18.4]])}
        fill={BRONZE}
        stroke={OCHRE_EDGE}
        strokeWidth={e}
        strokeLinejoin="round"
      />
      <circle cx={px(0)} cy={py(-19.4)} r={u(0.5)} fill={INK_LINE} />

      <polygon points={poly([[-8.4, -23.8], [8.4, -23.8], [7.4, -26.8], [-7.4, -26.8]])} fill={INK_LINE} />

      <g clipPath={`url(#${uid}-slot)`}>
        <g className="bb-card">
          <g transform={`rotate(-7 ${px(0)} ${py(-25.6)})`}>
            {/* the tail runs far below the clip so a dropped card never shows its bottom edge */}
            <rect
              x={px(-5.4)}
              y={py(-31.6)}
              width={u(10.8)}
              height={u(17.6)}
              fill={SNOW}
              stroke={OCHRE_EDGE}
              strokeWidth={e}
            />
            <rect x={px(-5.4)} y={py(-29.2)} width={u(10.8)} height={u(0.65)} fill={INK_LINE} />
          </g>
        </g>
      </g>

      <polygon points={poly([[-8.4, -23.8], [8.4, -23.8], [7.8, -25.6], [-7.8, -25.6]])} fill={INK_LINE} />
    </g>
  );
});

export const preview = {
  id: "ballot-box",
  region: "voting-village",
  fill: "#ba8c49",
  hw: 22,
  hh: 21,
  render: (p: LandmarkProps) => <BallotBox {...p} y={p.y + 12.7} />,
};
