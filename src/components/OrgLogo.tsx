import { useState } from "react";
import type { OrgSummary } from "../data/types";
import { logoSrc, logoSrcSet } from "../lib/orgs";

/**
 * Lazy org logo `<img>` with density srcset; on load failure it degrades to
 * the local one-letter placeholder (no remote favicon services).
 */
export function OrgLogo({
  org,
  size,
  className,
  style,
}: {
  org: Pick<OrgSummary, "slug" | "name" | "logoUrl">;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // track the failed slug, not a boolean — the component instance is reused across orgs
  const [failedSlug, setFailedSlug] = useState<string | null>(null);

  if (failedSlug === org.slug) {
    return (
      <div
        className={`${className ?? ""} grid place-items-center select-none`}
        style={{ ...style, width: size, height: size }}
        aria-hidden="true"
      >
        <span style={{ fontSize: size * 0.4, fontWeight: 800, color: "#101a30" }}>
          {org.name.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoSrc(org)}
      srcSet={logoSrcSet(org)}
      alt=""
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      className={className}
      style={style}
      onError={() => setFailedSlug(org.slug)}
    />
  );
}
