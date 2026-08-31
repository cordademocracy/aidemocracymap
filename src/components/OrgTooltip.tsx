import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { NodeSelection } from "./IslandMap";
import { REGION_BY_ID } from "../data/regions";
import { CATEGORY_LABELS, DEPTH_LABELS } from "../data/types";
import { m } from "../paraglide/messages.js";
import { OrgLogo } from "./OrgLogo";

interface Props {
  selection: NodeSelection;
  onClose: () => void;
}

const WIDTH = 340;

function cardPosition(screenX: number, screenY: number) {
  const left = Math.min(Math.max(12, screenX - WIDTH / 2), window.innerWidth - WIDTH - 12);
  const showBelow = screenY < 320;
  const top = showBelow ? screenY + 34 : undefined;
  const bottom = showBelow ? undefined : window.innerHeight - screenY + 24;
  return { left, top, bottom };
}

export function OrgTooltip({ selection, onClose }: Props) {
  const { org, screenX, screenY } = selection;
  const region = REGION_BY_ID[org.region];
  const [pos, setPos] = useState(() => cardPosition(screenX, screenY));
  const [gesturing, setGesturing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // keyboard-opened (node still :focus-visible): move focus into the card so
  // its actions are the next tab stops, and hand focus back on close
  useEffect(() => {
    const opener = document.activeElement;
    if (!(opener instanceof SVGElement) || !opener.matches("[data-org]:focus-visible")) return;
    cardRef.current?.focus();
    return () => {
      if (opener.isConnected) (opener as SVGElement & { focus(): void }).focus();
    };
  }, [org.slug]);

  useEffect(() => {
    setPos(cardPosition(screenX, screenY));
  }, [screenX, screenY]);

  // the map's compositor viewport mutates the scene transform directly during
  // gestures (no React commit) — re-measure the node's DOM rect whenever the
  // scene transform changes or a gesture ends, instead of subscribing to view state
  useEffect(() => {
    const node = document.querySelector(`[data-org="${org.slug}"]`);
    const container = node?.closest("svg")?.parentElement ?? null;
    const scene = container?.querySelector("svg > g") ?? null;
    if (!node || !container || !scene) return;

    const reposition = () => {
      const rect = node.getBoundingClientRect();
      setPos(cardPosition(rect.left + rect.width / 2, rect.top));
    };

    const onGestureChange = () => {
      const active = container.classList.contains("map-gesturing");
      setGesturing(active);
      if (!active) reposition();
    };

    const observer = new MutationObserver(onGestureChange);
    observer.observe(container, { attributes: true, attributeFilter: ["class"] });
    // "Reset view" commits a new transform without ever adding map-gesturing
    observer.observe(scene, { attributes: true, attributeFilter: ["transform"] });
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  }, [org.slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={org.name}
      tabIndex={-1}
      className="tooltip-card corda-card fixed z-50 p-4"
      style={{
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
        width: WIDTH,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        opacity: gesturing ? 0 : 1,
        pointerEvents: gesturing ? "none" : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        aria-label={m["common.close"]()}
        className="corda-icon-btn corda-icon-btn-sm absolute top-2.5 right-2.5 text-sm"
      >
        ✕
      </button>

      <div className="flex items-center gap-3 pr-6">
        <OrgLogo
          org={org}
          size={44}
          className="w-11 h-11 bg-white object-contain p-1 shrink-0"
          style={{ border: "1px solid var(--hairline)" }}
        />
        <div className="min-w-0">
          <h3 className="font-bold leading-tight truncate">{org.name}</h3>
          <p className="eyebrow eyebrow-meta mt-1 truncate">
            {region?.name} · {CATEGORY_LABELS[org.category]}
          </p>
        </div>
      </div>

      <p className="text-sm mt-3" style={{ color: "var(--ink-70)" }}>{org.tagline}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="corda-tag corda-tag-solid">{DEPTH_LABELS[org.depthRing]}</span>
        {org.focusTags.slice(0, 3).map((t) => (
          <span key={t} className="corda-tag">{t}</span>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <Link to={`/org/${org.slug}`} className="btn-corda-primary flex-1">
          {m["map.tooltip.details"]()}
        </Link>
        <a
          href={org.website}
          target="_blank"
          rel="noreferrer"
          className="btn-corda flex-1"
        >
          {m["map.tooltip.website"]()}
        </a>
      </div>
    </div>
  );
}
