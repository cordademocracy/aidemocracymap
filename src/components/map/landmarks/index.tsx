import { memo, type ReactNode } from "react";
import type { RegionId } from "../../../data/types";
import { AcropolisAssembly } from "./AcropolisAssembly";
import { BallotBox } from "./BallotBox";
import { ChatbotGargoyle } from "./ChatbotGargoyle";
import { EndowmentOak } from "./EndowmentOak";
import { LeveeGauge } from "./LeveeGauge";
import { Lighthouse } from "./Lighthouse";
import { Observatory } from "./Observatory";
import { RatchetCableCar } from "./RatchetCableCar";
import { ResearchPolicyWire } from "./ResearchPolicyWire";
import { Stoa } from "./Stoa";
import { TwoSidedBridge } from "./TwoSidedBridge";
import { WeightsOracle } from "./WeightsOracle";

/** Terrain art: never a pointer target, never announced. */
const decor = (art: ReactNode) => (
  <g pointerEvents="none" aria-hidden="true">
    {art}
  </g>
);

/**
 * One landmark per district, keyed by region id — four districts share the
 * "waves" motif, so the motif cannot key this. Values are the ground contact
 * point on the 1600x1000 canvas.
 *
 * The invariant that holds for every *built* silhouette below: ≥6 units of
 * clearance from every pinned node in layout.json, every title pill and the
 * volcano cone. Every figure here shares one basis — ink rasterised at 4x with
 * alpha>8, ground shadows excluded from the core rows, each moving part swept
 * over its whole range rather than its drawn pose: the lighthouse beam's ±14°
 * CSS sweep, the gondola along the full cable, the Stoa's clauses over their
 * ±9° sway, and the cone over its .v-shake offsets. Coarser rasters read ~0.5
 * tighter, so re-measure at the same 4x or the numbers will not reproduce.
 * The Stoa's sway is free — even at ±9° the paper stays inside the colonnade's
 * own silhouette, so its binding ink is stone. Tightest anywhere: the Acropolis
 * at 6.2 to ai-democracy-projects and the lighthouse at 6.4 to
 * demos-casm-demos-digital; the gondola holds 8.3 to a node and 8.9 to the
 * resting cone, 7.6 with the cone shaking.
 *
 * Three scales are held down by that invariant rather than chosen. Two are hard
 * caps: the Acropolis at 0.88 (0.90 gives 5.5 to ai-democracy-projects) and the
 * lighthouse at 1.0 (1.02 gives 5.2 to demos-casm-demos-digital). The Stoa's
 * 0.92 is a margin: 0.94 lands on exactly 6.0 to partnership-on-ai-pai, inside
 * this measurement's own rounding, so the invariant permits it and nothing is
 * left to absorb a later node move. Growing their districts does not buy room:
 * every org is pinned in layout.json, so rx/ry moves only the title pill, and
 * all three bind against nodes.
 *
 * Each landmark's ink sits on its own district's visible fill, with four
 * measured overhangs (RegionShape paints in REGIONS order, so a later district
 * covers an earlier one): the oak 58% forest / 42% plain island green, the
 * observatory 97/3 onto island green, the bridge 96/4 into Backsliding Bay,
 * the levee 96/4 onto Power Peaks — and that 4% is the gauge post and its water,
 * the part that carries the meaning.
 *
 * Two things are outside the invariant on purpose, both safe because
 * RegionDecor paints before the title pills, the hit targets, the nodes and the
 * Volcano, so nothing here can occlude any of them:
 *  - the translucent SHADOW ellipses on the ground run closer than 6: the
 *    Stoa's stops 0.8 short of the Governance Grove pill, the oak's reaches 5.0
 *    from knight-foundation, the Acropolis's 5.1 from ai-democracy-projects,
 *    the levee's 4.5 from bertelsmann-stiftung-upgrade-democracy, and the
 *    lighthouse's laps onto Cooperation Cove's fill. The volcano's own ground
 *    shadow reaches 2.4 from the gondola. Each disappears under whatever paints
 *    over it.
 *  - ResearchPolicyWire spans two districts by construction: the 1.1 hairline
 *    passes ~2 units off simon-institute and MIRI, the one gap in that node
 *    field it fits through, and the r=2 pulses riding it close that to 0.6. It
 *    does clear every title pill. Both ends are its neighbours' own geometry —
 *    the Stoa's roof slab and the Observatory's dome apex — so rescaling either
 *    one detaches the span unless WIRE is re-derived with it.
 *
 * Moving or rescaling one needs all of that re-measured, not just the eye.
 */
const LANDMARKS: Partial<Record<RegionId, ReactNode>> = {
  "research-range": decor(
    <>
      <ResearchPolicyWire />
      <Observatory x={1168.5} y={437} s={1.058} />
    </>
  ),
  // east of the crater, clear of the cone's .v-shake range
  "power-peaks": decor(<RatchetCableCar x={1270.5} y={638} s={1.058} />),
  "governance-grove": decor(
    <>
      <Stoa x={820} y={323.5} s={0.92} />
      {/* the tallest pole sits under the CAIDP node; this is the only banner
          whose finial stands clear of a circle — its foot still passes under
          simon-institute, which is behind it in paint order */}
      <ChatbotGargoyle x={956} y={280.4} />
    </>
  ),
  "funding-forest": decor(<EndowmentOak x={668} y={314} s={1.127} />),
  "deliberation-delta": decor(
    <>
      <AcropolisAssembly x={680.75} y={524.5} s={0.88} />
      {/* stands on the bema: offset (-5.13, -8.2) from the Acropolis anchor times
          the Acropolis's s. Its own scale stays 1 — .oracle-matrix's zoom gate
          is tuned to the cell size that produces */}
      <WeightsOracle x={676.23} y={517.28} />
    </>
  ),
  "integrity-inlet": decor(<Lighthouse x={902.5} y={664.5} s={1.0} />),
  // the one landmark that answers the pointer: hovering drops the ballot
  "voting-village": (
    <g className="egg-ballot" role="img" aria-label="A ballot box, its ballot half-swallowed by the slot">
      <BallotBox x={427} y={775.5} s={1.196} />
    </g>
  ),
  "cooperation-cove": decor(<TwoSidedBridge x={940} y={836} s={1.127} />),
  "backsliding-bay": decor(<LeveeGauge x={1195.75} y={720.5} s={0.989} />),
};

export const RegionLandmark = memo(function RegionLandmark({ id }: { id: RegionId }) {
  return LANDMARKS[id] ?? null;
});
