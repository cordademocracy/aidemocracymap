import { memo } from "react";
import {
  BRONZE,
  GLASS,
  INK_LINE,
  M_DARK,
  SHADOW,
  SNOW,
  STONE_D,
  STONE_L,
  TRUNK,
  type LandmarkProps,
} from "./palette";

/** Research Range: a domed rotunda with one wing still going up.
 * The telescope barrel must clear the dome — it is the whole silhouette. */
export const Observatory = memo(function Observatory({ x, y, s = 1 }: LandmarkProps) {
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${px(a)},${py(b)}`).join(" ");
  /** barrel frame: t along the 35° tube, p across it, about the pivot (1, -20.5) */
  const bx = (t: number) => px(1 + t);
  const bp = (p: number) => py(-20.5 + p);
  const bar = (pts: [number, number][]) => pts.map(([t, p]) => `${bx(t)},${bp(p)}`).join(" ");

  return (
    <g>
      <ellipse cx={px(-2.6)} cy={py(2.4)} rx={19.5 * s} ry={4.4 * s} fill={SHADOW} />

      {/* unfinished wing: courses stepping up toward the drum */}
      <polygon
        points={poly([[-19.2, 1.2], [-19.2, -8.4], [-17.4, -8.4], [-17.4, -9.6], [-14.6, -9.6], [-14.6, -12.4], [-12.2, -12.4], [-12.2, 1.2]])}
        fill={STONE_D}
      />
      {/* drum: shaded face wider, lit face flaring at the base so the cylinder turns */}
      <polygon points={poly([[-13.6, 1.2], [-12.6, -16], [1.5, -16], [2.1, 1.2]])} fill={STONE_D} />
      <polygon points={poly([[1.5, -16], [12.6, -16], [13.6, 1.2], [2.1, 1.2]])} fill={STONE_L} />
      {/* lit top face on each course — the only thing separating the wing from the shaded drum */}
      {([[-19.2, -8.4, 1.8], [-17.4, -9.6, 2.8], [-14.6, -12.4, 1.79]] as [number, number, number][]).map(([sx, ty, w]) => (
        <rect key={sx} x={px(sx)} y={py(ty)} width={w * s} height={1 * s} fill={STONE_L} />
      ))}

      {/* the dome must overhang the drum on both sides — that cap is the observatory read */}
      <path d={`M ${px(-14.6)} ${py(-16)} A ${14.6 * s} ${12.4 * s} 0 0 1 ${px(14.6)} ${py(-16)} Z`} fill={SNOW} />
      <path
        d={`M ${px(-14.6)} ${py(-16)} A ${14.6 * s} ${12.4 * s} 0 0 1 ${px(-4)} ${py(-27.9)} L ${px(-1.5)} ${py(-16)} Z`}
        fill={STONE_D}
      />

      <g transform={`rotate(-35 ${px(1)} ${py(-20.5)})`}>
        {/* slit stops short of the rim; the barrel covers its upper lip */}
        <polygon points={bar([[1.2, -1.8], [7.9, -1.8], [9.8, 3.8], [1.2, 3.8]])} fill={INK_LINE} />
        <polygon points={bar([[1.4, -2.4], [20.3, -3.2], [20.3, 3.2], [1.4, 2.4]])} fill={M_DARK} />
        <path d={`M ${bx(1.4)} ${bp(-2.4)} L ${bx(20.3)} ${bp(-3.2)}`} stroke={INK_LINE} strokeWidth={0.9 * s} fill="none" />
        <polygon points={bar([[5, -3], [7.6, -3], [7.6, 3], [5, 3]])} fill={BRONZE} />
        <polygon points={bar([[19, -3.2], [20.3, -3.2], [20.3, 3.2], [19, 3.2]])} fill={GLASS} />
      </g>

      {/* the two horizontals that survive at map scale on the shaded side */}
      <rect x={px(-14.6)} y={py(-16)} width={29.2 * s} height={1.5 * s} fill={INK_LINE} />
      <rect x={px(-20)} y={py(-3.4)} width={34.8 * s} height={4.6 * s} fill={STONE_D} />
      <rect x={px(-20)} y={py(-3.4)} width={34.8 * s} height={1.6 * s} fill={STONE_L} />

      {/* drawn after the plinth so the door cuts through the base course */}
      <path
        d={`M ${px(5)} ${py(1.2)} L ${px(5)} ${py(-4.4)} a ${2 * s} ${2 * s} 0 0 1 ${4 * s} 0 L ${px(9)} ${py(1.2)} Z`}
        fill={INK_LINE}
      />
      {/* one window course marching round the drum: widest facing the viewer, narrowing at the turn */}
      {([[-9, 1.25], [-4.4, 1.55], [0.2, 1.7], [4.8, 1.6]] as [number, number][]).map(([wx, w]) => (
        <path
          key={wx}
          d={`M ${px(wx)} ${py(-9)} L ${px(wx)} ${py(-11.9 + w / 2)} a ${(w / 2) * s} ${(w / 2) * s} 0 0 1 ${w * s} 0 L ${px(wx + w)} ${py(-9)} Z`}
          fill={INK_LINE}
        />
      ))}

      {/* scaffolding: staggered against the wing only, never reaching the dome */}
      {([[-18.2, -12.6], [-15.4, -14.4], [-12.6, -13.4]] as [number, number][]).map(([dx, top]) => (
        <rect key={dx} x={px(dx)} y={py(top)} width={1.25 * s} height={(1.2 - top) * s} fill={TRUNK} />
      ))}
      <rect x={px(-18.2)} y={py(-4.5)} width={6.85 * s} height={1.2 * s} fill={TRUNK} />
      <rect x={px(-18.2)} y={py(-10.6)} width={4.05 * s} height={1.2 * s} fill={TRUNK} />
      <path d={`M ${px(-17.6)} ${py(-4.5)} L ${px(-14.8)} ${py(-10.6)}`} stroke={TRUNK} strokeWidth={1.1 * s} />
    </g>
  );
});

export const preview = {
  id: "observatory",
  region: "research-range",
  fill: "#2f7d86",
  hw: 23,
  hh: 23,
  render: (p: LandmarkProps) => <Observatory {...p} y={p.y + 14} />,
};
