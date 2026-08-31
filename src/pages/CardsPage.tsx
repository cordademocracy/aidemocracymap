import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { OrgCard } from "../components/OrgCard";
import { ChevronDownIcon } from "../components/icons";
import { REGIONS } from "../data/regions";
import { CATEGORY_LABELS, type Category, type OrgSummary } from "../data/types";
import { categoryCounts, searchOrgs } from "../lib/orgs";
import { useOrgs } from "../lib/useOrgs";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { m } from "../paraglide/messages.js";

const SubmitOrgPanel = lazy(() =>
  import("../components/SubmitOrgPanel").then((m) => ({ default: m.SubmitOrgPanel }))
);

const CATEGORIES: (Category | "all")[] = [
  "all",
  "research",
  "tools",
  "policy-advocacy",
  "funder",
  "community",
  "media",
];

function countMessage(shown: number, total: number | "—", query: string): string {
  return query
    ? m["cards.countFiltered"]({ shown, total, query })
    : m["cards.count"]({ shown, total });
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function CardsPage() {
  useDocumentTitle(m["cards.docTitle"]());
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = (params.get("cat") ?? "all") as Category | "all";
  const { orgs: allOrgs } = useOrgs();
  const counts = useMemo(() => categoryCounts(allOrgs ?? []), [allOrgs]);
  // Below md the chip row collapses behind a "Filters" toggle; always open on md+.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const results = useMemo(() => searchOrgs(allOrgs ?? [], q, cat), [allOrgs, q, cat]);

  const byRegion = useMemo(() => {
    const m = new Map<string, OrgSummary[]>();
    for (const org of results) {
      if (!m.has(org.region)) m.set(org.region, []);
      m.get(org.region)!.push(org);
    }
    return m;
  }, [results]);

  const loading = allOrgs === null;

  const countLabel = loading
    ? m["common.loadingOrgs"]()
    : countMessage(results.length, allOrgs?.length ?? "—", q);
  const announcedCount = useDebouncedValue(countLabel, 600);

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{m["cards.eyebrow"]()}</p>
          <h1 className="text-2xl font-bold tracking-tight">{m["cards.heading"]()}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <p className="text-sm" aria-hidden="true" style={{ color: "var(--ink-50)" }}>
              {countLabel}
            </p>
            {/* announced separately and debounced, so typing in the filter
                doesn't make the polite region chatter on every keystroke */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {announcedCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setAddOpen(true)} className="btn-corda">
            {m["common.addOrg"]()}
          </button>
          <Link to="/" className="btn-corda">
            {m["common.backToMap"]()}
          </Link>
        </div>
      </div>

      <hr className="dashed-rule mt-6" />

      <div className="flex flex-wrap gap-2 mt-6 items-center">
        <input
          value={q}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set("q", e.target.value);
            else next.delete("q");
            setParams(next, { replace: true });
          }}
          aria-label={m["cards.searchLabel"]()}
          placeholder={m["cards.searchPlaceholder"]()}
          className="corda-input flex-1 min-w-0 md:flex-none md:w-72"
        />
        {/* Mobile-only toggle. The md:hidden lives on this wrapper div (not the
            button) because .corda-chip's un-layered display:inline-flex would
            otherwise beat Tailwind's layered md:hidden and keep it visible. */}
        <div className="md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`corda-chip ${cat !== "all" ? "is-active" : ""}`}
          >
            <span>
              {cat === "all" ? m["cards.filters"]() : m["cards.filtersActive"]({ label: CATEGORY_LABELS[cat] })}
            </span>
            <ChevronDownIcon
              size={13}
              className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        <div
          className={`${filtersOpen ? "flex" : "hidden"} md:flex flex-wrap gap-2 items-center w-full md:w-auto`}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (c === "all") next.delete("cat");
                else next.set("cat", c);
                setParams(next, { replace: true });
              }}
              className={`corda-chip ${cat === c ? "is-active" : ""}`}
            >
              {c === "all"
                ? m["cards.allCategories"]({ total: allOrgs?.length ?? "" })
                : m["cards.categoryChip"]({ label: CATEGORY_LABELS[c], count: counts[c] })}
            </button>
          ))}
        </div>
      </div>

      {loading && <CardsSkeleton />}

      {!loading && REGIONS.map((region) => {
        const orgs = byRegion.get(region.id);
        if (!orgs?.length) return null;
        return (
          <section key={region.id} className="mt-7">
            <div className="flex items-baseline gap-3 dashed-b pb-2">
              <span
                aria-hidden
                className="w-3 h-3 shrink-0 self-center"
                style={{ background: region.fill, outline: `2px solid ${region.stroke}` }}
              />
              <span className="eyebrow">{m["common.district"]()}</span>
              <h2 className="text-xl font-bold">{region.name}</h2>
              <span className="text-sm tabular-nums" style={{ color: "var(--ink-50)" }}>{orgs.length}</span>
            </div>
            <p className="text-sm leading-[normal] mt-2" style={{ color: "var(--ink-50)" }}>{region.blurb}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mt-4">
              {orgs.map((org) => (
                <OrgCard key={org.slug} org={org} />
              ))}
            </div>
          </section>
        );
      })}

      {/* The region stays mounted so the empty state is announced when it appears. */}
      <div aria-live="polite">
        {!loading && !results.length && (
          <p className="mt-16 text-center" style={{ color: "var(--ink-50)" }}>{m["cards.empty"]()}</p>
        )}
      </div>

      {addOpen && (
        <Suspense fallback={null}>
          <SubmitOrgPanel onClose={() => setAddOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

/** Placeholder grid shown while neither the API nor the snapshot has answered. */
function CardsSkeleton() {
  return (
    <div className="mt-7" aria-hidden>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="corda-card skeleton-block h-28" />
        ))}
      </div>
    </div>
  );
}

