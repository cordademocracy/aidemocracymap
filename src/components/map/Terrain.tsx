import { memo } from "react";
import type { Region } from "../../data/regions";
import { fractalBlobPath, hashString, mulberry32 } from "../../lib/geometry";
import {
  Boat,
  Castle,
  CloudPuff,
  FlagBanner,
  Flock,
  House,
  Islet,
  Mountain,
  MountainRange,
  Pine,
  PineCluster,
} from "../MapDecor";
import { RegionLandmark } from "./landmarks";

export const OceanDecor = memo(function OceanDecor() {
  return (
    <g>
      {[
        [265, 690, 1], [1452, 470, -1], [368, 262, 1], [1330, 908, -1],
      ].map(([x, y, dir], i) => (
        <Boat key={i} x={x} y={y} dir={dir} s={0.9} />
      ))}
      {/* distant shallows */}
      {[
        [240, 180, 1], [1400, 160, 1.2], [180, 850, 0.9], [1520, 720, 1.1],
      ].map(([x, y, s], i) => (
        <g key={`s${i}`} opacity="0.08" fill="#ffffff">
          <ellipse cx={x} cy={y} rx={34 * s} ry={12 * s} />
          <ellipse cx={x + 24 * s} cy={y - 8 * s} rx={22 * s} ry={10 * s} />
        </g>
      ))}
      {/* wave flecks */}
      {[
        [420, 140], [980, 120], [1480, 350], [1500, 600], [300, 940], [900, 960], [150, 500], [1230, 130], [640, 80], [80, 700],
      ].map(([x, y], i) => (
        <path
          key={`w${i}`}
          d={`M ${x - 9} ${y} q 4.5 -5 9 0 q 4.5 5 9 0`}
          fill="none"
          stroke="#8fa8c9"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
      ))}
      <Islet x={235} y={225} s={0.9} seed={11} />
      <Islet x={1500} y={868} s={0.7} seed={23} />
    </g>
  );
});

/** Coastline noise — big bays, medium coves, fine jitter (organic). */
const COAST_OCTAVES = [
  { freq: 6, amp: 0.11 },
  { freq: 13, amp: 0.055 },
  { freq: 29, amp: 0.028 },
];
/** District borders — gentler than the coast so they read as inland ridges,
 * but still visibly organic (lobed bays, not smooth ellipses). */
const REGION_OCTAVES = [
  { freq: 5, amp: 0.095 },
  { freq: 11, amp: 0.05 },
  { freq: 23, amp: 0.026 },
];

/**
 * The island as a 2.5D extruded slab. The top surface is a fractal coastline;
 * the slab SIDE is the same coast path drawn as stacked darker copies shifted
 * straight down by a fixed thickness T, so it reads as a solid plate seen from
 * slightly above. Extrusion is drawn BELOW/behind the surface only — the top
 * surface stays at offset 0, so all node/decor/region coordinates are unchanged.
 */
export const IslandBase = memo(function IslandBase() {
  const seed = hashString("island-base");
  const T = 30; // slab thickness (map units)
  const coast = fractalBlobPath(880, 565, 604, 394, seed, 96, COAST_OCTAVES);
  const green = fractalBlobPath(880, 565, 572, 370, seed + 31, 96, COAST_OCTAVES);
  return (
    <g>
      {/* soft drop shadow cast on the ocean */}
      <path d={coast} fill="#04070f" opacity="0.4" transform={`translate(0 ${T + 14})`} />
      {/* slab side: darkest at full depth → mid → light umber near the top */}
      <path d={coast} fill="#241608" transform={`translate(0 ${T})`} />
      <path d={coast} fill="#3f2c17" transform={`translate(0 ${T * 0.6})`} />
      <path d={coast} fill="#684926" transform={`translate(0 ${T * 0.28})`} />
      {/* top surface: sand beach ring, then the green interior plate */}
      <path d={coast} fill="#e8c89a" />
      <path d={green} fill="#2b8560" />
    </g>
  );
});

