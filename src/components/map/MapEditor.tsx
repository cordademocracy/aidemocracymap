import { useCallback, useEffect, useRef, useState } from "react";
import { REGION_BY_ID } from "../../data/regions";
import {
  clearDraft,
  loadLayout,
  persistLayout,
  saveDraft,
  type LayoutOverrides,
} from "../../lib/layout";
import { labelHome } from "./labels";

export type EditKind = "node" | "label";
export interface EditSelection {
  kind: EditKind;
  id: string;
}
interface EditDrag {
  kind: EditKind;
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  /** view.k * base.k captured at drag start: screen px → map units */
  scale: number;
  moved: boolean;
}

/** State + drag/save logic behind the ?edit=1 manual layout editor. */
export function useMapEditor({
  editMode,
  getScale,
  getNodePos,
}: {
  editMode: boolean;
  /** current effective scale (view.k * base.k): screen px → map units */
  getScale: () => number;
  /** laid-out position of a node (for seeding a radius-only override) */
  getNodePos: (id: string) => { x: number; y: number };
}) {
  // manual layout overrides — saved layout.json in every mode, plus the
  // localStorage draft while editing
  const [overrides, setOverrides] = useState<LayoutOverrides>(() => loadLayout(editMode));
  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  const [selected, setSelected] = useState<EditSelection | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const editDrag = useRef<EditDrag | null>(null);

  const startEditDrag = useCallback(
    (kind: EditKind, id: string, e: React.MouseEvent, curX: number, curY: number) => {
      e.stopPropagation();
      editDrag.current = {
        kind,
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: curX,
        origY: curY,
        scale: getScale(),
        moved: false,
      };
    },
    [getScale]
  );

  // window-level drag so the cursor can leave the element mid-drag; a plain
  // click (no movement) selects the element instead of moving it
  useEffect(() => {
    if (!editMode) return;
    const onMove = (e: MouseEvent) => {
      const d = editDrag.current;
      if (!d) return;
      const totalDx = e.clientX - d.startX;
      const totalDy = e.clientY - d.startY;
      if (Math.abs(totalDx) + Math.abs(totalDy) > 4) d.moved = true;
      const nx = d.origX + totalDx / d.scale;
      const ny = d.origY + totalDy / d.scale;
      setOverrides((o) => {
        if (d.kind === "node") {
          const prev = o.nodes[d.id];
          return { ...o, nodes: { ...o.nodes, [d.id]: { ...prev, x: nx, y: ny } } };
        }
        const prev = o.labels[d.id];
        return { ...o, labels: { ...o.labels, [d.id]: { ...prev, x: nx, y: ny } } };
      });
    };
    const onUp = () => {
      const d = editDrag.current;
      if (!d) return;
      editDrag.current = null;
      if (d.moved) saveDraft(overridesRef.current);
      else setSelected({ kind: d.kind, id: d.id });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editMode]);

  const setNodeRadius = useCallback(
    (id: string, r: number) => {
      setOverrides((o) => {
        const prev = o.nodes[id];
        const pos = prev ?? getNodePos(id);
        const next = { ...o, nodes: { ...o.nodes, [id]: { x: pos.x, y: pos.y, r } } };
        saveDraft(next);
        return next;
      });
    },
    [getNodePos]
  );

  const setLabelScale = useCallback((id: string, s: number) => {
    setOverrides((o) => {
      const prev = o.labels[id];
      const home = labelHome(REGION_BY_ID[id]);
      const next = {
        ...o,
        labels: { ...o.labels, [id]: { x: prev?.x ?? home.x, y: prev?.y ?? home.y, s } },
      };
      saveDraft(next);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const ok = await persistLayout(overridesRef.current);
    setStatus(ok ? "Saved to layout.json" : "Saved draft only — dev server offline");
    window.setTimeout(() => setStatus(null), 4000);
  }, []);

  const handleDiscard = useCallback(() => {
    clearDraft();
    location.reload();
  }, []);

  const clearSelection = useCallback(() => setSelected(null), []);
  const isEditDragging = useCallback(() => editDrag.current !== null, []);

  return {
    overrides,
    selected,
    status,
    startEditDrag,
    setNodeRadius,
    setLabelScale,
    handleSave,
    handleDiscard,
    clearSelection,
    isEditDragging,
  };
}

export function EditorPanel({
  kind,
  name,
  radius,
  scale,
  onRadius,
  onScale,
  onSave,
  onDiscard,
  status,
}: {
  kind?: EditKind;
  name: string | null;
  radius: number;
  scale: number;
  onRadius: (r: number) => void;
  onScale: (s: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  status: string | null;
}) {
  return (
    <div className="corda-card absolute top-4 left-4 z-20 w-72 p-4">
      <p className="eyebrow">Layout editor</p>
      <p className="mt-2 text-xs leading-snug" style={{ color: "var(--ink-50)" }}>
        Drag circles and titles. Click to select, then resize.
      </p>

      {name ? (
        <div className="mt-3">
          <div className="truncate text-xs font-semibold" style={{ color: "var(--ink)" }}>{name}</div>
          {kind === "node" ? (
            <label className="mt-2 block text-xs" style={{ color: "var(--ink-70)" }}>
              Node radius <span className="tabular-nums">{radius.toFixed(1)}</span>
              <input
                type="range"
                min={8}
                max={34}
                step={0.5}
                value={radius}
                onChange={(e) => onRadius(Number(e.target.value))}
                className="mt-1 w-full"
                style={{ accentColor: "var(--ink)" }}
              />
            </label>
          ) : (
            <label className="mt-2 block text-xs" style={{ color: "var(--ink-70)" }}>
              Label scale <span className="tabular-nums">{scale.toFixed(2)}</span>
              <input
                type="range"
                min={0.5}
                max={2.2}
                step={0.05}
                value={scale}
                onChange={(e) => onScale(Number(e.target.value))}
                className="mt-1 w-full"
                style={{ accentColor: "var(--ink)" }}
              />
            </label>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs" style={{ color: "var(--ink-40)" }}>Nothing selected yet.</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button onClick={onSave} className="btn-corda-primary btn-corda-sm">
          Save
        </button>
        <button
          onClick={onDiscard}
          className="text-xs transition-colors"
          style={{ color: "var(--ink-50)" }}
        >
          Discard draft
        </button>
      </div>

      {status && <p className="mt-2 text-xs" style={{ color: "var(--ink-70)" }}>{status}</p>}
    </div>
  );
}
