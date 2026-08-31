/** Shared client-side form helpers for the contribution flows. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject, SyntheticEvent } from "react";
import { ApiError, fetchFormToken } from "./api";
import { m } from "../paraglide/messages.js";

export interface FormTokenState {
  token: string;
  error: string | null;
  /** Fetch a fresh token and return it ("" on failure) — callers submitting
   * need the value in the same frame, before state has re-rendered. */
  retry: () => Promise<string>;
}

/**
 * Fetch a form token on mount. Empty string until it arrives; forms should
 * refuse to submit without one (the backend silently drops tokenless posts).
 */
export function useFormToken(): FormTokenState {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const retry = useCallback(async () => {
    try {
      const { token: fresh } = await fetchFormToken();
      if (alive.current) {
        setToken(fresh);
        setError(null);
      }
      return fresh;
    } catch (err) {
      if (alive.current) setError(messageFor(err, m["errors.formToken"]()));
      return "";
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void retry();
    return () => {
      alive.current = false;
    };
  }, [retry]);

  return { token, error, retry };
}

/** Detail the backend uses for a form token past its 24h window. */
export function isExpiredTokenError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 422 && /token_expired/.test(err.message);
}

/** Human copy for a failed API call; `fallback` covers the unclassified case. */
export function messageFor(err: unknown, fallback: string = m["errors.generic"]()): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return m["errors.network"]();
    if (err.status === 429) return m["errors.rateLimited"]();
    if (err.status === 404) return m["errors.orgGone"]();
    if (err.status === 413) return m["errors.imageTooLarge"]();
    if (err.status === 415) return m["errors.unsupportedImage"]();
    if (isExpiredTokenError(err)) return m["errors.staleForm"]();
    if (err.status === 422) return err.message || fallback;
  }
  return fallback;
}

/**
 * Modal plumbing shared by the contribution panels: native `<dialog>` +
 * `showModal()` (dialog semantics, focus trap and inertness come from the
 * platform), Escape through `cancel`, backdrop close guarded by a dirty-state
 * confirm, and focus restored to the opener on unmount.
 */
export function useFormDialog({
  onClose,
  isDirty,
  initialFocusRef,
}: {
  onClose: () => void;
  isDirty: () => boolean;
  initialFocusRef: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openerRef = useRef<Element | null>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    openerRef.current = document.activeElement;
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    initialFocusRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [initialFocusRef]);

  function requestClose() {
    if (isDirty() && !window.confirm(m["forms.discardConfirm"]())) return;
    onClose();
  }

  return {
    dialogRef,
    requestClose,
    /** Spread onto the `<dialog>`: backdrop hits target the dialog itself, so
     * closing needs a press that both started and ended outside its box —
     * a press on the dialog's own scrollbar is inside the border box. */
    dialogProps: {
      ref: dialogRef,
      onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
        e.preventDefault();
        requestClose();
      },
      onMouseDown: (e: MouseEvent<HTMLDialogElement>) => {
        const box = dialogRef.current?.getBoundingClientRect();
        pressedBackdrop.current =
          e.target === dialogRef.current &&
          box != null &&
          (e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom);
      },
      onClick: (e: MouseEvent<HTMLDialogElement>) => {
        if (pressedBackdrop.current && e.target === dialogRef.current) requestClose();
      },
    },
  };
}

/** Basic check: a syntactically valid absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Max raw image size accepted by POST /api/uploads (1 MB). */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

/** Image MIME types the upload endpoint accepts. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
