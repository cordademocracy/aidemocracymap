import { Link } from "react-router";
import { m } from "../../paraglide/messages.js";

const MAINTAINER = "CORDA";
const MAINTAINER_URL = "https://cordademocracy.org";
const REPO_URL = "https://github.com/cordademocracy/aidemocracymap";

/* Corner attribution strip overlaying the map viewport. Container swallows no
   gestures (pointer-events: none); only the links are interactive. The ocean
   token doubles as a text halo so the strip stays legible over the art. */
export function MapAttribution() {
  return (
    <div
      className="absolute right-0 bottom-0 pointer-events-none select-none whitespace-nowrap"
      style={{
        padding: "0 calc(env(safe-area-inset-right, 0px) + 10px) calc(env(safe-area-inset-bottom, 0px) + 5px) 0",
        fontSize: "var(--text-xs)",
        color: "var(--ink-50)",
        textShadow: "0 0 4px var(--color-ocean-900), 0 0 8px var(--color-ocean-900)",
      }}
    >
      {m["map.attribution.madeBy"]()}{" "}
      <a
        href={MAINTAINER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto underline underline-offset-2 hover:text-[var(--ink)]"
      >
        {MAINTAINER}
      </a>
      {" · "}
      <Link
        to="/about"
        className="pointer-events-auto underline underline-offset-2 hover:text-[var(--ink)]"
      >
        {m["map.attribution.about"]()}
      </Link>
      {" · "}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto underline underline-offset-2 hover:text-[var(--ink)]"
      >
        {m["map.attribution.github"]()}
      </a>
    </div>
  );
}
