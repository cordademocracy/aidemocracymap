/** Landmark palette. The first three are the ONLY additions to the map's
 * global palette; everything below mirrors MapDecor.tsx and must stay
 * byte-identical to it. */
export const STONE_L = "#d8d2c4";
export const STONE_D = "#a89e8c";
export const BRONZE = "#b07a3c";

export const M_DARK = "#a04424";
export const M_LIGHT = "#d9713f";
export const SNOW = "#f6f1e7";
export const TRUNK = "#6b4423";
export const PINE_D = "#175c43";
export const PINE_L = "#1f7a5a";
export const PINE_EDGE = "#0e4132";
export const WALL = "#f4e3c2";
export const ROOF = "#b3502b";
export const SHADOW = "rgba(10, 20, 30, 0.18)";
export const GLASS = "#c0e4ec";
export const PENNANT = "#f2849a";
export const INK_LINE = "#16223c";

/** Voting Village's ochre fill sits ~12 L* under WALL/STONE_L and next to the
 * beach ring: every pale shape there needs this edge at 1.2·s. */
export const OCHRE_EDGE = "#6d4803";

export interface LandmarkProps {
  x: number;
  y: number;
  s?: number;
}