/** Dirt paths, crop fields, grass tufts, rocks, and flowers on the plains. */
export const GroundDetail = memo(function GroundDetail() {
  const rand = mulberry32(hashString("ground-detail"));
  const inIsland = (x: number, y: number) =>
    ((x - 880) / 545) ** 2 + ((y - 565) / 345) ** 2 < 1;

  const tufts: [number, number][] = [];
  const rocks: [number, number, number][] = [];
  const flowers: [number, number][] = [];
  for (let i = 0; i < 90; i++) {
    const x = 880 + (rand() - 0.5) * 1120;
    const y = 565 + (rand() - 0.5) * 720;
    if (!inIsland(x, y)) continue;
    const kind = rand();
    if (kind < 0.5) tufts.push([x, y]);
    else if (kind < 0.72) rocks.push([x, y, 2.5 + rand() * 3]);
    else flowers.push([x, y]);
  }

  const paths = [
    // Voting Village → Cooperation Cove → Backsliding Bay (skirting the labels)
    "M 555 822 C 660 806, 755 812, 845 806 S 985 790, 1042 792",
    // Funding Forest → Governance Grove, along the tree line
    "M 705 472 C 760 452, 805 435, 852 420",
    // Backsliding Bay up to the volcano's foot
    "M 1108 742 C 1140 708, 1166 668, 1188 622",
  ];

  return (
    <g>
      {/* dirt paths */}
      {paths.map((d, i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <path d={d} stroke="#e0b98a" strokeWidth="9" opacity="0.6" />
          <path d={d} stroke="#e6c391" strokeWidth="3.5" opacity="0.55" strokeDasharray="1 10" />
        </g>
      ))}

      {/* crop fields between Voting Village and Cooperation Cove */}
      {[
        [668, 726, -6],
        [716, 748, 5],
      ].map(([fx, fy, rot], i) => (
        <g key={`f${i}`} transform={`rotate(${rot} ${fx} ${fy})`}>
          <rect x={fx - 22} y={fy - 14} width={44} height={28} rx={4} fill="#3f9e74" stroke="#1b6b50" strokeWidth="1.5" />
          {[0, 1, 2, 3].map((row) => (
            <line
              key={row}
              x1={fx - 18}
              x2={fx + 18}
              y1={fy - 9 + row * 6}
              y2={fy - 9 + row * 6}
              stroke="#7fd0a4"
              strokeWidth="1.6"
              opacity="0.75"
            />
          ))}
        </g>
      ))}

      {/* grass tufts */}
      <g stroke="#175c43" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        {tufts.map(([x, y], i) => (
          <g key={i}>
            <path d={`M ${x} ${y} l -2.5 -5`} />
            <path d={`M ${x} ${y} l 0 -6`} />
            <path d={`M ${x} ${y} l 2.5 -5`} />
          </g>
        ))}
      </g>

      {/* rocks */}
      <g opacity="0.6">
        {rocks.map(([x, y, s], i) => (
          <g key={i}>
            <path d={`M ${x - s} ${y} L ${x - s * 0.4} ${y - s} L ${x + s * 0.7} ${y - s * 0.7} L ${x + s} ${y} Z`} fill="#6d7f74" />
            <path d={`M ${x + s * 0.2} ${y} L ${x + s * 0.6} ${y - s * 0.5} L ${x + s * 1.4} ${y} Z`} fill="#8a9a8e" />
          </g>
        ))}
      </g>

      {/* flowers */}
      <g opacity="0.55">
        {flowers.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.7} fill={i % 3 ? "#f6f1e7" : "#f2849a"} />
        ))}
      </g>
    </g>
  );
});

/** Small bushes scattered across the island for texture. */
export const IslandScatter = memo(function IslandScatter() {
  const rand = mulberry32(hashString("scatter"));
  const spots = Array.from({ length: 16 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.9;
    return [880 + Math.cos(a) * 540 * r, 565 + Math.sin(a) * 340 * r, 4 + rand() * 5];
  });
  return (
    <g opacity="0.25" fill="#134b38">
      {spots.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} />
          <circle cx={x + r} cy={y + 2} r={r * 0.7} />
        </g>
      ))}
    </g>
  );
});

export const RegionShape = memo(function RegionShape({ region }: { region: Region }) {
  const seed = hashString(region.id);
  const rx = region.rx * 1.08;
  const ry = region.ry * 1.12;
  const d = fractalBlobPath(region.cx, region.cy, rx, ry, seed, 56, REGION_OCTAVES);
  // concentric inner path (same seed, shrunk) for the highlight rim
  const inner = fractalBlobPath(region.cx, region.cy, rx * 0.985, ry * 0.985, seed, 56, REGION_OCTAVES);
  return (
    <g>
      <path d={d} fill={region.fill} />
      {/* subtle inner highlight rim for a raised, plated feel */}
      <path d={inner} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.14} />
      {/* dashed district border in the region's darker ink shade */}
      <path
        d={d}
        fill="none"
        stroke={region.stroke}
        strokeWidth={2.8}
        strokeOpacity={0.6}
        strokeDasharray="7 7"
        strokeLinecap="round"
      />
    </g>
  );
});

/** Curated illustrated decor per district, placed deterministically. */
export const RegionDecor = memo(function RegionDecor({ region }: { region: Region }) {
  return (
    <g>
      <RegionMotif region={region} />
      <RegionLandmark id={region.id} />
    </g>
  );
});

