import { useEffect, useId, useRef, useState } from "react";
import { submitNewOrg } from "../lib/api";
import {
  isExpiredTokenError,
  isValidHttpUrl,
  messageFor,
  useFormDialog,
  useFormToken,
} from "../lib/forms";
import { useTurnstile } from "../lib/turnstile";
import { m } from "../paraglide/messages.js";
import { HoneypotField } from "./HoneypotField";

const LIMITS = { name: 120, email: 120, url: 300, note: 500 } as const;
const MAX_URLS = 5;

/**
 * Corda-styled modal for proposing a new organization: a name, 1-5 links and a
 * short case for why it belongs. An admin enriches the full entry before it
 * goes live.
 */
export function SubmitOrgPanel({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const { token, error: tokenError, retry } = useFormToken();
  const { containerRef: turnstileRef, getToken: getTurnstileToken } = useTurnstile("submit-org");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const nameId = useId();
  const emailId = useId();
  const urlBaseId = useId();
  const noteId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  const dirty = Boolean(name || email || note || urls.some(Boolean));
  const { requestClose, dialogProps } = useFormDialog({
    onClose,
    isDirty: () => dirty && !done,
    initialFocusRef: nameRef,
  });

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  function setUrl(i: number, value: string) {
    setUrls((cur) => cur.map((u, j) => (j === i ? value : u)));
  }

  function validate(): string | null {
    if (!name.trim()) return m["forms.nameRequired"]();
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return m["forms.addOrg.invalidEmail"]();
    if (!urls[0].trim()) return m["forms.addOrg.websiteRequired"]();
    for (const url of urls) {
      if (url.trim() && !isValidHttpUrl(url)) return m["forms.addOrg.invalidLinks"]();
    }
    if (!note.trim()) return m["forms.addOrg.noteRequired"]();
    return null;
  }

  async function post(formToken: string) {
    return submitNewOrg({
      name: name.trim(),
      email: email.trim() || undefined,
      urls: urls.map((u) => u.trim()).filter(Boolean),
      note: note.trim(),
      companyUrl,
      formToken,
      turnstileToken: await getTurnstileToken(),
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
        const fresh = await retry();
        if (!fresh) throw err;
        await post(fresh);
      }
      setDone(true);
    } catch (err) {
      setError(messageFor(err, m["forms.addOrg.fallbackError"]()));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      {...dialogProps}
      aria-label={m["forms.addOrg.title"]()}
      className="w-full max-w-xl p-0 m-auto max-h-[calc(100dvh-3rem)] overflow-y-auto backdrop:bg-black/55"
      style={{ background: "var(--surface)", color: "var(--ink)", border: "1px dashed var(--dash)" }}
    >
      <div className="flex items-start justify-between gap-4 p-5 dashed-b">
        <div>
          <p className="eyebrow eyebrow-accent">{m["forms.addOrg.title"]()}</p>
          <h2 className="text-xl font-bold tracking-tight mt-1">{m["forms.addOrg.heading"]()}</h2>
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
            {m["forms.addOrg.submitted"]()}
          </p>
          <button type="button" onClick={onClose} className="btn-corda-primary mt-6">
            {m["common.close"]()}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <HoneypotField value={companyUrl} onChange={setCompanyUrl} />
          <div ref={turnstileRef} />

          <div>
            <label htmlFor={nameId} className="eyebrow">
              {m["forms.fields.orgName"]()} <span style={{ color: "var(--accent-warm)" }}>*</span>
            </label>
            <input
              id={nameId}
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.name}
              className="corda-input w-full mt-1.5"
              placeholder={m["forms.fields.orgName"]()}
            />
          </div>

          <div className="space-y-2">
            {urls.map((url, i) => (
              <div key={i}>
                <label htmlFor={`${urlBaseId}-${i}`} className="eyebrow">
                  {i === 0 ? (
                    <>
                      {m["forms.fields.website"]()} <span style={{ color: "var(--accent-warm)" }}>*</span>
                    </>
                  ) : (
                    m["forms.addOrg.extraLink"]({ n: i + 1 })
                  )}
                </label>
                <input
                  id={`${urlBaseId}-${i}`}
                  value={url}
                  onChange={(e) => setUrl(i, e.target.value)}
                  maxLength={LIMITS.url}
                  className="corda-input w-full mt-1.5"
                  placeholder={m["forms.urlPlaceholder"]()}
                  inputMode="url"
                />
              </div>
            ))}
            {urls.length < MAX_URLS && (
              <button
                type="button"
                onClick={() => setUrls((cur) => [...cur, ""])}
                className="btn-corda"
              >
                {m["forms.addOrg.addLink"]()}
              </button>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={noteId} className="eyebrow">
                {m["forms.addOrg.noteLabel"]()} <span style={{ color: "var(--accent-warm)" }}>*</span>
              </label>
              <span
                className="eyebrow"
                style={{ color: note.length >= LIMITS.note ? "var(--accent-warm)" : "var(--ink-50)" }}
              >
                {note.length} / {LIMITS.note}
              </span>
            </div>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={LIMITS.note}
              rows={3}
              className="corda-textarea mt-1.5"
              placeholder={m["forms.addOrg.notePlaceholder"]()}
            />
          </div>

          <div>
            <label htmlFor={emailId} className="eyebrow">
              {m["forms.fields.yourEmail"]()}
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={LIMITS.email}
              className="corda-input w-full mt-1.5"
              placeholder={m["forms.addOrg.emailPlaceholder"]()}
            />
            <p className="text-xs mt-1.5" style={{ color: "var(--ink-50)" }}>
              {m["forms.identityHint"]()}
            </p>
          </div>

          {(error ?? tokenError) && (
            <p
              role="alert"
              className="text-sm px-3 py-2"
              style={{ color: "var(--accent-warm)", border: "1px dashed var(--accent-warm)" }}
            >
              {error ?? tokenError}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="btn-corda-primary"
              style={submitting ? { opacity: 0.5 } : undefined}
            >
              {submitting ? m["forms.submitting"]() : m["forms.submit"]()}
            </button>
            <button type="button" onClick={requestClose} className="btn-corda">
              {m["common.cancel"]()}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
