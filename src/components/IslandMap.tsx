import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { REGIONS, REGION_BY_ID, type Region } from "../data/regions";
import type { OrgSummary } from "../data/types";
import { m } from "../paraglide/messages.js";
import { hashString, mulberry32 } from "../lib/geometry";
import { logoSrc, orgsByRegion } from "../lib/orgs";
import { OrgLogo } from "./OrgLogo";
import { type NodeOverride, type LabelOverride } from "../lib/layout";
import { EditorPanel, useMapEditor, type EditKind } from "./map/MapEditor";
import { useMapViewport } from "./map/useMapViewport";
import { labelBox, labelHome } from "./map/labels";
import { Volcano } from "./MapDecor";
import {
  CompassRose,
  GroundDetail,
  IslandBase,
  IslandScatter,
  OceanDecor,
  RegionDecor,
  RegionShape,
  Sky,
} from "./map/Terrain";
import { MinusIcon, PlusIcon, ResetViewIcon } from "./icons";
import { MapLegend } from "./map/MapLegend";

export interface NodeSelection {
  org: OrgSummary;
  /** screen coords of the clicked node */
  screenX: number;
  screenY: number;
}

interface Props {
  onSelect: (sel: NodeSelection | null) => void;
  selectedSlug?: string;
  /** org list from useOrgs (live API summaries or the bundled snapshot) */
  orgs: OrgSummary[];
  /** deep-link slug (?org=) to restore on load; read once, ignored after */
  initialSelectedSlug?: string;
}

const NODE_R: Record<OrgSummary["depthRing"], number> = {
  core: 17.5,
  adjacent: 14.5,
  broad: 12.5,
};

/** Node radius: depth ring base with a little deterministic variation. */
function nodeRadius(org: OrgSummary): number {
  const jitter = (mulberry32(hashString(org.slug))() - 0.5) * 3;
  return NODE_R[org.depthRing] + jitter;
}

/** Final node radius: a manual override wins over the depth-ring radius. */
function radiusFor(org: OrgSummary, ov?: NodeOverride): number {
  return ov?.r ?? nodeRadius(org);
}

/** Power Peaks' summit. Cone base y+8, crater y-58: the silhouette clears every
 * pinned node in the district by ≥10px and sits entirely on Power Peaks fill. */
const VOLCANO_POS = { x: 1219, y: 602 };

interface LabelRect {
  lx: number;
  ly: number;
  hw: number;
  hh: number;
}

/** Auto-placement is seeded per slug (not per index in a shared list) so an
 * unpinned node keeps its spot when other orgs are added/removed/renamed; only
 * pinned nodes and label pills — stable layout data — influence acceptance. */
function autoPlace(
  org: OrgSummary,
  region: Region,
  labelRects: LabelRect[],
  pins: { x: number; y: number; r: number }[]
): { x: number; y: number } {
  const rand = mulberry32(hashString(`${region.id}:${org.slug}`));
  const ncx = region.cx + (region.nodeDx ?? 0);
  const ncy = region.cy + (region.nodeDy ?? 0);
  const sx = region.rx * (region.spreadX ?? 0.72);
  const sy = region.ry * (region.spreadY ?? 0.64);
  const r = nodeRadius(org);
  let x = ncx;
  let y = ncy;
  for (let i = 0; i < 60; i++) {
    const angle = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    x = ncx + Math.cos(angle) * sx * d;
    y = ncy + Math.sin(angle) * sy * d;
    const nearPin = pins.some((p) => Math.hypot(x - p.x, y - p.y) < r + p.r + 8);
    const inLabel = labelRects.some(
      (l) => Math.abs(x - l.lx) < l.hw + r + 6 && Math.abs(y - l.ly) < l.hh + r + 6
    );
    if (!nearPin && !inLabel) break;
  }
  return { x, y };
}

