import { memo } from "react";
import { GLASS, INK_LINE, SHADOW, STONE_D, STONE_L, type LandmarkProps } from "./palette";

/** MapDecor's warm accent (FlagBanner alt, Boat sail); not exported from palette.ts. */
const KEYSTONE = "#f4a87a";
/** segmental arch: 38-unit span, 11.5-unit rise → intrados r 21.45 about a centre 9.95 below grade */
const R_IN = 21.45;
/** voussoir ring thickness 2.8 — the line that keeps the opening readable at 1x */
const R_OUT = 24.25;

const CROWN_IN = 11.5;
const CROWN_OUT = 14.3;
const SPRING_IN = 19;
const SPRING_OUT = 22.12;
const TOP = 18;

/** left: four tall ashlar courses, verticals running dead straight through all of them */
const L_COURSES = [4.5, 9, 13.5];
const L_VERTICALS = [-5, -11.5, -18, -24.5, -31, -37.5];
/** right: six short courses, verticals offset half a block each course */
const R_COURSES = [3, 6, 9, 12, 15];
const R_BANDS = [0, 3, 6, 9, 12, 15];

const PIERS = [-34.5, -23.3, -12.1, -0.9];
const BALUSTERS = [6.2, 10.4, 14.6, 18.8, 23, 27.2, 31.4];

