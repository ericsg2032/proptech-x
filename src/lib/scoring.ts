import type {
  CashflowYear,
  FactorKey,
  FactorScore,
  Listing,
  PlanningSnapshot,
  PrimaryIntent,
  StrategyRating,
} from "./types";

// ─────────────────────────────────────────────────────────────
// The 10-factor matrix and the 4 strategy ratings are computed HERE,
// deterministically, from the data. The LLM never sets a score or a star.
// Factors that lack a free real source use a clearly-flagged proxy.
// ─────────────────────────────────────────────────────────────

// Indicative development constants (transparent, not precise).
const DA_COST = 40_000; // permit + plans + reports
const BUILD_COST_PER_SQM = 3_200;
const SECOND_DWELLING_SQM = 90;

export interface Enriched {
  listing: Listing;
  estimatedValue: number | null;
  weeklyRent: number | null;
  grossYieldPct: number | null;
  cagrPct: number | null;
  overlays: PlanningSnapshot["overlays"];
  commuteDriveMin: number | null;
  cashflow: CashflowYear[];
  // proxies (flagged mock)
  schoolRating: number; // 1–10
  safetyProxy: number; // 0–100
  amenityProxy: number; // 0–100
  councilUpsideProxy: number; // 0–100
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function hostileOverlay(o: PlanningSnapshot["overlays"]): boolean {
  return o.heritage || o.flood || o.easement;
}

export function scoreFactors(e: Enriched, intent: PrimaryIntent): FactorScore[] {
  const o = e.overlays;
  const land = e.listing.landSqm ?? 0;
  const frontage = e.listing.frontageM ?? 0;

  // planning score: start high, penalise constraints (higher = freer)
  let planningScore = 100;
  if (o.heritage) planningScore -= 30;
  if (o.flood) planningScore -= 30;
  if (o.easement) planningScore -= 15;
  if (o.bushfire) planningScore -= 10;
  if (o.vegetation) planningScore -= 10;

  // land/development potential
  const duplexCapable = land >= 550 && frontage >= 15 && !hostileOverlay(o);
  const landScore = hostileOverlay(o)
    ? clamp(20 + land / 60)
    : clamp((land / 800) * 60 + (frontage / 25) * 40);

  // tax benefit from year-1 negative gearing relative to price
  const ng = e.cashflow[0]?.negativeGearingBenefit ?? 0;
  const price = e.estimatedValue ?? e.listing.price ?? 0;
  const taxScore = price ? clamp((ng / (price * 0.02)) * 100) : 0;

  const factors: FactorScore[] = [
    {
      key: "school",
      label: "School catchment",
      score: clamp(e.schoolRating * 10),
      weight: 0,
      detail: `Catchment rated ${e.schoolRating}/10`,
      lens: "live",
      isMock: true,
    },
    {
      key: "commute",
      label: "Commute",
      score: e.commuteDriveMin != null ? clamp(100 - e.commuteDriveMin * 1.6) : 50,
      weight: 0,
      detail: e.commuteDriveMin != null ? `~${e.commuteDriveMin} min drive to CBD` : "commute n/a",
      lens: "live",
    },
    {
      key: "safety",
      label: "Street profile (ABS)",
      score: clamp(e.safetyProxy),
      weight: 0,
      detail: "Owner-occupier ratio & safety proxy",
      lens: "live",
      isMock: true,
    },
    {
      key: "amenity",
      label: "Lifestyle amenity",
      score: clamp(e.amenityProxy),
      weight: 0,
      detail: "Parks, shops & transport nearby",
      lens: "live",
      isMock: true,
    },
    {
      key: "planning",
      label: "Planning constraints",
      score: clamp(planningScore),
      weight: 0,
      detail: hostileOverlay(o)
        ? `Overlay flags: ${overlayList(o)}`
        : "No hostile overlays detected",
      lens: "live",
    },
    {
      key: "yield",
      label: "Gross yield",
      score: e.grossYieldPct != null ? clamp((e.grossYieldPct / 7) * 100) : 0,
      weight: 0,
      detail: e.grossYieldPct != null ? `${e.grossYieldPct}% gross` : "yield n/a",
      lens: "invest",
    },
    {
      key: "cagr",
      label: "Capital growth",
      score: e.cagrPct != null ? clamp((e.cagrPct / 8) * 100) : 0,
      weight: 0,
      detail: e.cagrPct != null ? `${e.cagrPct}% suburb CAGR` : "growth n/a",
      lens: "invest",
    },
    {
      key: "landPotential",
      label: "Land & frontage",
      score: landScore,
      weight: 0,
      detail: duplexCapable
        ? `${land}m² / ${frontage}m frontage — duplex-capable`
        : hostileOverlay(o)
          ? `${land}m² but overlay limits development`
          : `${land}m² / ${frontage}m frontage`,
      lens: "invest",
    },
    {
      key: "taxBenefit",
      label: "Tax / depreciation",
      score: taxScore,
      weight: 0,
      detail: `~${fmt(ng)}/yr negative-gearing benefit (yr1)`,
      lens: "invest",
    },
    {
      key: "councilUpside",
      label: "Council upside",
      score: clamp(e.councilUpsideProxy),
      weight: 0,
      detail: "Local rezoning / infrastructure signal",
      lens: "invest",
      isMock: true,
    },
  ];

  // intent weighting
  const wLive = intent === "live" ? 1 : intent === "invest" ? 0.3 : 0.65;
  const wInvest = intent === "invest" ? 1 : intent === "live" ? 0.3 : 0.65;
  for (const f of factors) f.weight = f.lens === "live" ? wLive : wInvest;

  // data provenance per factor
  const SOURCES: Record<FactorKey, string> = {
    school: "School data (proxy)",
    commute: "Google Maps",
    safety: "ABS profile (proxy)",
    amenity: "Local amenity (proxy)",
    planning: "VicPlan / NSW GIS",
    yield: "Domain",
    cagr: "Domain",
    landPotential: "Domain + planning GIS",
    taxBenefit: "Computed · ATO rates",
    councilUpside: "Council signal (proxy)",
  };
  for (const f of factors) f.source = SOURCES[f.key];

  return factors;
}

export function compositeScore(factors: FactorScore[]): number {
  const wsum = factors.reduce((a, f) => a + f.weight, 0);
  const sum = factors.reduce((a, f) => a + f.score * f.weight, 0);
  return wsum ? Math.round(sum / wsum) : 0;
}

export function topFactors(factors: FactorScore[], n = 3): FactorScore[] {
  return [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, n);
}

// ── Strategy star ratings (deterministic, indicative) ──
export function rateStrategies(e: Enriched): StrategyRating[] {
  const land = e.listing.landSqm ?? 0;
  const frontage = e.listing.frontageM ?? 0;
  const value = e.estimatedValue ?? e.listing.price ?? 0;
  const o = e.overlays;
  const blocked = hostileOverlay(o);
  const duplexCapable = land >= 550 && frontage >= 15 && !blocked;
  const subdivCapable = land >= 600 && frontage >= 15 && !blocked;

  const year1 = e.cashflow[0]?.netCashflowAfterTax ?? 0;
  const holdBurdenPct = value ? (year1 / value) * 100 : 0; // negative = top-up

  // Hold
  let holdStars = 3;
  if (holdBurdenPct >= 0) holdStars = 5;
  else if (holdBurdenPct > -1) holdStars = 4;
  else if (holdBurdenPct > -2) holdStars = 3;
  else if (holdBurdenPct > -3) holdStars = 2;
  else holdStars = 1;

  // Sell (resale margin proxy from growth)
  const sellStars = e.cagrPct == null ? 3 : e.cagrPct >= 6 ? 4 : e.cagrPct >= 4 ? 3 : 2;

  // DA path
  const daUplift = subdivCapable ? value * 0.16 : duplexCapable ? value * 0.12 : 0;
  const daMargin = daUplift - DA_COST;
  let daStars = 1;
  if (blocked) daStars = 1;
  else if (daMargin > value * 0.1) daStars = 5;
  else if (daMargin > value * 0.05) daStars = 4;
  else if (daMargin > 0) daStars = 3;
  else daStars = 2;

  // Self-build
  const buildCost = SECOND_DWELLING_SQM * BUILD_COST_PER_SQM;
  const buildEndValue = duplexCapable ? value * 0.55 : 0; // value of an added dwelling, rough
  const buildMargin = buildEndValue - buildCost;
  let buildStars = 2;
  if (!duplexCapable) buildStars = blocked ? 1 : 2;
  else if (buildMargin > buildCost * 0.5) buildStars = 4;
  else if (buildMargin > 0) buildStars = 3;
  else buildStars = 1;

  return [
    {
      strategy: "da",
      label: "Get DA approval, then sell",
      stars: daStars,
      econ: blocked
        ? "Overlay blocks development"
        : `DA ~${fmt(DA_COST)} → est. uplift ~${fmt(daUplift)}`,
      reason: blocked
        ? "A hostile overlay means council will likely refuse a permit — don't price in uplift."
        : subdivCapable || duplexCapable
          ? "Wide frontage and land make a permit the highest-leverage, lowest-capital play."
          : "Lot is too small or narrow for a permit to add much value.",
    },
    {
      strategy: "build",
      label: "Self-build / develop",
      stars: buildStars,
      econ: duplexCapable
        ? `Build ~${fmt(buildCost)} vs added value ~${fmt(buildEndValue)}`
        : "Not feasible on this lot",
      reason: duplexCapable
        ? buildMargin > 0
          ? "Feasible, but margins are thin once build costs and time are included."
          : "Build cost likely exceeds the value added — you could lose money."
        : "Lot can't support a viable second build right now.",
    },
    {
      strategy: "hold",
      label: "Long-term rental hold",
      stars: holdStars,
      econ: `Yr1 net ~${fmt(year1)} (${holdBurdenPct.toFixed(1)}% of value)`,
      reason:
        holdBurdenPct >= 0
          ? "Holds itself or close to it — low ongoing burden."
          : "Runs negatively geared; budget for a meaningful annual top-up.",
    },
    {
      strategy: "sell",
      label: "Buy & resell (no works)",
      stars: sellStars,
      econ: e.cagrPct != null ? `Suburb CAGR ~${e.cagrPct}%` : "growth n/a",
      reason:
        e.cagrPct != null && e.cagrPct >= 5
          ? "Solid suburb growth supports a straight buy-and-hold-then-sell."
          : "Flat growth makes a no-works flip the weakest option.",
    },
  ];
}

function overlayList(o: PlanningSnapshot["overlays"]): string {
  const items: string[] = [];
  if (o.heritage) items.push("heritage");
  if (o.flood) items.push("flood");
  if (o.easement) items.push("easement");
  if (o.bushfire) items.push("bushfire");
  if (o.vegetation) items.push("vegetation");
  return items.join(", ") || "none";
}

function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  const s = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(abs);
  return n < 0 ? `-${s}` : s;
}
