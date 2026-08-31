/** Invisible Cloudflare Turnstile for the public forms. Active only when
 * VITE_TURNSTILE_SITE_KEY is set; otherwise getToken resolves to "" and the
 * Worker skips verification. Tokens are single-use — call getToken per submit. */
import { useCallback, useRef } from "react";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    params: {
      sitekey: string;
      action?: string;
      execution?: "render" | "execute";
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const EXECUTE_TIMEOUT_MS = 20_000;

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileState {
  /** Attach to an empty div inside the form (hosts the invisible widget). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Run the challenge and resolve the token; "" on timeout/error/no site key
   * (the Worker then treats the post by its bot semantics). */
  getToken: () => Promise<string>;
}

export function useTurnstile(action: string): TurnstileState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const settle = useRef<((token: string) => void) | null>(null);

  const getToken = useCallback(async (): Promise<string> => {
    const el = containerRef.current;
    if (!SITE_KEY || !el) return "";
    try {
      await loadScript();
    } catch {
      return "";
    }
    const ts = window.turnstile;
    if (!ts) return "";
    return new Promise<string>((resolve) => {
      let done = false;
      const finish = (token: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        settle.current = null;
        resolve(token);
      };
      const timer = setTimeout(() => finish(""), EXECUTE_TIMEOUT_MS);
      settle.current = finish;
      if (widgetId.current == null) {
        widgetId.current = ts.render(el, {
          sitekey: SITE_KEY,
          action,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token) => settle.current?.(token),
          "error-callback": () => settle.current?.(""),
          "expired-callback": () => settle.current?.(""),
        });
      } else {
        ts.reset(widgetId.current);
      }
      ts.execute(widgetId.current);
    });
  }, [action]);

  return { containerRef, getToken };
}
