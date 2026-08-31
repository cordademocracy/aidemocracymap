import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useOrgs } from "../lib/useOrgs";
import { m } from "../paraglide/messages.js";
import { CardsIcon, InfoIcon, MapIcon, SearchIcon } from "./icons";

export function Header() {
  const navigate = useNavigate();
  const { orgs } = useOrgs();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // closing on bare blur would race the submit; close on Escape/outside pointer
  const searchRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-40 px-4 py-2 flex items-center gap-3 bg-ocean-900/85 backdrop-blur dashed-b">
      <Link to="/" className="flex items-center pr-3 min-w-0">
        <span className="font-bold tracking-tight text-base leading-none truncate">
          {m["common.brand.before"]()}
          <span style={{ color: "var(--accent-warm)" }}>{m["common.brand.accent"]()}</span>
          {m["common.brand.after"]()}
        </span>
      </Link>

      {/* the open search field needs the whole row on phones */}
      <nav
        className={`${searchOpen ? "hidden" : "flex"} md:flex items-center gap-1.5 shrink-0 md:flex-1 md:justify-center`}
      >
        <NavChip to="/" icon={<MapIcon size={13} />} label={m["common.nav.fieldMap"]()} count={orgs?.length} />
        <NavChip to="/cards" icon={<CardsIcon size={13} />} label={m["common.nav.cards"]()} />
        <NavChip to="/about" icon={<InfoIcon size={13} />} label={m["common.nav.about"]()} />
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {searchOpen ? (
          <form
            ref={searchRef}
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/cards?q=${encodeURIComponent(q)}`);
              setSearchOpen(false);
            }}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              aria-label="Search organizations"
              placeholder={m["common.nav.searchPlaceholder"]()}
              className="corda-input w-36 sm:w-56 max-w-[45vw]"
            />
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="corda-icon-btn"
          >
            <SearchIcon size={15} />
          </button>
        )}
      </div>
    </header>
  );
}

function NavChip({ to, icon, label, count }: { to: string; icon: ReactNode; label: string; count?: number }) {
  return (
    /* below md the chips go icon-only so every route stays reachable on phones */
    <NavLink to={to} aria-label={label} className="corda-chip nav-chip">
      <span className="shrink-0" style={{ color: "var(--ink-50)" }}>{icon}</span>
      <span className="hidden md:inline font-medium">{label}</span>
      {count !== undefined && (
        <span className="hidden md:inline tabular-nums" style={{ color: "var(--ink-50)" }}>{count}</span>
      )}
    </NavLink>
  );
}
