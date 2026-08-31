import type { RegionId } from "./types";

export interface Region {
  id: RegionId;
  name: string;
  blurb: string;
  /** center on the 1600x1000 map canvas */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  /** decorative motif rendered inside the region */
  motif: "mountains" | "volcano" | "trees" | "houses" | "waves" | "castle" | "banners";
  /** optional offset/tightening of the node cluster (leaves room for big art) */
  nodeDx?: number;
  nodeDy?: number;
  spreadX?: number;
  spreadY?: number;
}

/**
 * The island districts of the AI4Democracy map, mirroring the
 * playful alliterative geography of aisafety.com/map.
 */
export const REGIONS: Region[] = [
  {
    id: "research-range",
    name: "Research Range",
    blurb: "Institutes and labs studying how AI reshapes democratic societies.",
    cx: 1010, cy: 470, rx: 170, ry: 120,
    // deep teal
    fill: "#2f7d86", stroke: "#004850", motif: "mountains",
  },
  {
    id: "power-peaks",
    name: "Power Peaks",
    blurb: "Gradual disempowerment, AI-enabled coups, and concentration of power.",
    cx: 1240, cy: 585, rx: 150, ry: 130,
    // burnt orange
    fill: "#c2673a", stroke: "#7b2c00", motif: "volcano",
    // every org here is pinned in layout.json, so these only move the title pill
    nodeDx: 8, nodeDy: -116,
  },
  {
    id: "governance-grove",
    name: "Governance Grove",
    blurb: "Policy shops and advocates for democratic oversight of AI.",
    cx: 860, cy: 345, rx: 160, ry: 95,
    // muted emerald
    fill: "#3f8f7e", stroke: "#005143", motif: "banners",
  },
  {
    id: "funding-forest",
    name: "Funding Forest",
    blurb: "Foundations and funds backing AI × democracy work.",
    cx: 640, cy: 400, rx: 145, ry: 100,
    // moss olive
    fill: "#5a7a4a", stroke: "#27461a", motif: "trees",
  },
  {
    id: "deliberation-delta",
    name: "Deliberation Delta",
    blurb: "Collective intelligence, plurality, and AI-augmented deliberation.",
    cx: 560, cy: 585, rx: 165, ry: 115,
    // slate blue
    fill: "#4a7d9c", stroke: "#004662", motif: "waves",
  },
  {
    id: "integrity-inlet",
    name: "Integrity Inlet",
    blurb: "Information integrity, deepfake defense, and election protection.",
    cx: 870, cy: 570, rx: 150, ry: 105,
    // sage
    fill: "#6e8f6a", stroke: "#31502f", motif: "waves",
    nodeDy: -42, spreadY: 0.46,
  },
  {
    id: "voting-village",
    name: "Voting Village",
    blurb: "Voting-advice apps and AI voter-information tools.",
    cx: 555, cy: 785, rx: 160, ry: 95,
    // wheat gold, kept ≥20 L* below the #e8c89a beach ring
    fill: "#ba8c49", stroke: "#6d4803", motif: "houses",
    spreadY: 0.56,
  },
  {
    id: "cooperation-cove",
    name: "Cooperation Cove",
    blurb: "Cooperative AI and the craft of better institutions.",
    cx: 855, cy: 775, rx: 155, ry: 90,
    // dusty rose
    fill: "#a8636e", stroke: "#6b2c39", motif: "waves",
  },
  {
    id: "backsliding-bay",
    name: "Backsliding Bay",
    blurb: "The long-standing watchers of democratic decline, now facing AI.",
    cx: 1140, cy: 780, rx: 165, ry: 95,
    // deep rust (distinct from Power Peaks burnt orange)
    fill: "#9e4a3a", stroke: "#681c12", motif: "waves",
  },
];

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r])
);
