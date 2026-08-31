import type { Region } from "../../data/regions";

/** Region title pill metrics (must match RegionLabel rendering). */
export function labelBox(name: string) {
  return { w: name.length * 8 + 26, h: 29 };
}

/** Default (un-overridden) title pill center for a region. */
export function labelHome(region: Region): { x: number; y: number } {
  return { x: region.cx + (region.nodeDx ?? 0), y: region.cy + (region.nodeDy ?? 0) };
}
