import type { AUState, PlanningSnapshot } from "./types";

// ─────────────────────────────────────────────────────────────
// Planning is the one state-fragmented layer. Strategy: detect the state,
// query that state's OFFICIAL open ArcGIS service by point (lat/lng), and
// normalise zones + overlays into one canonical PlanningSnapshot.
//
// Live GIS for VIC + NSW is wired below (open gov data, no key needed —
// just coordinates). Other states fall back to the official report link +
// a deterministic mock. Set ENABLE_LIVE_PLANNING=true (or provide any API
// key) to turn the live GIS calls on; otherwise the demo stays instant.
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
  return "NSW";
}

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

export function officialSourceFor(state: AUState) {
  return OFFICIAL_SOURCES[state];
}

const LIVE =
  process.env.ENABLE_LIVE_PLANNING === "true" ||
  !!(process.env.DOMAIN_CLIENT_ID || process.env.GOOGLE_MAPS_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);

// Official open ArcGIS REST services (verified).
const VIC_ZONES = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeZones/MapServer/0";
const VIC_OVERLAYS = "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer/0";
const NSW_ZONING = "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2";
const NSW_HERITAGE = "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/0";

async function arcgisPoint(layerUrl: string, lng: number, lat: number): Promise<Record<string, any>[]> {
  const url =
    `${layerUrl}/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326` +
    `&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map((f: any) => f.attributes ?? {});
}

type Snap = Omit<PlanningSnapshot, "plainEnglish">;

async function getVicPlanning(lng: number, lat: number): Promise<Snap | null> {
  const [zoneFeats, ovFeats] = await Promise.all([arcgisPoint(VIC_ZONES, lng, lat), arcgisPoint(VIC_OVERLAYS, lng, lat)]);
  const zoneCode = pick(zoneFeats[0], ["ZONE_CODE", "zone_code", "ZONECODE"]);
  if (!zoneCode && ovFeats.length === 0) return null;
  const overlayCodes = ovFeats.map((a) => pick(a, ["ZONE_CODE", "zone_code", "OVERLAY"])).filter(Boolean) as string[];
  return {
    state: "VIC",
    council: pick(zoneFeats[0], ["LGA", "LGA_NAME", "lga_name"]) ?? null,
    schemeName: OFFICIAL_SOURCES.VIC.name,
    zoneCategory: vicZoneCategory(zoneCode),
    zoneCodeRaw: zoneCode ?? null,
    overlays: { ...vicOverlayFlags(overlayCodes), easement: false },
    sourceUrl: OFFICIAL_SOURCES.VIC.url,
  };
}

async function getNswPlanning(lng: number, lat: number): Promise<Snap | null> {
  const [zoneFeats, herFeats] = await Promise.all([arcgisPoint(NSW_ZONING, lng, lat), arcgisPoint(NSW_HERITAGE, lng, lat)]);
  const sym = pick(zoneFeats[0], ["SYM_CODE", "sym_code"]);
  if (!sym && herFeats.length === 0) return null;
  return {
    state: "NSW",
    council: pick(zoneFeats[0], ["LGA_NAME", "lga_name"]) ?? null,
    schemeName: OFFICIAL_SOURCES.NSW.name,
    zoneCategory: nswZoneCategory(sym),
    zoneCodeRaw: sym ?? null,
    // EPI_Primary_Planning_Layers covers heritage; flood/bushfire/easement
    // live in separate datasets, so they stay false until those are wired.
    overlays: { flood: false, bushfire: false, heritage: herFeats.length > 0, vegetation: false, easement: false, other: [] },
    sourceUrl: OFFICIAL_SOURCES.NSW.url,
  };
}

export async function getPlanningSnapshot(
  address: string,
  state: AUState,
  coords?: { lat: number; lng: number },
): Promise<Snap> {
  const src = OFFICIAL_SOURCES[state];

  if (LIVE && coords && (state === "VIC" || state === "NSW")) {
    try {
      const live = state === "VIC" ? await getVicPlanning(coords.lng, coords.lat) : await getNswPlanning(coords.lng, coords.lat);
      if (live) return live;
    } catch {
      // fall through to mock
    }
  }

  // Deterministic mock fallback (also used for states without a wired GIS yet).
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

// ── Code → canonical mappers ──
function vicZoneCategory(code: string | null): Snap["zoneCategory"] {
  if (!code) return "unknown";
  if (/^(GRZ|NRZ|RGZ|LDRZ|R1Z|MRZ|TZ|RGZ)/.test(code)) return "residential";
  if (/^(MUZ|ACZ)/.test(code)) return "mixed-use";
  if (/^(C1Z|C2Z|CCZ|B)/.test(code)) return "commercial";
  if (/^(FZ|RLZ|RCZ|RAZ|GWZ|RUZ)/.test(code)) return "rural";
  return "other";
}
function vicOverlayFlags(codes: string[]) {
  const has = (re: RegExp) => codes.some((c) => re.test(c));
  const known = /^(HO|LSIO|SBO|FO|UFZ|BMO|VPO|SLO|ESO|TRO|SMO)/;
  return {
    flood: has(/^(LSIO|SBO|FO|UFZ)/),
    bushfire: has(/^BMO/),
    heritage: has(/^HO/),
    vegetation: has(/^(VPO|SLO|ESO|TRO|SMO)/),
    other: Array.from(new Set(codes.filter((c) => !known.test(c)))),
  };
}
function nswZoneCategory(sym: string | null): Snap["zoneCategory"] {
  if (!sym) return "unknown";
  if (/^R[1-5]$/.test(sym) || sym === "RU5") return "residential";
  if (/^MU/.test(sym)) return "mixed-use";
  if (/^(B|E[1-4]|SP)/.test(sym)) return "commercial";
  if (/^RU/.test(sym)) return "rural";
  return "other";
}

function pick(obj: Record<string, any> | undefined, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) if (obj[k] != null && obj[k] !== "") return String(obj[k]);
  return null;
}

function mockCouncil(state: AUState): string {
  const m: Record<AUState, string> = {
    NSW: "City of Sydney", VIC: "City of Melbourne", QLD: "Brisbane City", SA: "City of Adelaide",
    WA: "City of Perth", TAS: "City of Hobart", NT: "City of Darwin", ACT: "ACT Government",
  };
  return m[state];
}
