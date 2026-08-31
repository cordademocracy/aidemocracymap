import { useEffect, useId, useRef, useState } from "react";
import type { Organization } from "../data/types";
import { submitEdit, uploadImage, type EditableField, type EditChanges } from "../lib/api";
import {
  isExpiredTokenError,
  isValidHttpUrl,
  MAX_UPLOAD_BYTES,
  messageFor,
  useFormDialog,
  useFormToken,
} from "../lib/forms";
import { useTurnstile } from "../lib/turnstile";
import { logoSrc } from "../lib/orgs";
import { m } from "../paraglide/messages.js";
import { HoneypotField } from "./HoneypotField";
import { LogoPicker } from "./LogoPicker";

const LIMITS: Record<EditableField, number> = {
  tagline: 200,
  description: 3000,
  aiDemocracyAngle: 1000,
};
const WEBSITE_LIMIT = 300;

/** Modal that lets an invited contributor propose edits to the three
 * free-text org fields. Only changed fields are sent; at least one is required. */
export function SuggestEditPanel({
  org,
  onClose,
}: {
  org: Organization;
  onClose: () => void;
}) {
  const [tagline, setTagline] = useState(org.tagline);
  const [description, setDescription] = useState(org.description);
  const [angle, setAngle] = useState(org.aiDemocracyAngle);
  const [website, setWebsite] = useState(org.website);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<EditableField>>(new Set());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const { token, error: tokenError, retry } = useFormToken();
  const { containerRef: turnstileRef, getToken: getTurnstileToken } = useTurnstile("suggest-edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);
  // an upload survives a failed submit; re-uploading the same file orphans a blob
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  const websiteId = useId();
  const nameId = useId();
  const emailId = useId();
  const logoId = useId();
  const taglineRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  const values: Record<EditableField, string> = {
    tagline,
    description,
    aiDemocracyAngle: angle,
  };
  const textChanges = collectChanges(org, values);
  const websiteChanged = website.trim() !== "" && website.trim() !== org.website.trim();
  const changeCount =
    Object.keys(textChanges).length + (websiteChanged ? 1 : 0) + (logoFile ? 1 : 0);
  // a blanked field is dropped from changeCount but still lost work
  const dirty =
    changeCount > 0 ||
    touched.size > 0 ||
    website.trim() !== org.website.trim() ||
    Boolean(name || email);

  const { requestClose, dialogProps } = useFormDialog({
    onClose,
    isDirty: () => dirty && !done,
    initialFocusRef: taglineRef,
  });

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  function edit(field: EditableField, setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setTouched((cur) => (cur.has(field) ? cur : new Set(cur).add(field)));
    };
  }

  function validate(): string | null {
    if (changeCount === 0) return m["forms.suggestEdit.noChanges"]();
    if (websiteChanged && !isValidHttpUrl(website)) return m["forms.invalidWebsite"]();
    if (logoFile && logoFile.size > MAX_UPLOAD_BYTES) return m["errors.imageTooLarge"]();
    return null;
  }

  async function post(formToken: string) {
    const changes: EditChanges = { ...textChanges };
    if (websiteChanged) changes.website = website.trim();
    // upload the replacement logo FIRST (same form token) so an oversized
    // or unsupported image fails before the edit is filed
    if (logoFile) {
      if (uploaded.current?.file !== logoFile) {
        const { id } = await uploadImage(formToken, logoFile);
        uploaded.current = { file: logoFile, id };
      }
      changes.logoUpload = uploaded.current.id;
    }
    await submitEdit({
      formToken,
      turnstileToken: await getTurnstileToken(),
      companyUrl,
      orgSlug: org.slug,
      changes,
      contributorName: name.trim() || undefined,
      contributorEmail: email.trim() || undefined,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    inFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const formToken = token || (await retry());
      if (!formToken) {
        setError(m["errors.network"]());
        return;
      }
      try {
        await post(formToken);
      } catch (err) {
        // an expired token is safe to surface, so retry once with a fresh one
        if (!isExpiredTokenError(err)) throw err;
        // the stale-token upload was silently dropped server-side; its id is
        // phantom and must not be reused with the fresh token
        uploaded.current = null;
        const fresh = await retry();
        if (!fresh) throw err;
        await post(fresh);
      }
      setDone(true);
    } catch (err) {
      setError(messageFor(err, m["forms.suggestEdit.fallbackError"]()));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      {...dialogProps}
      aria-label={m["forms.suggestEdit.dialogLabel"]({ orgName: org.name })}
      className="w-full max-w-xl p-0 m-auto max-h-[calc(100dvh-3rem)] overflow-y-auto backdrop:bg-black/55"
      style={{ background: "var(--surface)", color: "var(--ink)", border: "1px dashed var(--dash)" }}
    >
      <div className="flex items-start justify-between gap-4 p-5 dashed-b">
        <div>
          <p className="eyebrow eyebrow-accent">{m["forms.suggestEdit.title"]()}</p>
          <h2 className="text-xl font-bold tracking-tight mt-1">{org.name}</h2>
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label={m["common.close"]()}
          className="corda-icon-btn"
        >
          ✕
        </button>
      </div>

      {done ? (
        <div className="p-6 text-center">
          <p className="eyebrow eyebrow-accent">{m["forms.submittedEyebrow"]()}</p>
          <p ref={doneRef} tabIndex={-1} className="text-lg font-bold mt-2">
            {m["forms.submittedHeading"]()}
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--ink-50)" }}>
            {m["forms.suggestEdit.submitted"]()}
          </p>
          <button type="button" onClick={onClose} className="btn-corda-primary mt-6">
            {m["common.close"]()}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <HoneypotField value={companyUrl} onChange={setCompanyUrl} />
          <div ref={turnstileRef} />
          <EditField
            label={m["forms.fields.tagline"]()}
            value={tagline}
            original={org.tagline}
            limit={LIMITS.tagline}
            rows={2}
            onChange={edit("tagline", setTagline)}
            cleared={touched.has("tagline") && tagline.trim() === ""}
            inputRef={taglineRef}
          />
          <EditField
            label={m["forms.fields.description"]()}
            value={description}
            original={org.description}
            limit={LIMITS.description}
            rows={6}
            onChange={edit("description", setDescription)}
            cleared={touched.has("description") && description.trim() === ""}
          />
          <EditField
            label={m["forms.fields.angle"]()}
            value={angle}
            original={org.aiDemocracyAngle}
            limit={LIMITS.aiDemocracyAngle}
            rows={4}
            onChange={edit("aiDemocracyAngle", setAngle)}
            cleared={touched.has("aiDemocracyAngle") && angle.trim() === ""}
          />

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={websiteId} className="eyebrow">
                {m["forms.fields.websiteUrl"]()}
                {websiteChanged && (
                  <span style={{ color: "var(--accent-warm)" }}>{m["forms.suggestEdit.editedBadge"]()}</span>
                )}
              </label>
              <span
                className="eyebrow"
                style={{ color: website.length >= WEBSITE_LIMIT ? "var(--accent-warm)" : "var(--ink-50)" }}
              >
                {website.length} / {WEBSITE_LIMIT}
              </span>
            </div>
            <input
              id={websiteId}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={WEBSITE_LIMIT}
              className="corda-input w-full mt-1.5"
              placeholder={m["forms.urlPlaceholder"]()}
              inputMode="url"
            />
            {website.trim() === "" && (
              <p className="text-xs mt-1.5" style={{ color: "var(--accent-warm)" }}>
                {m["forms.suggestEdit.clearedHint"]()}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={logoId} className="eyebrow">
              {m["forms.fields.logo"]()}
            </label>
            <p className="text-xs mt-1 mb-2" style={{ color: "var(--ink-50)" }}>
              {m["forms.suggestEdit.logoHint"]()}
            </p>
            <LogoPicker
              inputId={logoId}
              file={logoFile}
              onFile={setLogoFile}
              fallbackSrc={logoSrc(org)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={nameId} className="eyebrow">
                {m["forms.fields.yourName"]()}
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder={m["common.optional"]()}
                className="corda-input w-full mt-1.5"
              />
            </div>
            <div>
              <label htmlFor={emailId} className="eyebrow">
                {m["forms.fields.email"]()}
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder={m["common.optional"]()}
                className="corda-input w-full mt-1.5"
              />
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--ink-50)" }}>
            {m["forms.identityHint"]()}
          </p>

          {(error ?? tokenError) && (
            <p
              role="alert"
              className="text-sm px-3 py-2"
              style={{
                color: "var(--accent-warm)",
                border: "1px dashed var(--accent-warm)",
              }}
            >
              {error ?? tokenError}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting || changeCount === 0}
              className="btn-corda-primary"
              style={submitting || changeCount === 0 ? { opacity: 0.5 } : undefined}
            >
              {submitting ? m["forms.submitting"]() : m["forms.submit"]()}
            </button>
            <button type="button" onClick={requestClose} className="btn-corda">
              {m["common.cancel"]()}
            </button>
            <span className="eyebrow ml-auto" style={{ color: "var(--ink-50)" }}>
              {m["forms.changeCount"]({ count: changeCount })}
            </span>
          </div>
        </form>
      )}
    </dialog>
  );
}

function EditField({
  label,
  value,
  original,
  limit,
  rows,
  onChange,
  cleared,
  inputRef,
}: {
  label: string;
  value: string;
  original: string;
  limit: number;
  rows: number;
  onChange: (v: string) => void;
  cleared: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  const changed = value.trim() !== "" && value.trim() !== original.trim();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="eyebrow">
          {label}
          {changed && <span style={{ color: "var(--accent-warm)" }}>{m["forms.suggestEdit.editedBadge"]()}</span>}
        </label>
        <span
          className="eyebrow"
          style={{ color: value.length >= limit ? "var(--accent-warm)" : "var(--ink-50)" }}
        >
          {value.length} / {limit}
        </span>
      </div>
      <textarea
        id={id}
        ref={inputRef}
        className="corda-textarea mt-1.5"
        rows={rows}
        maxLength={limit}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {cleared && (
        <p className="text-xs mt-1.5" style={{ color: "var(--accent-warm)" }}>
          {m["forms.suggestEdit.clearedHint"]()}
        </p>
      )}
    </div>
  );
}

/** Include a field only when it is non-empty and actually differs from the
 * current org value (trimmed). The API rejects empty strings in `changes`, so
 * a blanked field is dropped and flagged in the UI instead. */
function collectChanges(
  org: Organization,
  values: Record<EditableField, string>
): Partial<Record<EditableField, string>> {
  const out: Partial<Record<EditableField, string>> = {};
  (Object.keys(values) as EditableField[]).forEach((field) => {
    const next = values[field].trim();
    if (next !== "" && next !== org[field].trim()) out[field] = next;
  });
  return out;
}
