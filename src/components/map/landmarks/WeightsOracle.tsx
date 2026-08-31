import { memo } from "react";
import { INK_LINE, SHADOW, SNOW, STONE_D, STONE_L, type LandmarkProps } from "./palette";

const COLS = 4;
const ROWS = 3;
/** matrix window inside the sheet */
const GRID_X = -1.35;
const GRID_Y = -4.15;
const GRID_W = 2.7;
const GRID_H = 1.9;
const GAP = 0.13;
/** row-major weights; nothing spells anything, they only have to vary */
const TONES = [0.9, 0.22, 0.62, 0.14, 0.34, 0.85, 0.18, 0.55, 0.15, 0.46, 0.95, 0.28];

/** Deliberation Delta: the draped figure on the bema, holding what the assembly
 * is actually deliberating. The sheet is a smudge until the map is deeply
 * zoomed — `.oracle-matrix` gates the grid on `--zoom-k`. */
export const WeightsOracle = memo(function WeightsOracle({ x, y, s = 1 }: LandmarkProps) {
  const u = (n: number) => n * s;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${px(a)},${py(b)}`).join(" ");

  const cw = (GRID_W - (COLS - 1) * GAP) / COLS;
  const ch = (GRID_H - (ROWS - 1) * GAP) / ROWS;

  return (
    <g>
      <ellipse cx={px(0)} cy={py(0.15)} rx={u(1.7)} ry={u(0.45)} fill={SHADOW} />

      <rect x={px(-1.3)} y={py(-0.8)} width={u(2.6)} height={u(0.8)} fill={STONE_D} />
      <rect x={px(-1.3)} y={py(-0.8)} width={u(2.6)} height={u(0.22)} fill={STONE_L} />

      {/* drapery: lit column with one shaded flank, shoulders, hooded head */}
      <polygon points={poly([[-1.2, -0.8], [-0.85, -5.2], [0.85, -5.2], [1.2, -0.8]])} fill={STONE_L} />
      <polygon points={poly([[-1.2, -0.8], [-0.85, -5.2], [-0.3, -5.2], [-0.5, -0.8]])} fill={STONE_D} />
      <polygon points={poly([[-0.95, -5.2], [0.95, -5.2], [0.7, -5.9], [-0.7, -5.9]])} fill={STONE_L} />
      <circle cx={px(0)} cy={py(-6.45)} r={u(1.05)} fill={STONE_D} />
      <circle cx={px(0.1)} cy={py(-6.4)} r={u(0.8)} fill={STONE_L} />

      {/* the scroll, held across: rolls, then the dark sheet with a stone rim so
          it never merges with the speaker standing beside it */}
      <rect x={px(-1.9)} y={py(-4.6)} width={u(0.5)} height={u(2.9)} rx={u(0.25)} fill={STONE_L} />
      <rect x={px(1.4)} y={py(-4.6)} width={u(0.5)} height={u(2.9)} rx={u(0.25)} fill={STONE_L} />
      <rect
        x={px(-1.6)}
        y={py(-4.4)}
        width={u(3.2)}
        height={u(2.4)}
        fill={INK_LINE}
        stroke={STONE_L}
        strokeWidth={u(0.22)}
      />

      <g className="oracle-matrix">
        {TONES.map((t, i) => (
          <rect
            key={i}
            x={px(GRID_X + (i % COLS) * (cw + GAP))}
            y={py(GRID_Y + Math.floor(i / COLS) * (ch + GAP))}
            width={u(cw)}
            height={u(ch)}
            fill={SNOW}
            opacity={t}
          />
        ))}
      </g>
    </g>
  );
});
