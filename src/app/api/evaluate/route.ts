import { NextRequest, NextResponse } from "next/server";
import type {
  EvaluateRequest,
  EvaluationReport,
  PlanningSnapshot,
} from "@/lib/types";
import { geocode, commute } from "@/lib/geo";
import { getProperty, getSuburbStats } from "@/lib/domain";
import { detectState, getPlanningSnapshot } from "@/lib/planning";
import { publicResearch } from "@/lib/research";
import { synthesize } from "@/lib/llm";
import { mockQualitative } from "@/lib/mock";
import {
  grossYieldPct,
  cagrPct,
  projectCashflow,
  secondDwellingHeuristic,
} from "@/lib/cashflow";

export const runtime = "nodejs";
export const maxDuration = 60;

function suburbFrom(address: string): { suburb: string; postcode: string } {
  const pc = address.match(/\b(\d{4})\b/)?.[1] ?? "3000";
  // crude: token before state/postcode
  const m = address.match(/,\s*([A-Za-z\s]+?)\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)?\s*\d{4}/i);
  const suburb = (m?.[1] ?? "Melbourne").trim();
  return { suburb, postcode: pc };
}

export async function POST(req: NextRequest) {
  let body: EvaluateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { address, profile } = body;
  if (!address || !profile) {
    return NextResponse.json({ error: "address and profile are required" }, { status: 400 });
  }

  // "Mock" means no live PROPERTY data. An LLM key only adds prose, not data.
  const noKeys = !(process.env.DOMAIN_CLIENT_ID && process.env.DOMAIN_CLIENT_SECRET);

  const state = detectState(address);
  const { suburb, postcode } = suburbFrom(address);

  // 1) Location
  const geo = await geocode(address);
  const lat = geo?.lat;
  const lng = geo?.lng;

  // 2) Structured property + market data (Domain official API)
  const [property, suburbStats] = await Promise.all([
    getProperty(address),
    getSuburbStats(state, suburb, postcode),
  ]);

  // 3) Planning (state-aware, normalised) — live GIS when coords + keys present
  const planningBase = await getPlanningSnapshot(
    address,
    state,
    lat != null && lng != null ? { lat, lng } : undefined,
  );

  // 4) Public long-tail research (NOT listing scraping)
  const research = await publicResearch(suburb, [
    "school catchment",
    "crime safety",
    "transport amenity",
    "council planning news",
  ]);

  // 5) Commute (CBD as a stand-in target; swap for nearest station POI)
  const cbd = CBD_COORDS[state];
  const cbdCommute =
    lat != null && lng != null ? await commute(lat, lng, cbd.lat, cbd.lng) : null;

  // 6) FINANCIALS — deterministic, in code
  const value = property.estimatedValue ?? profile.budget;
  const weeklyRent = suburbStats.medianWeeklyRent ?? 0;
  const yieldPct = grossYieldPct(weeklyRent, value);
  const growth = cagrPct(suburbStats.medianPriceSeries);
  const { years, assumptions } = projectCashflow({
    propertyValue: value,
    weeklyRent,
    profile,
  });

  // Second-dwelling potential is overlay-aware: a hostile overlay hard-blocks it.
  const secondDwelling = secondDwellingHeuristic(property.landSqm, planningBase.overlays);

  // 7) QUALITATIVE — LLM (prose only), with mock fallback
  const factsForLLM = {
    address: geo?.formattedAddress ?? address,
    state,
    property,
    suburbStats: { medianWeeklyRent: weeklyRent, medianPriceSeries: suburbStats.medianPriceSeries },
    yieldPct,
    growthCagrPct: growth,
    planning: planningBase,
    cashflow: years,
  };
  const qual = (await synthesize(factsForLLM, research)) ?? mockQualitative(suburb);

  const planning: PlanningSnapshot = { ...planningBase, plainEnglish: qual.planningPlainEnglish };

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    isMock: noKeys,
    dataSources: buildSources(noKeys, state),
    propertyInfo: {
      address: geo?.formattedAddress ?? address,
      state,
      lat,
      lng,
      estimatedValue: property.estimatedValue,
      valueRange: property.valueRange,
      beds: property.beds,
      baths: property.baths,
      cars: property.cars,
      landSqm: property.landSqm,
      propertyType: property.propertyType,
    },
    planning,
    ownerOccupier: {
      schoolZoneRating: 8,
      nearestTrainStation: { name: "Local station", distanceKm: 1.2, driveMin: 4 },
      cbdCommute: cbdCommute,
      walkScoreEstimate: 78,
      crimeRateSummary: qual.crimeRateSummary,
      prosCons: qual.ownerOccupierProsCons,
      narrative: qual.ownerOccupierNarrative,
    },
    investor: {
      currentMedianRent: weeklyRent || null,
      grossYieldPct: yieldPct,
      capitalGrowth10Yr: suburbStats.medianPriceSeries,
      capitalGrowthCagrPct: growth,
      secondDwellingPotential: {
        landSupportsIt: secondDwelling.supported,
        summary: secondDwelling.blockers.length
          ? `Blocked by planning, not land size: ${secondDwelling.blockers.join("; ")}. ` +
            `Council will generally refuse a second dwelling here even though the lot is large enough — ` +
            `treat as high planning risk and confirm with the council before relying on any value-add.`
          : qual.secondDwellingSummary,
      },
      cashflow3Yr: years,
      assumptions,
      narrative: qual.investorNarrative,
    },
    disclaimer:
      "General information only — not financial, legal or tax advice. Figures are indicative, " +
      "computed from suburb-level data and stated assumptions (rate " +
      `${assumptions.interestRatePct}%, ${assumptions.loanType === "PI" ? `P&I over ${assumptions.loanTermYears}yr` : "interest-only"}, ` +
      `LVR ${assumptions.lvrPct}%, opex ${assumptions.opexPctOfRent}% of rent, marginal tax ` +
      `${assumptions.marginalTaxRatePct}% excl. Medicare levy). ` +
      "Verify with licensed professionals before acting.",
  };

  return NextResponse.json(report);
}

const CBD_COORDS: Record<string, { lat: number; lng: number }> = {
  NSW: { lat: -33.8688, lng: 151.2093 },
  VIC: { lat: -37.8136, lng: 144.9631 },
  QLD: { lat: -27.4698, lng: 153.0251 },
  SA: { lat: -34.9285, lng: 138.6007 },
  WA: { lat: -31.9523, lng: 115.8613 },
  TAS: { lat: -42.8821, lng: 147.3272 },
  NT: { lat: -12.4634, lng: 130.8456 },
  ACT: { lat: -35.2809, lng: 149.13 },
};

function buildSources(noKeys: boolean, state: string): string[] {
  if (noKeys) return ["Mock data (no API keys set)"];
  return [
    "Domain API (property, comparables, suburb performance, AVM, rent)",
    `${state} planning portal (zoning & overlays)`,
    "Google Maps (geocode & commute)",
    "Public web research (council, schools, suburb)",
  ];
}
