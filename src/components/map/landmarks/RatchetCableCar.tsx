import { memo } from "react";
import { useReducedMotion } from "../../MapDecor";
import {
  BRONZE,
  GLASS,
  INK_LINE,
  ROOF,
  SHADOW,
  STONE_D,
  TRUNK,
  WALL,
  type LandmarkProps,
} from "./palette";

/** cable in local units, emitted through a coordinate mapper: once into canvas
 * space for the drawn line, once as an offset from the gondola's rest hang point
 * for its motion path — that second form is a pure delta, so the cabin sits on
 * the cable whether or not the SMIL runs. */
const cable = (fx: (n: number) => number, fy: (n: number) => number) =>
  `M ${fx(-30.6)} ${fy(-9.4)} Q ${fx(0.4)} ${fy(-8.45)} ${fx(31)} ${fy(-19.5)} L ${fx(38.2)} ${fy(-22.1)}`;

/** the ratchet: 24s of creep from just clear of the low pylon to the cable's
 * open end, then the repeat cuts it back — a glide back down would say the
 * climb is reversible. Fractions are arc length; keyPoints needs both partners
 * or the run silently covers the whole path. */
const TRAVEL = "0.13;1";
const TRAVEL_DUR = "24s";
/** the cabin fades up just clear of the low pylon and out at the open end, so
 * the repeat's cut back down the cable happens at opacity 0: the climb is never
 * seen running backwards. Same timeline as the motion, so the two cannot drift. */
const FADE_TIMES = "0;0.06;0.92;1";
const FADE_VALUES = "0;1;1;0";

/** Power Peaks: one gondola on a cable that climbs the flank, passes the last
 * pylon and simply ends in open air. Anchor is the object's horizontal centre
 * on the lower pylon's ground line. */
export const RatchetCableCar = memo(function RatchetCableCar({ x, y, s = 1 }: LandmarkProps) {
  const reducedMotion = useReducedMotion();
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${px(a)},${py(b)}`).join(" ");

  /** Gondola hang point, evaluated on the cable curve at t = 0.74 — move the Q
   * control and it detaches. */
  const gx = 15.06;
  const gy = -14.57;
  const dx = (n: number) => (n - gx) * s;
  const dy = (n: number) => (n - gy) * s;

  const post = (cx: number, base: number, top: number, capHalf: number) => (
    <>
      <ellipse cx={px(cx)} cy={py(base + 0.9)} rx={6.4 * s} ry={1.7 * s} fill={SHADOW} />
      <polygon points={poly([[cx - 2.1, base], [cx + 2.1, base], [cx + 1.7, top], [cx - 1.7, top]])} fill={TRUNK} />
      <rect x={px(cx - 2.6)} y={py(base - 1.2)} width={5.2 * s} height={1.2 * s} fill={INK_LINE} />
      <rect
        x={px(cx - capHalf)}
        y={py(top - 1.3)}
        width={capHalf * 2 * s}
        height={1.3 * s}
        fill={INK_LINE}
      />
    </>
  );

  return (
    <g>
      {post(-33, 0, -8.1, 2.4)}
      {post(31, -4, -18.2, 2)}

      {/* leaves the low post level, climbs, overruns the last pylon and stops */}
      <path
        d={cable(px, py)}
        fill="none"
        stroke={INK_LINE}
        strokeWidth={2 * s}
        strokeLinecap="butt"
      />

      <g>
        {!reducedMotion && (
          <>
            <animateMotion
              dur={TRAVEL_DUR}
              repeatCount="indefinite"
              calcMode="linear"
              keyPoints={TRAVEL}
              keyTimes="0;1"
              path={cable(dx, dy)}
            />
            <animate
              attributeName="opacity"
              dur={TRAVEL_DUR}
              repeatCount="indefinite"
              calcMode="linear"
              keyTimes={FADE_TIMES}
              values={FADE_VALUES}
            />
          </>
        )}
        <rect x={px(gx - 0.85)} y={py(gy - 0.5)} width={1.7 * s} height={2 * s} fill={INK_LINE} />

        <polygon
          points={poly([[gx - 7.8, gy + 1.5], [gx - 4.8, gy + 3.8], [gx - 4.2, gy + 8.4], [gx - 7.2, gy + 6.1]])}
          fill={STONE_D}
        />
        <polygon
          points={poly([[gx - 4.8, gy + 3.8], [gx + 5.6, gy + 3.8], [gx + 5, gy + 8.4], [gx - 4.2, gy + 8.4]])}
          fill={WALL}
        />
        <polygon
          points={poly([[gx - 8.2, gy + 1.5], [gx + 3.4, gy + 1.5], [gx + 6.4, gy + 3.8], [gx - 5.2, gy + 3.8]])}
          fill={ROOF}
          stroke={INK_LINE}
          strokeWidth={0.7 * s}
          strokeLinejoin="round"
        />
        <rect
          x={px(gx - 2.8)}
          y={py(gy + 4.9)}
          width={6.4 * s}
          height={2.5 * s}
          fill={GLASS}
          stroke={INK_LINE}
          strokeWidth={0.8 * s}
        />
        <polygon
          points={poly([[gx - 4.2, gy + 8.4], [gx + 5, gy + 8.4], [gx + 4.85, gy + 9.3], [gx - 4.05, gy + 9.3]])}
          fill={INK_LINE}
        />

        {/* toothed grip biting the cable — the one-way catch */}
        <g transform={`rotate(-14.5 ${px(gx)} ${py(gy)})`}>
          <path
            d={`M ${px(gx - 2.3)} ${py(gy - 2)} L ${px(gx - 0.77)} ${py(gy - 0.3)} L ${px(gx - 0.77)} ${py(gy - 2)}
                L ${px(gx + 0.77)} ${py(gy - 0.3)} L ${px(gx + 0.77)} ${py(gy - 2)}
                L ${px(gx + 2.3)} ${py(gy - 0.3)} L ${px(gx + 2.3)} ${py(gy - 2)}
                L ${px(gx + 1.6)} ${py(gy - 3.4)} L ${px(gx - 1.6)} ${py(gy - 3.4)} Z`}
            fill={BRONZE}
            stroke={INK_LINE}
            strokeWidth={0.6 * s}
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  );
});

export const preview = {
  id: "ratchet-cablecar",
  region: "power-peaks",
  fill: "#c2673a",
  hw: 44,
  hh: 16,
  render: (p: LandmarkProps) => <RatchetCableCar {...p} y={p.y + 10.4} />,
};