export const TwoSidedBridge = memo(function TwoSidedBridge({ x, y, s = 1 }: LandmarkProps) {
  const u = (n: number) => n * s;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y - n * s;
  const M = (a: number, b: number) => `M ${px(a)} ${py(b)}`;
  const L = (a: number, b: number) => `L ${px(a)} ${py(b)}`;
  const A = (r: number, a: number, b: number, sweep: 0 | 1) =>
    `A ${u(r)} ${u(r)} 0 0 ${sweep} ${px(a)} ${py(b)}`;

  /** clip ids must not collide if the bridge is ever mounted twice (map + editor preview) */
  const uid = `tsb-${x}-${y}-${s}`.replace(/[^a-zA-Z0-9]/g, "_");

  const leftMass = `${M(-38, 0)} ${L(-33.8, TOP)} ${L(0, TOP)} ${L(0, CROWN_IN)} ${A(R_IN, -SPRING_IN, 0, 0)} Z`;
  const rightMass = `${M(40, 0)} ${L(40, 13.5)} ${L(31.5, 13.5)} ${L(31.5, TOP)} ${L(0, TOP)} ${L(0, CROWN_IN)} ${A(R_IN, SPRING_IN, 0, 1)} Z`;

  const joint = (a: number, b: number, c: number, d: number, key: string) => (
    <line
      key={key}
      x1={px(a)}
      y1={py(b)}
      x2={px(c)}
      y2={py(d)}
      stroke={INK_LINE}
      strokeWidth={u(0.9)}
      opacity={0.36}
    />
  );

  const voussoir = (deg: number, side: 1 | -1) => {
    const t = (deg * Math.PI) / 180;
    const sx = side * Math.sin(t);
    const cy = Math.cos(t);
    return (
      <line
        key={`v${side}${deg}`}
        x1={px(sx * R_IN)}
        y1={py(-9.95 + cy * R_IN)}
        x2={px(sx * R_OUT)}
        y2={py(-9.95 + cy * R_OUT)}
        stroke={INK_LINE}
        strokeWidth={u(0.8)}
        opacity={0.34}
      />
    );
  };

  return (
    <g>
      <defs>
        <clipPath id={`${uid}-l`}>
          <path d={leftMass} />
        </clipPath>
        <clipPath id={`${uid}-r`}>
          <path d={rightMass} />
        </clipPath>
      </defs>

      {/* the water the bridge crosses — one line, running clear past both feet */}
      <path
        d={`${M(-42, -0.6)} q ${u(10.5)} ${u(1.15)} ${u(21)} 0 t ${u(21)} 0 t ${u(21)} 0 t ${u(21)} 0`}
        fill="none"
        stroke={GLASS}
        strokeWidth={u(1.5)}
        strokeLinecap="round"
      />

      <ellipse cx={px(-28.5)} cy={py(-2)} rx={u(9)} ry={u(2.2)} fill={SHADOW} />
      <ellipse cx={px(29.5)} cy={py(-2)} rx={u(9.8)} ry={u(2.2)} fill={SHADOW} />

      {/* left build: blocky, strongly battered */}
      <path d={leftMass} fill={STONE_D} />
      {/* right build: longer, vertical face, stepped down to a lower shoulder */}
      <path d={rightMass} fill={STONE_L} />

      <g clipPath={`url(#${uid}-l)`}>
        {L_COURSES.map((b) => joint(-40, b, 0, b, `lc${b}`))}
        {L_VERTICALS.map((a) => joint(a, 0, a, TOP, `lv${a}`))}
      </g>
      <g clipPath={`url(#${uid}-r)`}>
        {R_COURSES.map((b) => joint(0, b, 42, b, `rc${b}`))}
        {R_BANDS.flatMap((b, i) =>
          Array.from({ length: 9 }, (_, k) => 2.5 + (i % 2) * 2.5 + k * 5).map((a) =>
            joint(a, b, a, b + 3, `rv${b}-${a}`)
          )
        )}
      </g>

      {/* voussoir ring, each half in the other half's stone */}
      <path
        d={`${M(-SPRING_OUT, 0)} ${A(R_OUT, 0, CROWN_OUT, 1)} ${L(0, CROWN_IN)} ${A(R_IN, -SPRING_IN, 0, 0)} Z`}
        fill={STONE_L}
      />
      <path
        d={`${M(SPRING_OUT, 0)} ${A(R_OUT, 0, CROWN_OUT, 0)} ${L(0, CROWN_IN)} ${A(R_IN, SPRING_IN, 0, 1)} Z`}
        fill={STONE_D}
      />
      {[26, 48, 70].map((deg) => voussoir(deg, -1))}
      {[26, 48, 70].map((deg) => voussoir(deg, 1))}
      {/* intrados line: STONE_D is near-isoluminant with the cove fill, so the right half
          of the opening needs this edge to hold the arch at 1x */}
      <path
        d={`${M(-SPRING_IN, 0)} ${A(R_IN, SPRING_IN, 0, 1)}`}
        fill="none"
        stroke={INK_LINE}
        strokeWidth={u(0.9)}
        opacity={0.34}
      />

      {/* deck soffit shadow, kept inside the masonry it falls on */}
      <rect x={px(-33.5)} y={py(TOP)} width={u(65)} height={u(1.2)} fill={INK_LINE} opacity={0.28} />

      {/* keystone: a wedge held between the two masonries, jammed under the deck */}
      <path d={`${M(-3.6, CROWN_IN - 0.3)} ${L(3.6, CROWN_IN - 0.3)} ${L(7.1, TOP)} ${L(-7.1, TOP)} Z`} fill={KEYSTONE} />

      {/* one shared crossing: thin deck, then slim posts under a continuous rail */}
      <rect x={px(-36.5)} y={py(21.2)} width={u(70.5)} height={u(3.2)} fill={STONE_L} />
      {PIERS.map((a) => (
        <rect key={a} x={px(a)} y={py(24.6)} width={u(4.5)} height={u(3.4)} fill={STONE_L} />
      ))}
      {BALUSTERS.map((a) => (
        <rect key={a} x={px(a)} y={py(24.6)} width={u(1.4)} height={u(3.4)} fill={STONE_L} />
      ))}
      <rect x={px(-36.5)} y={py(25.9)} width={u(70.5)} height={u(1.3)} fill={STONE_L} />
    </g>
  );
});

export const preview = {
  id: "two-sided-bridge",
  region: "cooperation-cove",
  fill: "#a8636e",
  hw: 44,
  hh: 26,
  render: (p: LandmarkProps) => <TwoSidedBridge {...p} y={p.y + 10} />,
};
