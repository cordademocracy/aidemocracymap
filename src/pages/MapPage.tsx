import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { IslandMap, type NodeSelection } from "../components/IslandMap";
import { MapAttribution } from "../components/map/MapAttribution";
import { OrgTooltip } from "../components/OrgTooltip";
import { REGIONS } from "../data/regions";
import type { OrgSummary } from "../data/types";
import { orgsByRegion } from "../lib/orgs";
import { useOrgs } from "../lib/useOrgs";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { m } from "../paraglide/messages.js";

const SubmitOrgPanel = lazy(() =>
  import("../components/SubmitOrgPanel").then((m) => ({ default: m.SubmitOrgPanel }))
);

// stable identity while the dataset loads, so the map doesn't re-lay-out
const NO_ORGS: OrgSummary[] = [];

export function MapPage() {
  useDocumentTitle();
  const [selection, setSelection] = useState<NodeSelection | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // read once — the deep-link slug only ever restores the initial selection
  const initialOrgSlug = useRef(searchParams.get("org") ?? undefined).current;
  // Live org list so approved new orgs appear as nodes; the bundled snapshot is
  // lazy-imported by useOrgs only when the API is unreachable (D8). Passing a
  // stable array identity keeps the map from re-laying-out on every render.
  const { orgs } = useOrgs();
  const byRegion = useMemo(() => orgsByRegion(orgs ?? NO_ORGS), [orgs]);

  // stable identity so memo(IslandMap) doesn't re-render all nodes on every
  // selection; preserves ?edit=1/?nodes=0/?zoom= instead of clobbering them
  const handleSelect = useCallback(
    (sel: NodeSelection | null) => {
      setSelection(sel);
      setSearchParams(
        (prev) => {
          if ((sel?.org.slug ?? null) === (prev.get("org") ?? null)) return prev;
          const next = new URLSearchParams(prev);
          if (sel) next.set("org", sel.org.slug);
          else next.delete("org");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // stable children identity so memo(IslandMap) doesn't re-render all nodes
  // when MapPage re-renders for reasons unrelated to selection (e.g. addOpen)
  const tooltip = useMemo(
    () => (selection ? <OrgTooltip selection={selection} onClose={() => handleSelect(null)} /> : null),
    [selection, handleSelect]
  );

  // a ?org= slug that isn't in the dataset can never be restored — drop it once
  // the list has actually loaded, so a stale share link doesn't stick
  useEffect(() => {
    if (!initialOrgSlug || orgs === null) return;
    if (orgs.some((o) => o.slug === initialOrgSlug)) return;
    setSearchParams(
      (prev) => {
        if (prev.get("org") !== initialOrgSlug) return prev;
        const next = new URLSearchParams(prev);
        next.delete("org");
        return next;
      },
      { replace: true }
    );
  }, [orgs, initialOrgSlug, setSearchParams]);

  return (
    <div className="relative h-full overflow-hidden">
      <h1 className="sr-only">{m["common.siteTitle"]()}</h1>

      {/* before the map in DOM so the legend and actions are early tab stops,
          ahead of the 139 node stops; z-10 keeps them over the map's inset-0 layer */}
      <div className="absolute z-10 flex w-fit max-w-[calc(100vw-3rem)] flex-col items-start gap-2.5 bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] left-[calc(env(safe-area-inset-left,0px)+24px)] max-[400px]:bottom-[calc(env(safe-area-inset-bottom,0px)+52px)]">
        <div aria-live="polite">
          {orgs === null && (
            <p className="corda-chip" style={{ cursor: "default" }}>
              {m["common.loadingOrgs"]()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 max-[400px]:flex-col max-[400px]:items-start">
          <Link to="/cards" className="btn-corda-primary btn-corda-lg">
            {m["map.viewCards"]()}
          </Link>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-corda">
            {m["common.addOrg"]()}
          </button>
        </div>
      </div>

      <IslandMap
        onSelect={handleSelect}
        selectedSlug={selection?.org.slug}
        orgs={orgs ?? NO_ORGS}
        initialSelectedSlug={initialOrgSlug}
      >
        {tooltip}
      </IslandMap>

      <OrgIndex byRegion={byRegion} />

      <MapAttribution />

      {addOpen && (
        <Suspense fallback={null}>
          <SubmitOrgPanel onClose={() => setAddOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

/** Text equivalent of the map: every node as a district-grouped link, for
 * screen readers, keyboard users and crawlers. */
function OrgIndex({ byRegion }: { byRegion: Record<string, OrgSummary[]> }) {
  return (
    <nav id="org-index" tabIndex={-1} aria-label={m["map.indexLabel"]()} className="sr-only">
      <h2>{m["map.indexHeading"]()}</h2>
      {REGIONS.map((region) => {
        const orgs = byRegion[region.id];
        if (!orgs?.length) return null;
        return (
          <section key={region.id}>
            <h3>{region.name}</h3>
            <ul>
              {orgs.map((org) => (
                <li key={org.slug}>
                  <Link to={`/org/${org.slug}`}>{org.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
