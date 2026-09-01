import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ApiError,
  adminListEdits,
  adminListSubmissions,
  adminReopen,
  adminRequestLoginLink,
  adminResolve,
  adminResolveSubmission,
  adminSaveSubmissionDraft,
  adminUpdateOrg,
  fetchOrg,
  fetchOrgs,
  isV2Org,
  type EditChanges,
  type EditStatus,
  type EditSuggestion,
  type NewOrgDraft,
  type NewOrgDraftFull,
  type OrgSubmission,
  type SubmissionV2Org,
} from "../lib/api";
import { useOrgs } from "../lib/useOrgs";
import { REGION_BY_ID, REGIONS } from "../data/regions";
import {
  CATEGORY_LABELS,
  DEPTH_LABELS,
  type Category,
  type DepthRing,
  type KeyProject,
  type Organization,
  type OrgSummary,
  type RegionId,
} from "../data/types";
import { isValidHttpUrl } from "../lib/forms";
import { uploadUrl } from "../lib/orgs";
import { KeyProjectsField } from "../components/admin/KeyProjectsField";
import { m } from "../paraglide/messages.js";

const STATUSES: EditStatus[] = ["pending", "approved", "rejected"];
// runtime-keyed lookups stay explicit maps of message functions: exhaustive
// under TS and still tree-shaken per message
const STATUS_LABELS: Record<EditStatus, () => string> = {
  pending: m["admin.status.pending"],
  approved: m["admin.status.approved"],
  rejected: m["admin.status.rejected"],
};
const STATUS_EMPTY: Record<EditStatus, () => string> = {
  pending: m["admin.empty.pending"],
  approved: m["admin.empty.approved"],
  rejected: m["admin.empty.rejected"],
};
const EDIT_COUNT: Record<EditStatus, (inputs: { count: number }) => string> = {
  pending: m["admin.editCount.pending"],
  approved: m["admin.editCount.approved"],
  rejected: m["admin.editCount.rejected"],
};
const SUBMISSION_COUNT: Record<EditStatus, (inputs: { count: number }) => string> = {
  pending: m["admin.submissionCount.pending"],
  approved: m["admin.submissionCount.approved"],
  rejected: m["admin.submissionCount.rejected"],
};
const FIELD_LABELS: Record<keyof EditChanges, () => string> = {
  tagline: m["forms.fields.tagline"],
  description: m["forms.fields.description"],
  aiDemocracyAngle: m["forms.fields.angle"],
  website: m["forms.fields.websiteUrl"],
  logoUpload: m["admin.fieldLabels.logoUpload"],
  keyProjects: m["forms.fields.keyProjects"],
  note: m["admin.contributorNote"],
};

type AdminTab = "edits" | "submissions" | "orgs";

/** Shown on a 401: mails a one-time sign-in link to the maintainer inbox. */
function LoginPrompt() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  if (state === "sent") {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--ink-50)" }}>
        {m["admin.loginSent"]()}
      </p>
    );
  }
  return (
    <>
      {state === "failed" && (
        <p className="mt-3 text-sm" style={{ color: "var(--accent-warm)" }}>
          {m["admin.loginFailed"]()}
        </p>
      )}
    <button
      type="button"
      disabled={state === "sending"}
      onClick={() => {
        setState("sending");
        void adminRequestLoginLink().then(
          () => setState("sent"),
          () => setState("failed")
        );
      }}
      className="btn-corda-primary mt-3"
      style={state === "sending" ? { opacity: 0.5 } : undefined}
    >
      {state === "sending" ? m["admin.loginSending"]() : m["admin.loginRequest"]()}
    </button>
    </>
  );
}

/** Hidden admin page (not in the header nav). The Worker's /api/admin/* routes
 * accept a signed session cookie, obtained by clicking a one-time link mailed
 * to the maintainer inbox. */
