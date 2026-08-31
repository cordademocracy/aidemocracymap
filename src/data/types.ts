export type Category =
  | "research"
  | "tools"
  | "policy-advocacy"
  | "funder"
  | "community"
  | "media";

export type DepthRing = "core" | "adjacent" | "broad";

export type RegionId =
  | "research-range"
  | "power-peaks"
  | "governance-grove"
  | "funding-forest"
  | "deliberation-delta"
  | "integrity-inlet"
  | "voting-village"
  | "cooperation-cove"
  | "backsliding-bay";

export interface KeyProject {
  name: string;
  url?: string;
  note?: string;
}

/** Trimmed org shape (D13) — everything the map, cards, and search need;
 * the full fields live on Organization. */
export interface OrgSummary {
  slug: string;
  name: string;
  website: string;
  category: Category;
  region: RegionId;
  tagline: string;
  focusTags: string[];
  location: string;
  depthRing: DepthRing;
  /** Uploaded logo URL (set by an approved logo submission). When present,
   * frontends prefer it over the bundled /logos/<slug>-80.webp. */
  logoUrl?: string | null;
}

export interface Organization extends OrgSummary {
  description: string;
  aiDemocracyAngle: string;
  founded: number | null;
  funders: string[];
  keyProjects: KeyProject[];
  logoDomain: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  research: "Research",
  tools: "Tools & products",
  "policy-advocacy": "Policy & advocacy",
  funder: "Funding",
  community: "Community",
  media: "Media",
};

export const DEPTH_LABELS: Record<DepthRing, string> = {
  core: "Core AI × democracy",
  adjacent: "AI safety, democracy workstream",
  broad: "Democracy field, AI-relevant",
};
