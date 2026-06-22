// ─────────────────────────────────────────────────────────────
// Domain model for PropTech-X.
// Financial numbers live in `cashflow.ts` (deterministic).
// The LLM only ever fills the *qualitative* fields below.
// ─────────────────────────────────────────────────────────────

export type AUState = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";

export type PrimaryIntent = "live" | "invest" | "both";

export type LoanType = "PI" | "IO"; // principal & interest | interest-only

// Maps to AU resident marginal tax brackets (see cashflow.ts).
export type IncomeBracket = "low" | "mid" | "high" | "top";

export interface UserProfile {
  budget: number; // AUD
  depositPct: number; // e.g. 20 means 20%
  suburbs: string[];
  primaryIntent: PrimaryIntent;
  loanType: LoanType;
  annualIncomeBracket?: IncomeBracket; // optional; drives marginal tax rate
  loanTermYears?: number; // default 30
  propertyType?: "house" | "townhouse" | "apartment";
  bedrooms?: number;
}

export interface PropertyInfo {
  address: string;
  state: AUState;
  lat?: number;
  lng?: number;
  estimatedValue: number | null; // Domain AVM mid
  valueRange?: { low: number; high: number } | null;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  landSqm: number | null;
  propertyType?: string | null;
}

// Canonical, jurisdiction-agnostic planning snapshot.
// Each state's official report is normalised into this shape.
export interface PlanningSnapshot {
  state: AUState;
  council: string | null;
  schemeName: string | null;
  zoneCategory:
    | "residential"
    | "mixed-use"
    | "commercial"
    | "rural"
    | "other"
    | "unknown";
  zoneCodeRaw: string | null; // e.g. "GRZ1" (VIC) or "R2" (NSW)
  overlays: {
    flood: boolean;
    bushfire: boolean;
    heritage: boolean;
    vegetation: boolean;
    easement: boolean;
    other: string[];
  };
  sourceUrl: string | null; // official per-address report link
  plainEnglish: string; // LLM-written, grounded in the above
}

export interface CashflowYear {
  year: number;
  grossRent: number;
  operatingCosts: number;
  loanInterest: number;
  annualPrincipalRepayment: number; // P&I only; 0 for interest-only
  netCashflowPreTax: number; // CASH position (after interest AND principal)
  depreciation: number;
  taxableResult: number; // rent - opex - interest - depreciation (principal NOT deductible)
  negativeGearingBenefit: number; // indicative tax benefit when taxableResult < 0
  netCashflowAfterTax: number;
}

export interface InvestorAnalysis {
  currentMedianRent: number | null; // weekly
  grossYieldPct: number | null;
  capitalGrowth10Yr: { year: number; medianPrice: number }[]; // suburb median series
  capitalGrowthCagrPct: number | null;
  secondDwellingPotential: {
    landSupportsIt: boolean;
    summary: string; // "rules vary by state — verify locally"
  };
  cashflow3Yr: CashflowYear[];
  assumptions: {
    interestRatePct: number;
    lvrPct: number;
    loanType: LoanType;
    loanTermYears: number;
    opexPctOfRent: number;
    marginalTaxRatePct: number;
  };
  narrative: string; // LLM
}

export interface OwnerOccupierAnalysis {
  schoolZoneRating: number | null; // 1–10
  nearestTrainStation: { name: string; distanceKm: number; driveMin: number } | null;
  cbdCommute: { distanceKm: number; driveMin: number } | null;
  walkScoreEstimate: number | null; // 0–100
  crimeRateSummary: string; // from public research, neutral phrasing
  prosCons: { pros: string[]; cons: string[] }; // LLM
  narrative: string; // LLM
}

export interface EvaluationReport {
  generatedAt: string;
  dataSources: string[]; // provenance, shown in UI
  isMock: boolean;
  propertyInfo: PropertyInfo;
  planning: PlanningSnapshot;
  ownerOccupier: OwnerOccupierAnalysis;
  investor: InvestorAnalysis;
  disclaimer: string;
}

