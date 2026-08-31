/**
 * Manual layout overrides for the map: user-placed positions/sizes for org
 * nodes and district title pills. Canonical data lives in src/data/layout.json
 * (written by the dev-server /__save-layout endpoint when you hit Save in the
 * ?edit=1 editor); localStorage keeps an in-progress draft.
 */
import initial from "../data/layout.json";

export interface NodeOverride {
  x: number;
  y: number;
  r?: number;
}
export interface LabelOverride {
  x: number;
  y: number;
  s?: number;
}
export interface LayoutOverrides {
  nodes: Record<string, NodeOverride>;
  labels: Record<string, LabelOverride>;
}

const DRAFT_KEY = "aisd-layout-draft";

export function loadLayout(includeDraft: boolean): LayoutOverrides {
  const data = initial as LayoutOverrides;
  const base: LayoutOverrides = {
    nodes: { ...(data.nodes ?? {}) },
    labels: { ...(data.labels ?? {}) },
  };
  if (includeDraft) {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const d = JSON.parse(draft) as Partial<LayoutOverrides>;
        Object.assign(base.nodes, d.nodes ?? {});
        Object.assign(base.labels, d.labels ?? {});
      }
    } catch {
      /* corrupted draft — ignore */
    }
  }
  return base;
}

export function saveDraft(layout: LayoutOverrides) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(layout));
  } catch {
    /* storage full/blocked — the Save button still persists to disk */
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

/** Persist to src/data/layout.json via the dev server; falls back to draft-only. */
export async function persistLayout(layout: LayoutOverrides): Promise<boolean> {
  saveDraft(layout);
  try {
    const res = await fetch("/__save-layout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(layout, null, 2),
    });
    return res.ok;
  } catch {
    return false;
  }
}