export const IslandMap = memo(function IslandMap({
  onSelect,
  selectedSlug,
  orgs,
  initialSelectedSlug,
}: Props) {
  // dev flag: /?nodes=0 hides the org nodes to work on the terrain art
  const hideNodes =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("nodes") === "0";
  // /?edit=1 turns on the manual layout editor
  const editMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("edit") === "1";

  // compositor viewport (D9): pan/zoom mutate the scene <g> ref directly during
  // gestures; `view`/`base` here are the settled values React renders with
  const {
    containerRef,
    sceneRef,
    view,
    base,
    getScale,
    zoomAt,
    panIntoView,
    centerOn,
    resetView,
    startMousePan,
    moveMousePan,
    endMousePan,
  } = useMapViewport();

  // latest node layout for the editor's radius seeding (defined after `nodeMap` below)
  const nodeMapRef = useRef<Record<string, { org: OrgSummary; x: number; y: number }>>({});
  const getNodePos = useCallback((id: string) => nodeMapRef.current[id], []);
  const {
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
  } = useMapEditor({ editMode, getScale, getNodePos });
  /** hover tooltip: the org (logo, name, tagline) at screen coords */
  const [hover, setHover] = useState<{ org: OrgSummary; x: number; y: number } | null>(null);

  // never let the hover card coexist with the click card. The render guard
  // (`hover && !selectedSlug`) covers paint, but on touch there's no mouseleave,
  // so also clear hover state whenever a node becomes selected.
  useEffect(() => {
    if (selectedSlug) setHover(null);
  }, [selectedSlug]);

  // memoized on the list identity so the map only re-lays-out when the data
  // actually changes
  const byRegion = useMemo(() => orgsByRegion(orgs), [orgs]);

  const nodes = useMemo(() => {
    // label boxes honour manual overrides (moved/scaled pills)
    const labelRects: LabelRect[] = REGIONS.map((r) => {
      const lo = overrides.labels[r.id];
      const s = lo?.s ?? 1;
      const { w, h } = labelBox(r.name);
      const home = labelHome(r);
      return {
        lx: lo?.x ?? home.x,
        ly: lo?.y ?? home.y,
        hw: (w * s) / 2,
        hh: (h * s) / 2,
      };
    });
    const out: { org: OrgSummary; x: number; y: number }[] = [];
    const pins: { x: number; y: number; r: number }[] = [];
    const auto: { org: OrgSummary; region: Region }[] = [];
    for (const region of REGIONS) {
      for (const org of byRegion[region.id] ?? []) {
        const ov = overrides.nodes[org.slug];
        if (ov) {
          out.push({ org, x: ov.x, y: ov.y });
          pins.push({ x: ov.x, y: ov.y, r: radiusFor(org, ov) });
        } else {
          auto.push({ org, region });
        }
      }
    }
    for (const { org, region } of auto) {
      const node = { org, ...autoPlace(org, region, labelRects, pins) };
      // district titles sit near each cluster center — if sampling gave up,
      // push the node radially away so pills never cover circles
      const r = radiusFor(org);
      for (const { lx, ly, hw, hh } of labelRects) {
        let guard = 0;
        while (
          Math.abs(node.x - lx) < hw + r + 6 &&
          Math.abs(node.y - ly) < hh + r + 6 &&
          guard++ < 30
        ) {
          const dx = node.x - lx || 1;
          const dy = node.y - ly;
          const len = Math.hypot(dx, dy);
          node.x += (dx / len) * 10;
          node.y += (dy / len) * 10;
        }
      }
      out.push(node);
    }
    return out.map((n) => ({ ...n, r: radiusFor(n.org, overrides.nodes[n.org.slug]) }));
  }, [byRegion, overrides]);

  const nodeMap = useMemo(() => {
    const m: Record<string, { org: OrgSummary; x: number; y: number }> = {};
    for (const n of nodes) m[n.org.slug] = n;
    return m;
  }, [nodes]);
  nodeMapRef.current = nodeMap;

  /** Screen anchor of a node's visible dot — shared by the hit layer and the
   * deep-link restore so every tooltip lands in the same place. */
  const anchorFor = useCallback((slug: string) => {
    const rect = document.querySelector(`[data-org="${slug}"]`)?.getBoundingClientRect();
    return {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect?.top ?? window.innerHeight / 2,
    };
  }, []);

  // deep-link restore (?org=slug): fires once the slug's node exists in
  // nodeMap; the rAF lets the container's ResizeObserver measure first so
  // centerOn doesn't clamp against the hardcoded 1200x700 default
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !initialSelectedSlug) return;
    const node = nodeMap[initialSelectedSlug];
    if (!node) return;
    restoredRef.current = true;
    const raf = requestAnimationFrame(() => {
      centerOn(node.x, node.y);
      const { x, y } = anchorFor(node.org.slug);
      onSelect({ org: node.org, screenX: x, screenY: y });
    });
    return () => cancelAnimationFrame(raf);
  }, [nodeMap, initialSelectedSlug, centerOn, anchorFor, onSelect]);

  // --- panning ---------------------------------------------------------------

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const moved = endMousePan();
      if (editMode) {
        // never open tooltips while editing; a plain click on empty ocean
        // clears the editor selection
        if (!isEditDragging() && !moved && (e.target as Element).tagName === "svg") clearSelection();
        return;
      }
      // click on empty ocean closes the tooltip
      if (!moved && (e.target as Element).tagName === "svg") onSelect(null);
    },
    [onSelect, editMode, endMousePan, isEditDragging, clearSelection]
  );

  // stable per-node callbacks so memo(OrgNode) bails on hover/selection churn
  const handleNodeSelect = useCallback(
    (org: OrgSummary, screenX: number, screenY: number) => {
      setHover(null); // never show the hover card alongside the click card
      onSelect({ org, screenX, screenY });
    },
    [onSelect]
  );

  const handleNodeFocus = useCallback(
    (x: number, y: number) => panIntoView(x, y),
    [panIntoView]
  );

  // canvas-space radius of the touch/click targets at the settled scale;
  // recomputed only when a gesture commits. Coarse pointers get the 24px screen
  // radius of spec 05; fine pointers keep the tighter 12px so a mouse drag can
  // still start almost anywhere on the island.
  // floored: a zero-height container would make base.k 0 and the vars unparseable
  const scale = Math.max(view.k * base.k, 0.01);
  const hitVars = {
    "--hit-r-fine": `${12 / scale}px`,
    "--hit-r-coarse": `${24 / scale}px`,
  } as React.CSSProperties;

  const handleHitSelect = useCallback(
    (org: OrgSummary) => {
      const { x, y } = anchorFor(org.slug);
      handleNodeSelect(org, x, y);
    },
    [anchorFor, handleNodeSelect]
  );

  const handleHitHover = useCallback(
    (org: OrgSummary | null) => {
      if (!org) return setHover(null);
      const { x, y } = anchorFor(org.slug);
      setHover({ org, x, y });
    },
    [anchorFor]
  );

  const selectedOrg = selected?.kind === "node" ? nodeMap[selected.id]?.org : undefined;
  const selectedRegion = selected?.kind === "label" ? REGION_BY_ID[selected.id] : undefined;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      // we own all touch gestures (pan + pinch); stop the browser from scrolling
      // or page-zooming the map out from under them
      style={{ touchAction: "none", ...hitVars }}
    >
      <svg
        className={`w-full h-full select-none ${editMode ? "" : "map-grab"}`}
        onMouseDown={startMousePan}
        onMouseMove={moveMousePan}
        onMouseUp={onMouseUp}
        onMouseLeave={() => endMousePan()}
      >
        <g ref={sceneRef} transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g transform={`translate(${base.x} ${base.y}) scale(${base.k})`}>
            <OceanDecor />
            <IslandBase />
            {REGIONS.map((r) => (
              <RegionShape key={r.id} region={r} />
            ))}
            <IslandScatter />
            <GroundDetail />
            {REGIONS.map((r) => (
              <RegionDecor key={r.id} region={r} />
            ))}
            <CompassRose x={1470} y={250} />
            {/* the only terrain art tall enough to reach a title pill, so it goes
                first and the plume passes behind the Power Peaks label */}
            <Volcano x={VOLCANO_POS.x} y={VOLCANO_POS.y} />
            {REGIONS.map((r) => (
              <RegionLabel
                key={r.id}
                region={r}
                override={overrides.labels[r.id]}
                editMode={editMode}
                editSelected={editMode && selected?.kind === "label" && selected.id === r.id}
                onStartDrag={startEditDrag}
              />
            ))}
            {/* one layer of enlarged targets UNDER every node, so an overlapping
                target can never hide a neighbour's dot from a tap */}
            {!hideNodes && !editMode && (
              <g>
                {nodes.map(({ org, x, y, r }) => (
                  <HitTarget
                    key={org.slug}
                    org={org}
                    x={x}
                    y={y}
                    r={r}
                    onSelect={handleHitSelect}
                    onHover={handleHitHover}
                  />
                ))}
              </g>
            )}
            {!hideNodes &&
              nodes.map(({ org, x, y, r }) => (
                <OrgNode
                  key={org.slug}
                  org={org}
                  x={x}
                  y={y}
                  r={r}
                  selected={org.slug === selectedSlug}
                  editMode={editMode}
                  editSelected={editMode && selected?.kind === "node" && selected.id === org.slug}
                  onStartDrag={startEditDrag}
                  onSelect={handleNodeSelect}
                  onKeyboardFocus={handleNodeFocus}
                  onHover={setHover}
                />
              ))}
            <Sky />
            <MapTitle />
          </g>
        </g>
      </svg>

      {hover && !selectedSlug && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full bg-ink-900/95 px-3 py-2.5"
          style={{
            left: Math.min(Math.max(160, hover.x), window.innerWidth - 160),
            top: Math.max(80, hover.y - 8),
            width: 300,
            border: "1px dashed var(--dash)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <OrgLogo
              org={hover.org}
              size={32}
              className="h-8 w-8 shrink-0 bg-white object-contain"
              style={{ border: "1px solid var(--dash)" }}
            />
            <p className="min-w-0 truncate text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
              {hover.org.name}
            </p>
          </div>
          <p
            className="mt-1.5 overflow-hidden text-ui leading-snug"
            style={{
              color: "var(--ink-70)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {hover.org.tagline}
          </p>
        </div>
      )}

      {editMode && (
        <EditorPanel
          kind={selected?.kind}
          name={selectedOrg?.name ?? selectedRegion?.name ?? null}
          radius={selectedOrg ? radiusFor(selectedOrg, overrides.nodes[selected!.id]) : 0}
          scale={selectedRegion ? overrides.labels[selected!.id]?.s ?? 1 : 1}
          onRadius={(r) => selected && setNodeRadius(selected.id, r)}
          onScale={(s) => selected && setLabelScale(selected.id, s)}
          onSave={handleSave}
          onDiscard={handleDiscard}
          status={status}
        />
      )}

      <div
        className="absolute flex flex-col gap-2"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 24px)",
          right: "calc(env(safe-area-inset-right, 0px) + 24px)",
        }}
      >
        <ZoomBtn onClick={() => zoomAt(1.25)} label="Zoom in">
          <PlusIcon size={16} />
        </ZoomBtn>
        <ZoomBtn onClick={() => zoomAt(0.8)} label="Zoom out">
          <MinusIcon size={16} />
        </ZoomBtn>
        <ZoomBtn onClick={resetView} label="Reset view">
          <ResetViewIcon size={16} />
        </ZoomBtn>
        <MapLegend />
      </div>
    </div>
  );
});

