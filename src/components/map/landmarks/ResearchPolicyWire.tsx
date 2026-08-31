import { memo } from "react";
import { useReducedMotion } from "../../MapDecor";
import { INK_LINE, SNOW } from "./palette";

/** Stoa roof slab (right edge) → Observatory dome (apex), in canvas
 * coordinates: both ends are their landmark's own geometry and are covered by
 * it, so the span reads as anchored — the Observatory draws after the wire, the
 * Stoa after all of research-range. Re-derive both ends whenever either
 * landmark moves or rescales. The pulses ride the same string, so the path must
 * stay one constant, and the near-level middle is what that costs: it is the
 * only line that keeps clear of the Governance Grove pill while threading
 * between simon-institute and MIRI, and it carries the span over the
 * MountainRange's peaks. No sagging cubic between these two anchors clears both
 * — every one of them crosses either the pill or the big mountain's face. */
const WIRE = "M 848.75 296.48 C 946 366, 1086 274, 1168.5 406.95";
/** negative begins: the three pulses are already spread along the wire on load */
const PULSES = [0, -6, -12];

export const ResearchPolicyWire = memo(function ResearchPolicyWire() {
  const reducedMotion = useReducedMotion();
  return (
    <g>
      <path d={WIRE} fill="none" stroke={INK_LINE} strokeWidth={1.1} strokeLinecap="round" opacity={0.5} />
      {/* placed only by animateMotion — without it they stack at the origin */}
      {!reducedMotion &&
        PULSES.map((t) => (
          <circle key={t} r={2} fill={SNOW} opacity={0.7}>
            <animateMotion dur="18s" begin={`${t}s`} repeatCount="indefinite" path={WIRE} />
          </circle>
        ))}
    </g>
  );
});
