import { useEffect, useRef, useState } from "react";
import { REGIONS } from "../../data/regions";
import { m } from "../../paraglide/messages.js";
import { ChevronDownIcon, InfoIcon } from "../icons";

/** Map key: an "i" toolbar button; the district panel expands to its left. */
export function MapLegend() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btnRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="map-legend">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="map-legend-panel"
        aria-label={m["map.legend.chip"]()}
        className={`corda-icon-btn w-10 h-10 bg-ink-900/80 backdrop-blur ${open ? "is-active" : ""}`}
      >
        <InfoIcon size={16} />
      </button>

      {open && (
        <div id="map-legend-panel" className="map-legend-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{m["map.legend.chip"]()}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                btnRef.current?.focus();
              }}
              aria-label={m["map.legend.dismiss"]()}
              className="corda-icon-btn corda-icon-btn-sm"
            >
              <ChevronDownIcon size={14} />
            </button>
          </div>

          <ul className="mt-2 space-y-1">
            {REGIONS.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ background: r.fill, outline: `1.5px solid ${r.stroke}` }}
                />
                <span className="text-xs leading-tight" style={{ color: "var(--ink-70)" }}>
                  {r.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