export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("edits");
  const [status, setStatus] = useState<EditStatus>("pending");
  const [edits, setEdits] = useState<EditSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const describeError = useCallback((err: unknown): string => {
    const denied = err instanceof ApiError && err.status === 401;
    setNeedsLogin(denied);
    return denied ? m["admin.accessDenied"]() : reachMessage(err);
  }, []);

  useEffect(() => {
    if (tab !== "edits") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminListEdits(status)
      .then((data) => {
        if (!cancelled) setEdits(data);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, tab, describeError]);

  async function resolve(id: number, action: "approve" | "reject") {
    const snapshot = edits;
    setBusyId(id);
    setError(null);
    setEdits((cur) => cur.filter((e) => e.id !== id)); // optimistic removal
    try {
      await adminResolve(id, action);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already resolved elsewhere — the optimistic removal is correct.
        setError(m["admin.editResolved"]());
      } else {
        setEdits(snapshot); // rollback
        setError(describeError(err));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reopenEdit(id: number) {
    const snapshot = edits;
    setBusyId(id);
    setError(null);
    setEdits((cur) => cur.filter((e) => e.id !== id)); // optimistic removal
    try {
      await adminReopen("edits", id);
    } catch (err) {
      setEdits(snapshot); // rollback
      setError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{m["admin.eyebrow"]()}</p>
          <h1 className="text-2xl font-bold tracking-tight">{m["admin.queueHeading"]()}</h1>
        </div>
        <p className="text-xs" style={{ color: "var(--ink-50)" }}>
          {m["admin.accessNote"]()}
        </p>
      </div>

      {/* top-level tabs: contributor edits, new-organization submissions, published orgs */}
      <div className="flex flex-wrap gap-5 mt-6 dashed-b pb-3">
        <TabButton active={tab === "edits"} onClick={() => setTab("edits")}>
          {m["admin.tabEdits"]()}
        </TabButton>
        <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")}>
          {m["admin.tabSubmissions"]()}
        </TabButton>
        <TabButton active={tab === "orgs"} onClick={() => setTab("orgs")}>
          {m["admin.tabOrgs"]()}
        </TabButton>
      </div>

      {tab === "orgs" ? (
        <OrgsTab describeError={describeError} needsLogin={needsLogin} />
      ) : tab === "edits" ? (
        <>
          <div className="flex flex-wrap gap-2 mt-6">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`corda-chip ${status === s ? "is-active" : ""}`}
              >
                {STATUS_LABELS[s]()}
              </button>
            ))}
          </div>

          <p className="text-sm mt-4" style={{ color: "var(--ink-50)" }}>
            {EDIT_COUNT[status]({ count: edits.length })}
          </p>

          {error && (
            <>
              <p className="mt-4 text-sm" style={{ color: "var(--accent-warm)" }}>
                {error}
              </p>
              {needsLogin && <LoginPrompt />}
            </>
          )}
          {loading && (
            <p className="mt-4 text-sm" style={{ color: "var(--ink-50)" }}>
              {m["admin.loading"]()}
            </p>
          )}
          {!loading && !edits.length && !error && (
            <p className="mt-16 text-center" style={{ color: "var(--ink-50)" }}>
              {STATUS_EMPTY[status]()}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {edits.map((edit) => (
              <EditCard
                key={edit.id}
                edit={edit}
                busy={busyId === edit.id}
                readOnly={status !== "pending"}
                onResolve={resolve}
                onReopen={reopenEdit}
              />
            ))}
          </div>
        </>
      ) : (
        <SubmissionsQueue describeError={describeError} needsLogin={needsLogin} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`eyebrow ${active ? "eyebrow-accent" : ""}`}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        ...(active ? {} : { color: "var(--ink-40)" }),
      }}
    >
      {children}
    </button>
  );
}

function EditCard({
  edit,
  busy,
  readOnly,
  onResolve,
  onReopen,
}: {
  edit: EditSuggestion;
  busy: boolean;
  readOnly: boolean;
  onResolve: (id: number, action: "approve" | "reject") => void;
  onReopen: (id: number) => void;
}) {
  // "note" is a message to the curator, not a proposed field value — shown separately
  const fields = (Object.keys(edit.changes) as (keyof EditChanges)[]).filter((f) => f !== "note");
  return (
    <div className="corda-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-bold text-base leading-[normal]">{edit.orgName}</h3>
          <p className="eyebrow eyebrow-meta mt-1">{edit.orgSlug}</p>
        </div>
        <p className="text-xs" style={{ color: "var(--ink-40)" }}>
          {formatDate(edit.createdAt)}
        </p>
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--ink-50)" }}>
        {contributorLine(edit)}
      </p>

      {edit.changes.note && (
        <p
          className="text-sm mt-3 p-2.5 whitespace-pre-line break-words"
          style={{ border: "1px dashed var(--dash)" }}
        >
          <span className="eyebrow eyebrow-meta block mb-1" style={{ color: "var(--ink-40)" }}>
            {m["admin.contributorNote"]()}
          </span>
          {edit.changes.note}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {fields.map((f) => (
          <div key={f} className="dashed-b pb-3">
            <p className="eyebrow">{FIELD_LABELS[f]()}</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div>
                <p className="eyebrow eyebrow-meta" style={{ color: "var(--ink-40)" }}>
                  {m["admin.current"]()}
                </p>
                <FieldValue field={f} value={edit.current[f]} accent={false} />
              </div>
              <div>
                <p
                  className="eyebrow eyebrow-meta"
                  style={{ color: "var(--accent-warm)" }}
                >
                  {m["admin.proposed"]()}
                </p>
                <FieldValue field={f} value={edit.changes[f]} accent />
              </div>
            </div>
          </div>
        ))}
      </div>

      {readOnly ? (
        <ReopenButton busy={busy} onClick={() => onReopen(edit.id)} />
      ) : (
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve(edit.id, "approve")}
            className="btn-corda-primary"
            style={busy ? { opacity: 0.5 } : undefined}
          >
            {busy ? m["admin.busy"]() : m["admin.apply"]()}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve(edit.id, "reject")}
            className="btn-corda"
            style={busy ? { opacity: 0.5 } : undefined}
          >
            {m["admin.reject"]()}
          </button>
        </div>
      )}
    </div>
  );
}

/** Render one before/after value: text for most fields, a thumbnail for a
 * proposed logo upload, a list for key projects, or an em dash when empty. */