/** Baseline clears the coast blob's nominal top edge (y ≈ 171) with room for descenders.
 * Theme colours must go through `style` — `var()` is invalid in SVG presentation attributes. */
export const MapTitle = memo(function MapTitle() {
  return (
    <text
      x={895}
      y={150}
      textAnchor="middle"
      fontSize={48}
      fontWeight="700"
      className="map-title"
      pointerEvents="none"
      aria-hidden="true"
      style={{ fill: "var(--ink)", letterSpacing: "-0.02em" }}
    >
      {m["common.siteTitle"]()}
    </text>
  );
});

function ZoomBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="corda-icon-btn w-10 h-10 bg-ink-900/80 backdrop-blur"
    >
      {children}
    </button>
  );
}

const RegionLabel = memo(function RegionLabel({
  region,
  override,
  editMode,
  editSelected,
  onStartDrag,
}: {
  region: Region;
  override?: LabelOverride;
  editMode: boolean;
  editSelected: boolean;
  onStartDrag: (kind: EditKind, id: string, e: React.MouseEvent, curX: number, curY: number) => void;
}) {
  const s = override?.s ?? 1;
  const { w: bw, h: bh } = labelBox(region.name);
  const w = bw * s;
  const h = bh * s;
  const home = labelHome(region);
  const x = override?.x ?? home.x;
  const y = override?.y ?? home.y;
  return (
    <g
      className="region-label"
      style={editMode ? { cursor: "move" } : undefined}
      onMouseDown={editMode ? (e) => onStartDrag("label", region.id, e, x, y) : undefined}
    >
      {editSelected && (
        <rect
          x={x - w / 2 - 4}
          y={y - h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={(h + 8) / 2}
          fill="none"
          stroke="#f4a87a"
          strokeWidth={2.5}
        />
      )}
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill="#0e1730" opacity="0.82" />
      <text x={x} y={y + 4.5 * s} textAnchor="middle" fontSize={13.5 * s} fontWeight="700" fill="#ffffff">
        {region.name}
      </text>
    </g>
  );
});

/** Enlarged pointer target for one node. `--r` is the visual radius floor; the
 * per-pointer maximum comes from the container's `--hit-r-*` vars, so zoom never
 * re-renders these. */
const HitTarget = memo(function HitTarget({
  org,
  x,
  y,
  r,
  onSelect,
  onHover,
}: {
  org: OrgSummary;
  x: number;
  y: number;
  r: number;
  onSelect: (org: OrgSummary) => void;
  onHover: (org: OrgSummary | null) => void;
}) {
  return (
    <circle
      className="map-hit"
      cx={x}
      cy={y}
      r={r}
      fill="transparent"
      style={{ "--r": `${r}px` } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(org);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => onHover(org)}
      onMouseLeave={() => onHover(null)}
    />
  );
});

const OrgNode = memo(function OrgNode({
  org,
  x,
  y,
  r,
  selected,
  editMode,
  editSelected,
  onSelect,
  onKeyboardFocus,
  onStartDrag,
  onHover,
}: {
  org: OrgSummary;
  x: number;
  y: number;
  r: number;
  selected: boolean;
  editMode: boolean;
  editSelected: boolean;
  onSelect: (org: OrgSummary, screenX: number, screenY: number) => void;
  onKeyboardFocus: (x: number, y: number) => void;
  onStartDrag: (kind: EditKind, id: string, e: React.MouseEvent, curX: number, curY: number) => void;
  onHover: (h: { org: OrgSummary; x: number; y: number } | null) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const clipId = `clip-${org.slug}`;
  const activate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
    onSelect(org, rect.left + rect.width / 2, rect.top);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); // Space would otherwise scroll the page
    activate(e);
  };
  // only keyboard focus pans — :focus-visible excludes focus that follows a click
  const handleFocus = (e: React.FocusEvent<SVGGElement>) => {
    if (e.currentTarget.matches(":focus-visible")) onKeyboardFocus(x, y);
  };
  return (
    <g
      data-org={org.slug}
      className={editMode ? undefined : "node-circle"}
      role={editMode ? undefined : "button"}
      tabIndex={editMode ? undefined : 0}
      aria-label={editMode ? undefined : org.name}
      style={editMode ? { cursor: "move" } : undefined}
      onClick={editMode ? undefined : activate}
      onKeyDown={editMode ? undefined : handleKeyDown}
      onFocus={editMode ? undefined : handleFocus}
      onMouseDown={
        editMode
          ? (e) => {
              onHover(null);
              onStartDrag("node", org.slug, e, x, y);
            }
          : (e) => e.stopPropagation()
      }
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
        onHover({ org, x: rect.left + rect.width / 2, y: rect.top });
      }}
      onMouseLeave={() => onHover(null)}
    >
      {editSelected && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#f4a87a" strokeWidth={2.5} />}
      {/* double ring: the dark halo carries the 3:1 non-text contrast on every
          district fill, the warm core carries it against the halo (WCAG 1.4.11) */}
      <g className="node-focus-ring">
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#14203a" strokeWidth={5.5} />
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#f4a87a" strokeWidth={2.5} />
      </g>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={selected ? "#f4a87a" : "#14203a"} strokeWidth={selected ? 3 : 1.2} />
      <clipPath id={clipId}>
        <circle cx={x} cy={y} r={r - 3.5} />
      </clipPath>
      {imgFailed ? (
        <text x={x} y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#101a30">
          {org.name.charAt(0)}
        </text>
      ) : (
        <image
          href={logoSrc(org)}
          x={x - (r - 3.5)}
          y={y - (r - 3.5)}
          width={(r - 3.5) * 2}
          height={(r - 3.5) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          onError={() => setImgFailed(true)}
        />
      )}
    </g>
  );});
