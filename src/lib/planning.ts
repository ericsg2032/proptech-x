import type { AUState, PlanningSnapshot } from "./types";

// ─────────────────────────────────────────────────────────────
// Planning is the ONE layer that is fragmented across 8 jurisdictions.
// Strategy: detect the state from the address, route to that state's
// official per-address planning source, normalise into PlanningSnapshot.
// Everything else in the app is jurisdiction-agnostic.
//
// MVP mode: we return the official report URL + a mock snapshot.
// To go live: fetch + parse the official report (or wire the state's
// ArcGIS REST service) inside each provider and fill the real fields.
// ─────────────────────────────────────────────────────────────

const POSTCODE_RANGES: { state: AUState; ranges: [number, number][] }[] = [
  { state: "NSW", ranges: [[1000, 2599], [2619, 2899], [2921, 2999]] },
  { state: "ACT", ranges: [[200, 299], [2600, 2618], [2900, 2920]] },
  { state: "VIC", ranges: [[3000, 3999], [8000, 8999]] },
  { state: "QLD", ranges: [[4000, 4999], [9000, 9999]] },
  { state: "SA", ranges: [[5000, 5799], [5800, 5999]] },
  { state: "WA", ranges: [[6000, 6797], [6800, 6999]] },
  { state: "TAS", ranges: [[7000, 7799], [7800, 7999]] },
  { state: "NT", ranges: [[800, 899], [900, 999]] },
];

export function detectState(address: string): AUState {
  const upper = address.toUpperCase();
  const abbrev = upper.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/);
  if (abbrev) return abbrev[1] as AUState;
  const pc = address.match(/\b(\d{4})\b/);
  if (pc) {
    const n = parseInt(pc[1], 10);
    for (const { state, ranges } of POSTCODE_RANGES) {
      if (ranges.some(([lo, hi]) => n >= lo && n <= hi)) return state;
    }
  }
  return "NSW"; // safe default; user can correct
}

// Official per-address planning sources, by state.
const OFFICIAL_SOURCES: Record<AUState, { name: string; url: string }> = {
  VIC: { name: "VicPlan Planning Property Report", url: "https://mapshare.vic.gov.au/vicplan/" },
  NSW: { name: "NSW Planning Portal Spatial Viewer", url: "https://www.planningportal.nsw.gov.au/spatialviewer/" },
  QLD: { name: "QLD SPP / DA Mapping (SPP IMS / DAMS)", url: "https://planning.dsdmip.qld.gov.au/maps" },
  SA: { name: "SA Property and Planning Atlas (SAPPA)", url: "https://sappa.plan.sa.gov.au/" },
  WA: { name: "PlanWA / Landgate SLIP", url: "https://www.wa.gov.au/organisation/department-of-planning-lands-and-heritage" },
  TAS: { name: "PlanBuild Tasmania (theLIST)", url: "https://www.planbuild.tas.gov.au/" },
  NT: { name: "NT Planning Scheme online (NR Maps)", url: "https://nt.gov.au/property/building-and-development" },
  ACT: { name: "ACTmapi / ACT Territory Plan", url: "https://www.actmapi.act.gov.au/" },
};

export interface PlanningProvider {
  state: AUState;
  fetchSnapshot(address: string): Promise<Omit<PlanningSnapshot, "plainEnglish">>;
}

/**
 * Returns a normalised snapshot for any Australian address.
 * In MVP/mock mode this returns the correct official source link plus
 * placeholder controls. Replace the body with a real fetch+parse per state.
 */
export async function getPlanningSnapshot(
  address: string,
  state: AUState,
): Promise<Omit<PlanningSnapshot, "plainEnglish">> {
  const src = OFFICIAL_SOURCES[state];

  const liveMode =
    process.env.DOMAIN_CLIENT_ID || process.env.GOOGLE_MAPS_API_KEY; // proxy for "real run"
  if (!liveMode) {
    // Deterministic mock so the UI renders end-to-end.
    return {
      state,
      council: mockCouncil(state),
      schemeName: src.name,
      zoneCategory: "residential",
      zoneCodeRaw: state === "NSW" ? "R2" : state === "VIC" ? "GRZ1" : "Res",
      overlays: { flood: false, bushfire: false, heritage: false, vegetation: false, easement: true, other: [] },
      sourceUrl: src.url,
    };
  }

  // TODO (go-live): fetch the state's official report or ArcGIS REST layer,
  // e.g. VIC Vicmap Planning REST, NSW Planning Portal ArcGIS, etc., and map
  // the raw zone/overlay codes into the canonical fields below.
  return {
    state,
    council: null,
    schemeName: src.name,
    zoneCategory: "unknown",
    zoneCodeRaw: null,
    overlays: { flood: false, bushfire: false, heritage: false, vegetation: false, easement: false, other: [] },
    sourceUrl: src.url,
  };
}

export function officialSourceFor(state: AUState) {
  return OFFICIAL_SOURCES[state];
}

function mockCouncil(state: AUState): string {
  const m: Record<AUState, string> = {
    NSW: "City of Sydney", VIC: "City of Melbourne", QLD: "Brisbane City",
    SA: "City of Adelaide", WA: "City of Perth", TAS: "City of Hobart",
    NT: "City of Darwin", ACT: "ACT Government",
  };
  return m[state];
}
