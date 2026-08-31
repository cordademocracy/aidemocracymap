import { Fragment } from "react";
import { Link } from "react-router";
import { REGIONS } from "../data/regions";
import { useOrgs } from "../lib/useOrgs";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { richMessage } from "../copy/richMessage";
import { m } from "../paraglide/messages.js";

const RING_DEFS = [
  { term: "core", def: m["about.rings.core"] },
  { term: "adjacent", def: m["about.rings.adjacent"] },
  { term: "broad", def: m["about.rings.broad"] },
] as const;

export function AboutPage() {
  useDocumentTitle(m["about.label"]());
  const { orgs } = useOrgs();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <p className="eyebrow mb-3">{m["about.label"]()}</p>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{m["about.heading"]()}</h1>
      <p className="leading-relaxed mt-5" style={{ color: "var(--ink-70)" }}>
        <strong style={{ color: "var(--ink)" }}>{m["common.brandName"]()}</strong>{" "}
        {m["about.intro"]({ count: orgs?.length ?? "" })}
      </p>
      <p className="leading-relaxed mt-4" style={{ color: "var(--ink-70)" }}>
        {richMessage(m["about.homage.body"], {
          link: (
            <a
              href="https://aisafety.com/map"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {m["about.homage.linkText"]()}
            </a>
          ),
        })}
      </p>

      <p className="eyebrow mt-10 mb-4 block">{m["about.districtsHeading"]()}</p>
      <ul className="space-y-3">
        {REGIONS.map((r) => (
          <li key={r.id} className="flex gap-3">
            <span className="w-3 h-3 mt-1.5 shrink-0" style={{ background: r.fill }} />
            <div>
              <span className="font-bold">{r.name}</span>
              <span style={{ color: "var(--ink-50)" }}> — {r.blurb}</span>
            </div>
          </li>
        ))}
      </ul>

      <p className="eyebrow mt-10 mb-3 block">{m["about.ringsHeading"]()}</p>
      <p className="leading-relaxed" style={{ color: "var(--ink-70)" }}>
        {m["about.ringsLead"]()}{" "}
        {RING_DEFS.map(({ term, def }, i) => (
          <Fragment key={term}>
            <strong style={{ color: "var(--ink)" }}>{term}</strong> ({def()})
            {i === RING_DEFS.length - 1 ? "." : i === RING_DEFS.length - 2 ? ", and " : ", "}
          </Fragment>
        ))}
      </p>

      <p className="eyebrow mt-10 mb-3 block">{m["about.methodHeading"]()}</p>
      <p className="leading-relaxed" style={{ color: "var(--ink-70)" }}>
        {m["about.method"]()}
      </p>

      <p className="eyebrow mt-10 mb-3 block">{m["about.creditsHeading"]()}</p>
      <p className="leading-relaxed" style={{ color: "var(--ink-70)", whiteSpace: "pre-line" }}>
        {richMessage(m["about.credits.body"], {
          sean: (
            <a
              href="https://inventsean.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Sean Ahrens
            </a>
          ),
          site: (
            <a
              href="https://aixdemocracy.fyi/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              aixdemocracy.fyi
            </a>
          ),
          corda: (
            <a
              href="https://cordademocracy.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              CORDA
            </a>
          ),
          repo: (
            <a
              href="https://github.com/cordademocracy/aidemocracymap"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              GitHub
            </a>
          ),
          email: (
            <a href="mailto:hello@cordademocracy.org" className="underline underline-offset-2">
              hello@cordademocracy.org
            </a>
          ),
        })}
      </p>

      <Link to="/" className="btn-corda-primary btn-corda-lg inline-flex mt-10">
        {m["common.backToMap"]()}
      </Link>
    </div>
  );
}
