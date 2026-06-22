import { NextRequest, NextResponse } from "next/server";
import type {
  ChatRequest,
  ChatResponse,
  FactorScore,
  Listing,
  ParsedQuery,
  Recommendation,
  UserProfile,
} from "@/lib/types";
import { searchListings, getSuburbStats } from "@/lib/domain";
import { getPlanningSnapshot } from "@/lib/planning";
import { parseQueryLLM, polishChat } from "@/lib/llm";
import { mockEnrichment } from "@/lib/mock";
import { grossYieldPct, cagrPct, projectCashflow } from "@/lib/cashflow";
import {
  scoreFactors,
  compositeScore,
  topFactors,
  rateStrategies,
  type Enriched,
} from "@/lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

function hasAnyKey() {
  return !!(
    process.env.DOMAIN_CLIENT_ID ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.EXA_API_KEY ||
    process.env.TAVILY_API_KEY
  );
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const noKeys = !hasAnyKey();
  const parsed = await parseQueryLLM(body.message);

  const profile: UserProfile = {
    budget: parsed.budgetMax ?? 1_200_000,
    depositPct: body.assumptions?.depositPct ?? 20,
    suburbs: parsed.suburbs,
    primaryIntent: parsed.intent,
    loanType: body.assumptions?.loanType ?? "PI",
    annualIncomeBracket: body.assumptions?.annualIncomeBracket ?? "mid",
  };

  const listings = (await searchListings(parsed)).slice(0, 3);
  const recs: Recommendation[] = [];
  for (const listing of listings) {
    const e = await enrich(listing, profile, noKeys);
    const factors = scoreFactors(e, parsed.intent);
    const composite = compositeScore(factors);
    const top = topFactors(factors, 3);
    const strategies = rateStrategies(e);
    recs.push({
      listing,
      estimatedValue: e.estimatedValue,
      valueRange: listing.price ? { low: Math.round(listing.price * 0.94), high: Math.round(listing.price * 1.07) } : null,
      weeklyRent: e.weeklyRent,
      grossYieldPct: e.grossYieldPct,
      cagrPct: e.cagrPct,
      compositeScore: composite,
      topFactors: top,
      allFactors: factors,
      strategies,
      planning: { zoneCodeRaw: null, overlays: e.overlays, sourceUrl: null },
      recommendationReason: deterministicReason(top, strategies, e, parsed.intent),
      cashflow3Yr: e.cashflow,
    });
  }

  recs.sort((a, b) => b.compositeScore - a.compositeScore);

  // Optional prose polish (numbers/scores untouched).
  let agentNarrative = deterministicNarrative(parsed, recs);
  const polished = await polishChat(
    parsed,
    recs.map((r) => ({
      address: r.listing.address,
      score: r.compositeScore,
      topFactors: r.topFactors.map((f) => `${f.label}: ${f.detail}`),
      strategies: r.strategies.map((s) => `${s.label} ${"★".repeat(s.stars)} (${s.econ})`),
    })),
  );
  if (polished) {
    agentNarrative = polished.agentNarrative;
    polished.reasons.forEach((reason, i) => {
      if (recs[i]) recs[i].recommendationReason = reason;
    });
  }

  const response: ChatResponse = {
    isMock: noKeys,
    parsed,
    agentNarrative,
    recommendations: recs,
    dataSources: noKeys
      ? ["Mock data (no API keys set)"]
      : ["Domain API (listings, suburb stats, AVM, rent)", "State planning portal", "Public web research"],
    disclaimer:
      "General information only — not financial, legal, tax or buyer's-agent advice. Scores and figures " +
      "are indicative, computed from suburb-level data and stated assumptions. Verify with licensed professionals.",
  };
  return NextResponse.json(response);
}

async function enrich(listing: Listing, profile: UserProfile, noKeys: boolean): Promise<Enriched> {
  const proxy = mockEnrichment(listing); // proxies for school/safety/amenity/council always

  let estimatedValue = listing.price;
  let weeklyRent = proxy.weeklyRent;
  let series = proxy.medianPriceSeries;
  let overlays = proxy.overlays;

  if (!noKeys) {
    const stats = await getSuburbStats(listing.state, listing.suburb, listing.postcode);
    if (stats.medianWeeklyRent) weeklyRent = stats.medianWeeklyRent;
    if (stats.medianPriceSeries?.length) series = stats.medianPriceSeries;
    const plan = await getPlanningSnapshot(
      listing.address,
      listing.state,
      listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng } : undefined,
    );
    overlays = plan.overlays;
    if (listing.price == null) estimatedValue = profile.budget;
  }

  const value = estimatedValue ?? profile.budget;
  const { years } = projectCashflow({ propertyValue: value, weeklyRent, profile });

  return {
    listing,
    estimatedValue: value,
    weeklyRent,
    grossYieldPct: grossYieldPct(weeklyRent, value),
    cagrPct: cagrPct(series),
    overlays,
    commuteDriveMin: proxy.commuteDriveMin,
    cashflow: years,
    schoolRating: proxy.schoolRating,
    safetyProxy: proxy.safetyProxy,
    amenityProxy: proxy.amenityProxy,
    councilUpsideProxy: proxy.councilUpsideProxy,
  };
}

function deterministicNarrative(parsed: ParsedQuery, recs: Recommendation[]): string {
  const intentWord = parsed.intent === "live" ? "to live in" : parsed.intent === "invest" ? "to invest in" : "to live in or invest in";
  const budget = parsed.budgetMax ? ` under ${fmt(parsed.budgetMax)}` : "";
  let note = "";
  if (parsed.minYieldPct) {
    const best = Math.max(0, ...recs.map((r) => r.grossYieldPct ?? 0));
    if (best < parsed.minYieldPct) {
      note =
        ` Note: none of these reach your ${parsed.minYieldPct}% yield target — houses in this band typically sit around ${best}% gross. ` +
        `For higher yield you'd usually look at units or higher-yielding suburbs, with the trade-off of lower land/capital-growth upside.`;
    }
  }
  return (
    `Found ${recs.length} active listing${recs.length === 1 ? "" : "s"} matching a home ${intentWord}${budget}. ` +
    `I've ranked them on a ${parsed.intent}-weighted score across the 10 factors — ` +
    `the highest-scoring options are below, each with the specific data behind the call and a strategy breakdown.${note}`
  );
}

function deterministicReason(
  top: FactorScore[],
  strategies: ReturnType<typeof rateStrategies>,
  e: Enriched,
  intent: ParsedQuery["intent"],
): string {
  const strengths = top.map((f) => f.detail).join("; ");
  const best = [...strategies].sort((a, b) => b.stars - a.stars)[0];
  const negative = (e.cashflow[0]?.netCashflowAfterTax ?? 0) < 0;
  const overlayWatch = e.overlays.heritage || e.overlays.flood || e.overlays.easement;
  const watch = overlayWatch
    ? " Watch-out: a planning overlay constrains development here."
    : negative
      ? " Watch-out: it runs negatively geared, so budget for an annual top-up."
      : "";
  return `Strongest points: ${strengths}. Best play: ${best.label} (${"★".repeat(best.stars)}) — ${best.econ}.${watch}`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 1, notation: "compact" }).format(n);
}
