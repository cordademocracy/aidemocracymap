import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { loadSnapshot } from "../data/organizations";
import { REGION_BY_ID } from "../data/regions";
import { CATEGORY_LABELS, DEPTH_LABELS, type Organization } from "../data/types";
import { OrgLogo } from "../components/OrgLogo";
import { fetchOrg } from "../lib/api";
import { useOrgs } from "../lib/useOrgs";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { OrgCard } from "../components/OrgCard";
import { m } from "../paraglide/messages.js";

const SuggestEditPanel = lazy(() =>
  import("../components/SuggestEditPanel").then((m) => ({ default: m.SuggestEditPanel }))
);

export function OrgPage() {
  const { slug } = useParams();
  // undefined = loading, null = not found (in the API nor the snapshot)
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const { orgs: allOrgs } = useOrgs();
  useDocumentTitle(org?.name);

  // Prefer backend data so approved edits are visible; fall back to the
  // lazy-imported bundled snapshot on any error (offline-first, D8).
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setOrg(undefined);
    fetchOrg(slug)
      .then((fresh) => {
        if (!cancelled) setOrg(fresh);
      })
      .catch(async () => {
        const snapshot = await loadSnapshot();
        if (!cancelled) setOrg(snapshot.find((o) => o.slug === slug) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (org === undefined) return null;

  if (!org) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="eyebrow mb-3">{m["notFound.eyebrow404"]()}</p>
        <h1 className="text-2xl font-bold">{m["org.notFound"]()}</h1>
        <Link to="/" className="btn-corda mt-6 inline-flex">
          {m["common.backToMap"]()}
        </Link>
      </div>
    );
  }

  const region = REGION_BY_ID[org.region];
  const neighbors = (allOrgs ?? [])
    .filter((o) => o.region === org.region && o.slug !== org.slug)
    .slice(0, 4);

  return (
    <div className="max-w-5xl mx-auto px-4 py-7">
      <Link to="/" className="eyebrow hover:opacity-70 transition-opacity">
        {m["common.backToMap"]()}
      </Link>

      <div className="flex flex-wrap items-center gap-5 mt-6">
        <OrgLogo
          org={org}
          size={80}
          className="w-20 h-20 bg-white object-contain p-2"
          style={{ border: "1px solid var(--hairline)" }}
        />
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{org.name}</h1>
          <p className="mt-1.5" style={{ color: "var(--ink-70)" }}>{org.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 md:ml-auto">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="btn-corda btn-corda-lg"
          >
            {m["forms.suggestEdit.title"]()}
          </button>
          <a
            href={org.website}
            target="_blank"
            rel="noreferrer"
            className="btn-corda-primary btn-corda-lg"
          >
            {m["org.visitWebsite"]()}
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <Chip accent>{DEPTH_LABELS[org.depthRing]}</Chip>
        <Chip>{region?.name}</Chip>
        <Chip>{CATEGORY_LABELS[org.category]}</Chip>
        {org.location && <Chip>{org.location}</Chip>}
        {org.founded && <Chip>{m["org.founded"]({ year: org.founded })}</Chip>}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="md:col-span-2 space-y-6">
          <section className="corda-card p-5">
            <p className="eyebrow">{m["org.whatTheyDo"]()}</p>
            <p className="leading-relaxed mt-3 whitespace-pre-line" style={{ color: "var(--ink-70)" }}>{org.description}</p>
          </section>

          <section className="corda-card p-5" style={{ borderLeft: "2px solid var(--accent-warm)" }}>
            <p className="eyebrow eyebrow-accent">{m["org.whyOnMap"]()}</p>
            <p className="leading-relaxed mt-3" style={{ color: "var(--ink-70)" }}>{org.aiDemocracyAngle}</p>
          </section>

          {org.keyProjects.length > 0 && (
            <section className="corda-card p-5">
              <p className="eyebrow">{m["org.keyProjects"]()}</p>
              <ul className="mt-3 space-y-3">
                {org.keyProjects.map((p) => (
                  <li key={p.name} className="flex gap-3">
                    <span className="mt-0.5" style={{ color: "var(--ink-40)" }}>▸</span>
                    <div>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold underline-offset-2 hover:underline">
                          {p.name}
                        </a>
                      ) : (
                        <span className="font-semibold">{p.name}</span>
                      )}
                      {p.note && <p className="text-sm mt-0.5" style={{ color: "var(--ink-50)" }}>{p.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="corda-card p-5">
            <p className="eyebrow">{m["org.focusAreas"]()}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {org.focusTags.map((t) => (
                <span key={t} className="corda-tag">{t}</span>
              ))}
            </div>
          </section>

          {org.funders.length > 0 && (
            <section className="corda-card p-5">
              <p className="eyebrow">{m["org.funders"]()}</p>
              <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--ink-70)" }}>
                {org.funders.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </section>
          )}

          {region && (
            <section className="corda-card p-5">
              <p className="eyebrow">{m["common.district"]()}</p>
              <p className="font-bold mt-2">{region.name}</p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-50)" }}>{region.blurb}</p>
            </section>
          )}
        </aside>
      </div>

      {neighbors.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3 dashed-b pb-2">
            <span className="eyebrow">{m["org.moreIn"]()}</span>
            <h2 className="text-xl font-bold">{region?.name}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {neighbors.map((o) => (
              <OrgCard key={o.slug} org={o} />
            ))}
          </div>
        </section>
      )}

      {editOpen && (
        <Suspense fallback={null}>
          <SuggestEditPanel org={org} onClose={() => setEditOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function Chip({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <span className={`corda-tag ${accent ? "corda-tag-solid" : ""}`}>{children}</span>;
}