export interface EvaluateRequest {
  address: string;
  profile: UserProfile;
}

// ─────────────────────────────────────────────────────────────
// V3 — Conversational buyer-agent: search → score → recommend
// ─────────────────────────────────────────────────────────────

export interface ParsedQuery {
  rawQuery: string;
  intent: PrimaryIntent;
  budgetMax: number | null;
  budgetMin: number | null;
  minYieldPct: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  suburbs: string[];
  state: AUState | null;
  requirements: string[]; // free-text tags e.g. "school zone", "large land"
}

export interface Listing {
  id: string;
  address: string;
  suburb: string;
  state: AUState;
  postcode: string;
  price: number | null; // list price (or AVM mid if off-market)
  beds: number | null;
  baths: number | null;
  cars: number | null;
  landSqm: number | null;
  frontageM: number | null; // wide frontage = duplex/subdivision signal
  propertyType: string | null;
  lat?: number;
  lng?: number;
  listingUrl?: string | null; // link out to Domain
}

export type FactorKey =
  | "school"
  | "commute"
  | "safety"
  | "amenity"
  | "planning"
  | "yield"
  | "cagr"
  | "landPotential"
  | "taxBenefit"
  | "councilUpside";

export interface FactorScore {
  key: FactorKey;
  label: string;
  score: number; // 0–100
  weight: number; // intent-weighted importance
  detail: string; // grounded evidence string
  lens: "live" | "invest";
  source?: string; // data provenance, e.g. "Domain", "VicPlan/NSW GIS"
  isMock?: boolean; // true where the factor uses a proxy, not real data
}

export type StrategyKey = "sell" | "da" | "build" | "hold";

export interface StrategyRating {
  strategy: StrategyKey;
  label: string;
  stars: number; // 1–5, deterministic
  econ: string; // indicative numbers
  reason: string; // one sentence
}

export interface Recommendation {
  listing: Listing;
  estimatedValue: number | null;
  valueRange?: { low: number; high: number } | null;
  weeklyRent: number | null;
  grossYieldPct: number | null;
  // Investor headline metric — land value as a share of price.
  // NB: deliberately NOT called "LVR" (that means loan-to-value in AU).
  landToAssetRatioPct: number | null;
  strongLandPlay: boolean;
  // Owner-occupier headline — School Quality Score (rating × distance decay), 0–10.
  sqs: number | null;
  cagrPct: number | null;
  compositeScore: number; // 0–100, intent-weighted
  topFactors: FactorScore[]; // top 3 supporting factors
  allFactors: FactorScore[];
  strategies: StrategyRating[];
  planning: {
    zoneCodeRaw: string | null;
    overlays: PlanningSnapshot["overlays"];
    sourceUrl: string | null;
  };
  recommendationReason: string;
  cashflow3Yr: CashflowYear[];
}

export interface ChatResponse {
  isMock: boolean;
  parsed: ParsedQuery;
  agentNarrative: string;
  recommendations: Recommendation[];
  dataSources: string[];
  disclaimer: string;
}

export interface ChatRequest {
  message: string;
  verifiedBudget?: number | null; // hard ceiling once broker pre-approval is locked
  assumptions?: {
    depositPct?: number;
    loanType?: LoanType;
    annualIncomeBracket?: IncomeBracket;
  };
}

// ─────────────────────────────────────────────────────────────
// Broker mode: budget verification state machine + broker handshake
// ─────────────────────────────────────────────────────────────

export interface BudgetState {
  amount: number | null;
  verified: boolean; // false = Unverified (stated only); true = broker pre-approved
  brokerRef?: string | null;
}

export interface BrokerBrief {
  clientName: string;
  email: string;
  phone: string;
  inputBudget: number | null;
  intent: PrimaryIntent;
  suburbs: string[];
  consent: boolean; // explicit consent to share details + referral-fee disclosure
}
