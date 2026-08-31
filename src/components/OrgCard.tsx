import { Link } from "react-router";
import type { OrgSummary } from "../data/types";
import { m } from "../paraglide/messages.js";
import { OrgLogo } from "./OrgLogo";

// founded exists on snapshot orgs only, never on API summaries
export function OrgCard({ org }: { org: OrgSummary & { founded?: number | null } }) {
  return (
    <Link
      to={`/org/${org.slug}`}
      className="corda-card corda-card-hover group flex flex-col p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <OrgLogo
          org={org}
          size={40}
          className="w-10 h-10 bg-white object-contain p-1 shrink-0"
          style={{ border: "1px solid var(--hairline)" }}
        />
        <div className="min-w-0">
          <h3 className="font-bold leading-tight truncate text-base">{org.name}</h3>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3 flex-1 content-start">
        {org.focusTags.slice(0, 4).map((t) => (
          <span key={t} className="corda-tag">{t}</span>
        ))}
      </div>
      <p className="text-xs mt-2.5" style={{ color: "var(--ink-50)" }}>
        {org.location}
        {org.founded ? m["org.cardFounded"]({ year: org.founded }) : ""}
      </p>
    </Link>
  );
}