/** Scatter art (trees, houses, banners, foothills) backing the district's landmark. */
const RegionMotif = memo(function RegionMotif({ region }: { region: Region }) {
  const rand = mulberry32(hashString(region.id + "-decor"));
  const spot = (rMin: number, rMax: number): [number, number] => {
    const a = rand() * Math.PI * 2;
    const r = rMin + rand() * (rMax - rMin);
    return [region.cx + Math.cos(a) * region.rx * r, region.cy + Math.sin(a) * region.ry * r];
  };
  const [ax, ay] = spot(0.75, 0.92);
  const [bx, by] = spot(0.75, 0.92);

  switch (region.motif) {
    case "mountains":
      return (
        <g>
          <MountainRange x={region.cx + region.rx * 0.05} y={region.cy - region.ry * 0.55} s={1.05} />
          <Pine x={ax} y={ay} s={0.9} />
          <Pine x={bx} y={by} s={0.75} />
        </g>
      );
    case "volcano":
      // foothills flank the volcano, whose base sits at IslandMap's VOLCANO_POS
      // — move one and re-check the other clears its cone and the pinned nodes
      return (
        <g>
          <Mountain x={region.cx - region.rx * 0.8} y={region.cy + region.ry * 0.46} s={0.5} />
          <Mountain x={region.cx + region.rx * 0.46} y={region.cy + region.ry * 0.11} s={0.4} />
        </g>
      );
    case "trees": {
      // a real forest: rings of pine clusters around the node field
      const treeRand = mulberry32(hashString(region.id + "-forest"));
      const extra = Array.from({ length: 6 }, () => {
        const a = treeRand() * Math.PI * 2;
        const r = 0.78 + treeRand() * 0.22;
        return [region.cx + Math.cos(a) * region.rx * r, region.cy + Math.sin(a) * region.ry * r, 0.6 + treeRand() * 0.5] as const;
      });
      return (
        <g>
          <PineCluster x={region.cx - region.rx * 0.55} y={region.cy - region.ry * 0.6} seed={7} />
          <PineCluster x={region.cx + region.rx * 0.55} y={region.cy + region.ry * 0.55} seed={13} s={0.85} />
          <PineCluster x={region.cx - region.rx * 0.2} y={region.cy + region.ry * 0.8} seed={29} s={0.9} />
          {extra.map(([tx, ty, ts], i) => (
            <Pine key={i} x={tx} y={ty} s={ts} />
          ))}
          <Pine x={ax} y={ay} s={0.85} />
        </g>
      );
    }
    case "houses":
      return (
        <g>
          <House x={region.cx - region.rx * 0.6} y={region.cy + region.ry * 0.62} s={1} />
          <House x={region.cx + region.rx * 0.52} y={region.cy - region.ry * 0.6} s={0.85} flip />
          <House x={region.cx + region.rx * 0.62} y={region.cy + region.ry * 0.5} s={0.75} />
          <Pine x={ax} y={ay} s={0.8} />
        </g>
      );
    case "castle":
      return (
        <g>
          <Castle x={region.cx + region.rx * 0.6} y={region.cy + region.ry * 0.78} s={1.25} />
          <Pine x={ax} y={ay} s={0.8} />
        </g>
      );
    case "banners":
      return (
        <g>
          <FlagBanner x={region.cx - region.rx * 0.62} y={region.cy - region.ry * 0.35} s={1.1} />
          <FlagBanner x={region.cx + region.rx * 0.6} y={region.cy - region.ry * 0.5} s={0.95} alt />
          <FlagBanner x={region.cx + region.rx * 0.68} y={region.cy + region.ry * 0.55} s={0.9} />
          <Pine x={ax} y={ay} s={0.75} />
        </g>
      );
    case "waves":
      return (
        <g>
          <Pine x={ax} y={ay} s={0.85} />
          <Pine x={bx} y={by} s={0.7} />
          {[0, 1, 2].map((i) => {
            const [wx, wy] = spot(0.5, 0.85);
            return (
              <path
                key={i}
                d={`M ${wx - 10} ${wy} q 5 -6 10 0 q 5 6 10 0`}
                fill="none"
                stroke="#123f39"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
            );
          })}
        </g>
      );
  }
});

/** Clouds and bird flocks — always the topmost layer. */
export const Sky = memo(function Sky() {
  return (
    <g pointerEvents="none">
      {/* each pair shares a track, so one of the two carries a half-duration
          offset and the sky never slides as one rigid plane */}
      <CloudPuff x={430} y={268} s={1} />
      <CloudPuff x={1245} y={310} s={0.8} slow />
      <CloudPuff x={760} y={912} s={0.7} slow delay="-35s" />
      <CloudPuff x={1560} y={160} s={0.9} delay="-23s" />
      <Flock path="M -100 280 C 350 170, 850 300, 1750 200" dur={38} s={1.2} />
      <Flock path="M 1750 500 C 1150 400, 520 500, -120 420" dur={52} s={0.95} />
    </g>
  );
});

export const CompassRose = memo(function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.9">
      <circle cx={x} cy={y} r={27} fill="none" stroke="#d9713f" strokeWidth="2.5" />
      <circle cx={x} cy={y} r={19} fill="none" stroke="#d9713f" strokeWidth="1" opacity="0.6" />
      <circle cx={x} cy={y} r={3} fill="#d9713f" />
      {[0, 90, 180, 270].map((a) => (
        <path
          key={a}
          d={`M ${x} ${y - 25} L ${x + 4.5} ${y - 8} L ${x} ${y - 12.5} L ${x - 4.5} ${y - 8} Z`}
          fill="#d9713f"
          transform={`rotate(${a} ${x} ${y})`}
        />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path
          key={a}
          d={`M ${x} ${y - 18} L ${x + 3} ${y - 8} L ${x} ${y - 10.5} L ${x - 3} ${y - 8} Z`}
          fill="#d9713f"
          opacity="0.7"
          transform={`rotate(${a} ${x} ${y})`}
        />
      ))}
    </g>
  );
});