function FieldValue({
  field,
  value,
  accent,
}: {
  field: keyof EditChanges;
  value?: string | KeyProject[];
  accent: boolean;
}) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <p className="text-sm mt-1" style={{ color: "var(--ink-40)" }}>—</p>;
  }
  if (field === "logoUpload" && typeof value === "string") {
    return (
      <img
        src={uploadUrl(value)}
        alt=""
        className="w-12 h-12 mt-1 bg-white object-contain p-1"
        style={{ border: "1px solid var(--hairline)" }}
      />
    );
  }
  if (field === "keyProjects" && Array.isArray(value)) {
    return (
      <ul className="text-sm mt-1 space-y-0.5">
        {value.map((p, i) => (
          <li
            key={i}
            className="whitespace-pre-line break-words"
            style={{ color: accent ? "var(--ink)" : "var(--ink-50)" }}
          >
            {p.name}
            {p.url ? ` — ${p.url}` : ""}
            {/* the note is published with the project, so it must be reviewable here */}
            {p.note && (
              <span className="block" style={{ color: "var(--ink-40)" }}>
                {p.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p
      className="text-sm mt-1 whitespace-pre-line break-words"
      style={{ color: accent ? "var(--ink)" : "var(--ink-50)" }}
    >
      {value as string}
    </p>
  );
}

function ReopenButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="btn-corda mt-5"
      style={busy ? { opacity: 0.5 } : undefined}
    >
      {busy ? m["admin.busy"]() : m["admin.reopen"]()}
    </button>
  );
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Flag-only match against the live org list: same name, or a shared hostname. */
function findDuplicate(
  orgs: OrgSummary[] | null,
  name: string,
  urls: string[],
): OrgSummary | undefined {
  return orgs?.find(
    (o) =>
      o.name.toLowerCase() === name.toLowerCase() ||
      urls.some((u) => host(u) !== "" && host(u) === host(o.website)),
  );
}

function DuplicateWarning({ org }: { org: OrgSummary }) {
  return (
    <p
      className="text-sm px-3 py-2 mt-4"
      style={{ color: "var(--accent-warm)", border: "1px dashed var(--accent-warm)" }}
    >
      {m["admin.duplicate"]()}{" "}
      <Link
        to={`/org/${org.slug}`}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {org.slug}
      </Link>
    </p>
  );
}

/** New-organization submissions queue — parallels the edits queue with its own
 * status sub-tabs and optimistic resolve. Publishing an enriched submission
 * inserts the org row, and the map serves it on the next load. */
function SubmissionsQueue({
  describeError,
  needsLogin,
}: {
  describeError: (err: unknown) => string;
  needsLogin: boolean;
}) {
  const [status, setStatus] = useState<EditStatus>("pending");
  const [subs, setSubs] = useState<OrgSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [published, setPublished] = useState<{ slug: string | null } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { orgs } = useOrgs();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPublished(null);
    adminListSubmissions(status)
      .then((data) => {
        if (!cancelled) setSubs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, describeError]);

  async function resolve(id: number, action: "approve" | "reject") {
    const snapshot = subs;
    setBusyId(id);
    setError(null);
    setSubs((cur) => cur.filter((s) => s.id !== id)); // optimistic removal
    try {
      const result = await adminResolveSubmission(id, action);
      if (action === "approve") setPublished({ slug: result.slug ?? null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(m["admin.submissionResolved"]());
      } else {
        setSubs(snapshot); // rollback
        setError(describeError(err));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reopenSubmission(id: number) {
    const snapshot = subs;
    setBusyId(id);
    setError(null);
    setSubs((cur) => cur.filter((s) => s.id !== id)); // optimistic removal
    try {
      await adminReopen("submissions", id);
    } catch (err) {
      setSubs(snapshot); // rollback
      setError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function saveDraft(id: number, draft: NewOrgDraftFull): Promise<boolean> {
    setError(null);
    try {
      await adminSaveSubmissionDraft(id, draft);
      setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, draft } : s)));
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(m["admin.submissionResolved"]());
      } else {
        setError(describeError(err));
      }
      return false;
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`corda-chip ${status === s ? "is-active" : ""}`}
          >
            {STATUS_LABELS[s]()}
          </button>
        ))}
      </div>

      <p className="text-sm mt-4" style={{ color: "var(--ink-50)" }}>
        {SUBMISSION_COUNT[status]({ count: subs.length })}
      </p>

      {published && (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-70)" }}>
          {published.slug === null ? (
            m["admin.approvedNoOrg"]()
          ) : (
            <>
              {m["admin.published"]()}{" "}
              <Link
                to={`/org/${published.slug}`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                /org/{published.slug}
              </Link>
            </>
          )}
        </p>
      )}

      {error && (
        <>
          <p className="mt-4 text-sm" style={{ color: "var(--accent-warm)" }}>
            {error}
          </p>
          {needsLogin && <LoginPrompt />}
        </>
      )}
      {loading && (
        <p className="mt-4 text-sm" style={{ color: "var(--ink-50)" }}>
          {m["admin.loading"]()}
        </p>
      )}
      {!loading && !subs.length && !error && (
        <p className="mt-16 text-center" style={{ color: "var(--ink-50)" }}>
          {STATUS_EMPTY[status]()}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {subs.map((sub) => (
          <SubmissionCard
            key={sub.id}
            sub={sub}
            busy={busyId === sub.id}
            readOnly={status !== "pending"}
            editing={editingId === sub.id}
            onToggleEdit={(id) => setEditingId((cur) => (cur === id ? null : id))}
            onResolve={resolve}
            onReopen={reopenSubmission}
            onSaveDraft={saveDraft}
            orgs={orgs}
          />
        ))}
      </div>
    </>
  );
}

// ---------- orgs tab (browse, search, edit any live organization) ----------

/** Fields the admin may edit — mirrors worker/src/admin.ts's ORG_COLUMN keys.
 * `slug` is deliberately absent: it is immutable, shown but never editable. */
const ORG_EDIT_KEYS: (keyof Organization)[] = [
  "name", "website", "tagline", "description", "aiDemocracyAngle", "location",
  "logoDomain", "category", "region", "depthRing", "founded", "focusTags",
  "funders", "keyProjects",
];
// mirrors the limits enforced by validateOrgUpdate in worker/src/validate.ts
const ORG_TEXT_MAX = {
  name: 120, website: 300, tagline: 200, description: 3000,
  aiDemocracyAngle: 1000, location: 120, logoDomain: 120,
  focusTag: 40, funder: 120,
} as const;
const MAX_KEY_PROJECTS = 6;

function diffOrg(original: Organization, draft: Organization): Partial<Organization> {
  const changes: Record<string, unknown> = {};
  for (const key of ORG_EDIT_KEYS) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(original[key])) changes[key] = draft[key];
  }
  return changes as Partial<Organization>;
}

/** Browse/search/edit tab. A save here must be reflected in the list at once,
 * so the list bypasses both useOrgs's module-cached promise and the HTTP cache. */
function OrgsTab({
  describeError,
  needsLogin,
}: {
  describeError: (err: unknown) => string;
  needsLogin: boolean;
}) {
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrgs(await fetchOrgs(undefined, undefined, { noCache: true }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [describeError]);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orgs ?? [];
    const matched = q
      ? list.filter((o) => [o.name, o.slug, o.tagline].some((v) => v.toLowerCase().includes(q)))
      : list;
    return [...matched].sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs, query]);

  if (selectedSlug) {
    return (
      <OrgEditorPanel
        slug={selectedSlug}
        onClose={() => setSelectedSlug(null)}
        onSaved={loadOrgs}
        describeError={describeError}
        needsLogin={needsLogin}
      />
    );
  }

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={m["admin.orgs.searchPlaceholder"]()}
        className="corda-input w-full mt-6"
      />

      <p className="text-sm mt-4" style={{ color: "var(--ink-50)" }}>
        {m["admin.orgs.count"]({ count: filtered.length })}
      </p>

      {error && (
        <>
          <p className="mt-4 text-sm" style={{ color: "var(--accent-warm)" }}>
            {error}
          </p>
          {needsLogin && <LoginPrompt />}
        </>
      )}
      {loading && (
        <p className="mt-4 text-sm" style={{ color: "var(--ink-50)" }}>
          {m["admin.loading"]()}
        </p>
      )}
      {!loading && !filtered.length && !error && (
        <p className="mt-16 text-center" style={{ color: "var(--ink-50)" }}>
          {m["admin.orgs.noResults"]()}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {filtered.map((o) => {
          const region = REGION_BY_ID[o.region];
          return (
            <button
              key={o.slug}
              type="button"
              onClick={() => setSelectedSlug(o.slug)}
              className="corda-card w-full text-left p-4 flex flex-wrap items-center justify-between gap-2"
              style={{ cursor: "pointer" }}
            >
              <div>
                <p className="font-bold text-sm leading-tight">{o.name}</p>
                <p className="eyebrow eyebrow-meta mt-1">{o.slug}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {region && <span className="corda-tag">{region.name}</span>}
                <span className="corda-tag">{DEPTH_LABELS[o.depthRing]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Loads the full record for the selected slug, then hands it to OrgEditor. */
function OrgEditorPanel({
  slug,
  onClose,
  onSaved,
  describeError,
  needsLogin,
}: {
  slug: string;
  onClose: () => void;
  onSaved: () => void;
  describeError: (err: unknown) => string;
  needsLogin: boolean;
}) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrg(slug)
      .then((data) => {
        if (!cancelled) setOrg(data);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, describeError]);

  return (
    <>
      <button type="button" onClick={onClose} className="btn-corda mt-6">
        {m["admin.orgs.backToList"]()}
      </button>

      {loading && (
        <p className="mt-4 text-sm" style={{ color: "var(--ink-50)" }}>
          {m["admin.loading"]()}
        </p>
      )}
      {error && (
        <>
          <p className="mt-4 text-sm" style={{ color: "var(--accent-warm)" }}>
            {error}
          </p>
          {needsLogin && <LoginPrompt />}
        </>
      )}
      {org && (
        <OrgEditor
          key={org.slug}
          org={org}
          onSaved={(updated) => {
            setOrg(updated);
            onSaved();
          }}
          describeError={describeError}
        />
      )}
    </>
  );
}

/** The edit form: every ORG_COLUMN field plus KeyProjectsField. Save sends
 * only the fields that differ from the record as loaded. */
function OrgEditor({
  org,
  onSaved,
  describeError,
}: {
  org: Organization;
  onSaved: (updated: Organization) => void;
  describeError: (err: unknown) => string;
}) {
  const [draft, setDraft] = useState<Organization>(org);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Organization>(key: K, value: Organization[K]) {
    setDraft((cur) => ({ ...cur, [key]: value }));
    setSaved(false);
  }

  const changes = useMemo(() => diffOrg(org, draft), [org, draft]);
  const dirty = Object.keys(changes).length > 0;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      await adminUpdateOrg(org.slug, changes);
      setSaved(true);
      onSaved(draft);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="corda-card p-5 mt-4">
      <div className="flex items-baseline justify-between gap-2 dashed-b pb-3">
        <div>
          <h3 className="font-bold text-base leading-[normal]">{draft.name}</h3>
          <p className="eyebrow eyebrow-meta mt-1">{org.slug}</p>
        </div>
        <Link
          to={`/org/${org.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2"
          style={{ color: "var(--ink-50)" }}
        >
          /org/{org.slug}
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <DraftField label={m["forms.fields.name"]()} required>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={ORG_TEXT_MAX.name}
            className="corda-input w-full mt-1.5"
          />
        </DraftField>
        <DraftField label={m["forms.fields.website"]()} required>
          <input
            value={draft.website}
            onChange={(e) => set("website", e.target.value)}
            maxLength={ORG_TEXT_MAX.website}
            className="corda-input w-full mt-1.5"
            inputMode="url"
          />
        </DraftField>
        <DraftField label={m["forms.fields.category"]()} required>
          <select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as Category)}
            className="corda-input w-full mt-1.5"
          >
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["common.district"]()} required>
          <select
            value={draft.region}
            onChange={(e) => set("region", e.target.value as RegionId)}
            className="corda-input w-full mt-1.5"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["forms.fields.depthRing"]()}>
          <select
            value={draft.depthRing}
            onChange={(e) => set("depthRing", e.target.value as DepthRing)}
            className="corda-input w-full mt-1.5"
          >
            {DEPTH_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["forms.fields.founded"]()}>
          <input
            value={draft.founded ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
              set("founded", digits ? Number(digits) : null);
            }}
            className="corda-input w-full mt-1.5"
            inputMode="numeric"
          />
        </DraftField>
        <DraftField label={m["forms.fields.location"]()}>
          <input
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            maxLength={ORG_TEXT_MAX.location}
            className="corda-input w-full mt-1.5"
          />
        </DraftField>
        <DraftField label={m["forms.fields.logoDomain"]()}>
          <input
            value={draft.logoDomain}
            onChange={(e) => set("logoDomain", e.target.value)}
            maxLength={ORG_TEXT_MAX.logoDomain}
            className="corda-input w-full mt-1.5"
          />
        </DraftField>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.tagline"]()} required>
            <textarea
              value={draft.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              maxLength={ORG_TEXT_MAX.tagline}
              rows={2}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.description"]()} required>
            <textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={ORG_TEXT_MAX.description}
              rows={5}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.angle"]()}>
            <textarea
              value={draft.aiDemocracyAngle}
              onChange={(e) => set("aiDemocracyAngle", e.target.value)}
              maxLength={ORG_TEXT_MAX.aiDemocracyAngle}
              rows={3}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.focusTags"]()}>
            <TagEditor
              values={draft.focusTags}
              onChange={(v) => set("focusTags", v)}
              max={MAX_TAGS}
              itemMax={ORG_TEXT_MAX.focusTag}
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.funders"]()}>
            <TagEditor
              values={draft.funders}
              onChange={(v) => set("funders", v)}
              itemMax={ORG_TEXT_MAX.funder}
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <KeyProjectsField
            value={draft.keyProjects}
            onChange={(v) => set("keyProjects", v)}
            max={MAX_KEY_PROJECTS}
          />
        </div>
      </div>

      {error && (
        <p
          className="text-sm px-3 py-2 mt-3"
          style={{ color: "var(--accent-warm)", border: "1px dashed var(--accent-warm)" }}
        >
          {error}
        </p>
      )}
      {!error && saved && (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-70)" }}>
          {m["admin.published"]()}{" "}
          <Link
            to={`/org/${org.slug}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            /org/{org.slug}
          </Link>
        </p>
      )}

      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => void save()}
        className="btn-corda-primary mt-4"
        style={saving || !dirty ? { opacity: 0.5 } : undefined}
      >
        {saving ? m["admin.draft.saving"]() : m["admin.orgs.save"]()}
      </button>
    </div>
  );
}

interface SubmissionCardProps {
  sub: OrgSubmission;
  busy: boolean;
  readOnly: boolean;
  editing: boolean;
  onToggleEdit: (id: number) => void;
  onResolve: (id: number, action: "approve" | "reject") => void;
  onReopen: (id: number) => void;
  onSaveDraft: (id: number, draft: NewOrgDraftFull) => Promise<boolean>;
  orgs: OrgSummary[] | null;
}

function SubmissionCard(props: SubmissionCardProps) {
  return isV2Org(props.sub.org) ? (
    <SubmissionV2Card {...props} org={props.sub.org} />
  ) : (
    <SubmissionV1Card {...props} org={props.sub.org} />
  );
}

/** Lean v2 row: identity + links, enriched via the inline draft editor. */
function SubmissionV2Card({
  sub,
  org,
  busy,
  readOnly,
  editing,
  onToggleEdit,
  onResolve,
  onReopen,
  onSaveDraft,
  orgs,
}: SubmissionCardProps & { org: SubmissionV2Org }) {
  const hasDraft = sub.draft != null;
  const duplicate = findDuplicate(orgs, org.name, org.urls);
  return (
    <div className="corda-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-bold text-base leading-[normal]">{org.name}</h3>
          {org.email ? (
            <a
              href={`mailto:${org.email}`}
              className="text-xs underline underline-offset-2"
              style={{ color: "var(--ink-50)" }}
            >
              {org.email}
            </a>
          ) : (
            <p className="text-xs" style={{ color: "var(--ink-40)" }}>
              {m["admin.noContactEmail"]()}
            </p>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--ink-40)" }}>
          {formatDate(sub.createdAt)}
        </p>
      </div>

      <ul className="mt-3 space-y-1">
        {org.urls.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-2 break-words"
              style={{ color: "var(--ink-70)" }}
            >
              {url}
            </a>
          </li>
        ))}
      </ul>

      {org.note && (
        <p className="text-sm mt-3 whitespace-pre-line" style={{ color: "var(--ink-50)" }}>
          {org.note}
        </p>
      )}

      {readOnly && <ReopenButton busy={busy} onClick={() => onReopen(sub.id)} />}

      {!readOnly && (
        <>
          {duplicate && <DuplicateWarning org={duplicate} />}
          <p className="eyebrow mt-4" style={{ color: hasDraft ? "var(--ink-50)" : "var(--accent-warm)" }}>
            {hasDraft ? m["admin.draftReady"]() : m["admin.draftNeeded"]()}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={() => onToggleEdit(sub.id)} className="btn-corda">
              {editing ? m["admin.closeEditor"]() : hasDraft ? m["admin.editDraft"]() : m["admin.enrich"]()}
            </button>
            <button
              type="button"
              disabled={busy || !hasDraft}
              onClick={() => onResolve(sub.id, "approve")}
              className="btn-corda-primary"
              style={busy || !hasDraft ? { opacity: 0.5 } : undefined}
            >
              {busy ? m["admin.busy"]() : m["admin.publish"]()}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(sub.id, "reject")}
              className="btn-corda"
              style={busy ? { opacity: 0.5 } : undefined}
            >
              {m["admin.reject"]()}
            </button>
          </div>
          {editing && (
            <DraftEditor
              key={sub.id}
              sub={sub}
              org={org}
              onSave={(draft) => onSaveDraft(sub.id, draft)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Grandfathered v1 row: full org draft filed by the old form, shown
 * read-only and approved verbatim. */
function SubmissionV1Card({
  sub,
  org,
  busy,
  readOnly,
  onResolve,
  onReopen,
  orgs,
}: SubmissionCardProps & { org: NewOrgDraft }) {
  const region = REGION_BY_ID[org.region];
  const duplicate = findDuplicate(orgs, org.name, [org.website]);
  return (
    <div className="corda-card p-5">
      <div className="flex items-start gap-3">
        {org.logoUpload ? (
          <img
            src={uploadUrl(org.logoUpload)}
            alt=""
            className="w-12 h-12 shrink-0 bg-white object-contain p-1"
            style={{ border: "1px solid var(--hairline)" }}
          />
        ) : (
          <div
            className="w-12 h-12 shrink-0 grid place-items-center"
            style={{ border: "1px dashed var(--dash)", color: "var(--ink-40)" }}
          >
            <span className="eyebrow">{m["common.imagePlaceholder"]()}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-base leading-tight">{org.name}</h3>
          <a
            href={org.website}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline underline-offset-2 break-words"
            style={{ color: "var(--ink-50)" }}
          >
            {org.website}
          </a>
        </div>
        <p className="text-xs shrink-0" style={{ color: "var(--ink-40)" }}>
          {formatDate(sub.createdAt)}
        </p>
      </div>

      <p className="text-sm mt-3" style={{ color: "var(--ink-70)" }}>
        {org.tagline}
      </p>
      <p className="text-sm mt-2 whitespace-pre-line" style={{ color: "var(--ink-50)" }}>
        {org.description}
      </p>
      {org.aiDemocracyAngle && (
        <p className="text-sm mt-2 whitespace-pre-line" style={{ color: "var(--ink-50)" }}>
          <span className="eyebrow eyebrow-accent">{FIELD_LABELS.aiDemocracyAngle()}</span>
          <br />
          {org.aiDemocracyAngle}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="corda-tag corda-tag-solid">{CATEGORY_LABELS[org.category]}</span>
        {region && <span className="corda-tag">{region.name}</span>}
        {org.location && <span className="corda-tag">{org.location}</span>}
        {org.founded && <span className="corda-tag">{m["org.founded"]({ year: org.founded })}</span>}
        {org.focusTags.map((t) => (
          <span key={t} className="corda-tag">{t}</span>
        ))}
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-50)" }}>
        {contributorLineFor(sub.contributorName, sub.contributorEmail)}
      </p>

      {readOnly && <ReopenButton busy={busy} onClick={() => onReopen(sub.id)} />}

      {!readOnly && (
        <>
          {duplicate && <DuplicateWarning org={duplicate} />}
          <div className="flex gap-2 mt-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(sub.id, "approve")}
              className="btn-corda-primary"
              style={busy ? { opacity: 0.5 } : undefined}
            >
              {busy ? m["admin.busy"]() : m["admin.publish"]()}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(sub.id, "reject")}
              className="btn-corda"
              style={busy ? { opacity: 0.5 } : undefined}
            >
              {m["admin.reject"]()}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- draft editor (v2 enrichment) ----------

const DRAFT_LIMITS = {
  name: 120,
  website: 300,
  tagline: 200,
  description: 3000,
  aiDemocracyAngle: 1000,
  location: 120,
  tag: 40,
} as const;
const MAX_TAGS = 6;
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];
const DEPTH_OPTIONS = Object.entries(DEPTH_LABELS) as [DepthRing, string][];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Editor prefill: saved draft if any, else seeded from the lean submission
 * (website = first url, extra urls become key-project stubs). */
/** A draft mid-enrichment: taxonomy fields are empty until the admin picks. */
type DraftInProgress = Omit<NewOrgDraftFull, "category" | "region"> & {
  category: Category | "";
  region: RegionId | "";
};

function seedDraft(sub: OrgSubmission, org: SubmissionV2Org): DraftInProgress {
  if (sub.draft) return sub.draft;
  return {
    name: org.name,
    website: org.urls[0] ?? "",
    tagline: "",
    description: "",
    category: "",
    region: "",
    focusTags: [],
    depthRing: "core",
    funders: [],
    keyProjects: org.urls.slice(1).map((url) => ({ name: hostnameOf(url), url })),
  };
}

/** Validate an in-progress draft; on success the taxonomy fields are narrowed
 * and the payload is the trimmed one the backend expects. */
function validateDraft(d: DraftInProgress): { error: string } | { draft: NewOrgDraftFull } {
  if (!d.name.trim()) return { error: m["forms.nameRequired"]() };
  if (!isValidHttpUrl(d.website)) return { error: m["forms.invalidWebsite"]() };
  if (!d.tagline.trim()) return { error: m["admin.draft.taglineRequired"]() };
  if (!d.description.trim()) return { error: m["admin.draft.descriptionRequired"]() };
  if (!d.category) return { error: m["admin.draft.categoryRequired"]() };
  if (!d.region) return { error: m["admin.draft.districtRequired"]() };
  if (d.focusTags.length > MAX_TAGS) return { error: m["admin.draft.tooManyTags"]({ max: MAX_TAGS }) };
  if (d.founded != null && !/^\d{4}$/.test(String(d.founded)))
    return { error: m["admin.draft.invalidFounded"]() };
  for (const p of d.keyProjects) {
    if (!p.name.trim()) return { error: m["admin.draft.projectNameRequired"]() };
    if (p.url && !isValidHttpUrl(p.url)) return { error: m["admin.draft.invalidProjectUrl"]() };
  }
  return { draft: cleanDraft({ ...d, category: d.category, region: d.region }) };
}

/** Trimmed payload matching the backend OrgDraftFull (empty optionals dropped). */
function cleanDraft(d: NewOrgDraftFull): NewOrgDraftFull {
  return {
    name: d.name.trim(),
    website: d.website.trim(),
    tagline: d.tagline.trim(),
    description: d.description.trim(),
    ...(d.aiDemocracyAngle?.trim() ? { aiDemocracyAngle: d.aiDemocracyAngle.trim() } : {}),
    category: d.category,
    region: d.region,
    focusTags: d.focusTags,
    ...(d.location?.trim() ? { location: d.location.trim() } : {}),
    ...(d.founded != null ? { founded: d.founded } : {}),
    depthRing: d.depthRing,
    funders: d.funders,
    keyProjects: d.keyProjects.map((p) => ({
      name: p.name.trim(),
      ...(p.url?.trim() ? { url: p.url.trim() } : {}),
      ...(p.note?.trim() ? { note: p.note.trim() } : {}),
    })),
  };
}

function DraftEditor({
  sub,
  org,
  onSave,
}: {
  sub: OrgSubmission;
  org: SubmissionV2Org;
  onSave: (draft: NewOrgDraftFull) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<DraftInProgress>(() => seedDraft(sub, org));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function set<K extends keyof DraftInProgress>(key: K, value: DraftInProgress[K]) {
    setDraft((cur) => ({ ...cur, [key]: value }));
    setDirty(true);
  }

  const save = useCallback(async () => {
    const result = validateDraft(draft);
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setSaving(true);
    const ok = await onSave(result.draft);
    setSaving(false);
    if (ok) setDirty(false);
  }, [draft, onSave]);

  // Ctrl/Cmd+S saves the draft while the editor is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="mt-5 pt-4" style={{ borderTop: "1px dashed var(--dash)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow eyebrow-accent">{m["admin.draft.heading"]()}</p>
        {dirty && (
          <span className="eyebrow" style={{ color: "var(--accent-warm)" }}>
            {m["admin.draft.unsaved"]()}
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <DraftField label={m["forms.fields.name"]()} required>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={DRAFT_LIMITS.name}
            className="corda-input w-full mt-1.5"
          />
        </DraftField>
        <DraftField label={m["forms.fields.website"]()} required>
          <input
            value={draft.website}
            onChange={(e) => set("website", e.target.value)}
            maxLength={DRAFT_LIMITS.website}
            className="corda-input w-full mt-1.5"
            inputMode="url"
          />
        </DraftField>
        <DraftField label={m["forms.fields.category"]()} required>
          <select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as Category | "")}
            className="corda-input w-full mt-1.5"
          >
            <option value="">{m["admin.draft.select"]()}</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["common.district"]()} required>
          <select
            value={draft.region}
            onChange={(e) => set("region", e.target.value as RegionId | "")}
            className="corda-input w-full mt-1.5"
          >
            <option value="">{m["admin.draft.select"]()}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["forms.fields.depthRing"]()}>
          <select
            value={draft.depthRing}
            onChange={(e) => set("depthRing", e.target.value as DepthRing)}
            className="corda-input w-full mt-1.5"
          >
            {DEPTH_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </DraftField>
        <DraftField label={m["forms.fields.founded"]()}>
          <input
            value={draft.founded ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
              set("founded", digits ? Number(digits) : null);
            }}
            className="corda-input w-full mt-1.5"
            inputMode="numeric"
            placeholder={m["admin.draft.foundedPlaceholder"]()}
          />
        </DraftField>
        <DraftField label={m["forms.fields.location"]()}>
          <input
            value={draft.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
            maxLength={DRAFT_LIMITS.location}
            className="corda-input w-full mt-1.5"
          />
        </DraftField>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.tagline"]()} required>
            <textarea
              value={draft.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              maxLength={DRAFT_LIMITS.tagline}
              rows={2}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.description"]()} required>
            <textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={DRAFT_LIMITS.description}
              rows={5}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.angle"]()}>
            <textarea
              value={draft.aiDemocracyAngle ?? ""}
              onChange={(e) => set("aiDemocracyAngle", e.target.value)}
              maxLength={DRAFT_LIMITS.aiDemocracyAngle}
              rows={3}
              className="corda-textarea mt-1.5"
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["admin.draft.focusTags"]({ max: MAX_TAGS })}>
            <TagEditor
              values={draft.focusTags}
              onChange={(v) => set("focusTags", v)}
              max={MAX_TAGS}
              itemMax={DRAFT_LIMITS.tag}
            />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.funders"]()}>
            <TagEditor values={draft.funders} onChange={(v) => set("funders", v)} />
          </DraftField>
        </div>
        <div className="sm:col-span-2">
          <DraftField label={m["forms.fields.keyProjects"]()}>
            <KeyProjectRows
              values={draft.keyProjects}
              onChange={(v) => set("keyProjects", v)}
            />
          </DraftField>
        </div>
      </div>

      {problem && (
        <p
          className="text-sm px-3 py-2 mt-3"
          style={{ color: "var(--accent-warm)", border: "1px dashed var(--accent-warm)" }}
        >
          {problem}
        </p>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="btn-corda-primary mt-4"
        style={saving ? { opacity: 0.5 } : undefined}
      >
        {saving ? m["admin.draft.saving"]() : m["admin.draft.save"]()}
      </button>
    </div>
  );
}

function DraftField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="eyebrow">
        {label}
        {required && <span style={{ color: "var(--accent-warm)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Chip list with an add-on-Enter input (ported from the audit tool). */
function TagEditor({
  values,
  onChange,
  max,
  itemMax,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  itemMax?: number;
}) {
  const [text, setText] = useState("");

  function add() {
    const value = text.trim();
    if (!value || values.includes(value)) return;
    if (max != null && values.length >= max) return;
    if (itemMax != null && value.length > itemMax) return;
    onChange([...values, value]);
    setText("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {values.map((value, i) => (
        <span key={value} className="corda-tag inline-flex items-center gap-1">
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            style={{ cursor: "pointer" }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={m["admin.draft.tagPlaceholder"]()}
        className="corda-input"
        style={{ maxWidth: "12rem" }}
      />
    </div>
  );
}

/** name / url / note rows with add + remove (ported from the audit tool). */
function KeyProjectRows({
  values,
  onChange,
}: {
  values: KeyProject[];
  onChange: (v: KeyProject[]) => void;
}) {
  function setRow(i: number, patch: Partial<KeyProject>) {
    onChange(values.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  return (
    <div className="space-y-2 mt-1.5">
      {values.map((p, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={p.name}
            onChange={(e) => setRow(i, { name: e.target.value })}
            placeholder={m["admin.draft.projectName"]()}
            className="corda-input flex-1 min-w-0"
          />
          <input
            value={p.url ?? ""}
            onChange={(e) => setRow(i, { url: e.target.value })}
            placeholder={m["admin.draft.projectUrl"]()}
            className="corda-input flex-1 min-w-0"
            inputMode="url"
          />
          <input
            value={p.note ?? ""}
            onChange={(e) => setRow(i, { note: e.target.value })}
            placeholder={m["admin.draft.projectNote"]()}
            className="corda-input flex-1 min-w-0"
          />
          <button
            type="button"
            aria-label="Remove project"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="corda-icon-btn shrink-0"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, { name: "" }])}
        className="btn-corda"
      >
        {m["admin.draft.addProject"]()}
      </button>
    </div>
  );
}

function contributorLine(edit: EditSuggestion): string {
  return contributorLineFor(edit.contributorName, edit.contributorEmail);
}

function contributorLineFor(name: string | null, email: string | null): string {
  const parts = [name, email].filter(Boolean);
  return parts.length ? m["admin.contributor"]({ parts: parts.join(" · ") }) : m["admin.anonymous"]();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function reachMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return m["errors.network"]();
    return err.message || m["errors.requestFailed"]({ status: err.status });
  }
  return m["errors.generic"]();
}
