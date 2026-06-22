import type { CashflowYear, IncomeBracket, UserProfile } from "./types";

// ─────────────────────────────────────────────────────────────
// Financial maths is done HERE, in code — never delegated to the LLM.
// Indicative figures only (not advice).
// ─────────────────────────────────────────────────────────────

export const DEFAULTS = {
  interestRatePct: 6.3,
  opexPctOfRent: 22,
  loanTermYears: 30,
  capitalWorksPctOfBuild: 2.5, // Div 43, ~2.5%/yr on building value
  buildValueShareOfPrice: 0.45,
  rentGrowthPctPerYear: 3,
  priceGrowthAssumptionPctPerYear: 4,
  defaultIncomeBracket: "mid" as IncomeBracket,
};

// AU resident marginal tax rates (excludes 2% Medicare levy — kept simple).
export const MARGINAL_TAX_BY_BRACKET: Record<IncomeBracket, number> = {
  low: 16, // $18,201–$45,000
  mid: 30, // $45,001–$135,000
  high: 37, // $135,001–$190,000
  top: 45, // $190,001+
};

export function grossYieldPct(weeklyRent: number, value: number): number | null {
  if (!weeklyRent || !value) return null;
  return round1((weeklyRent * 52) / value * 100);
}

export function cagrPct(series: { year: number; medianPrice: number }[]): number | null {
  const valid = series.filter((p) => p.medianPrice > 0).sort((a, b) => a.year - b.year);
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const years = last.year - first.year;
  if (years <= 0) return null;
  return round1((Math.pow(last.medianPrice / first.medianPrice, 1 / years) - 1) * 100);
}

/** Split a loan into per-year interest vs principal for the first `report` years. */
function amortise(loan: number, annualRatePct: number, termYears: number, report = 3) {
  const mr = annualRatePct / 100 / 12;
  const n = termYears * 12;
  const emi = mr === 0 ? loan / n : (loan * mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
  let balance = loan;
  const yearInterest: number[] = [];
  const yearPrincipal: number[] = [];
  for (let y = 0; y < report; y++) {
    let iSum = 0;
    let pSum = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * mr;
      const principal = Math.min(emi - interest, balance);
      balance -= principal;
      iSum += interest;
      pSum += principal;
    }
    yearInterest.push(iSum);
    yearPrincipal.push(pSum);
  }
  return { yearInterest, yearPrincipal };
}

interface CashflowInput {
  propertyValue: number;
  weeklyRent: number;
  profile: UserProfile;
  interestRatePct?: number;
  opexPctOfRent?: number;
}

export function projectCashflow(input: CashflowInput) {
  const interestRatePct = input.interestRatePct ?? DEFAULTS.interestRatePct;
  const opexPctOfRent = input.opexPctOfRent ?? DEFAULTS.opexPctOfRent;
  const loanType = input.profile.loanType ?? "PI";
  const loanTermYears = input.profile.loanTermYears ?? DEFAULTS.loanTermYears;
  const bracket = input.profile.annualIncomeBracket ?? DEFAULTS.defaultIncomeBracket;
  const marginalTaxRatePct = MARGINAL_TAX_BY_BRACKET[bracket];

  const value = input.propertyValue || 0;
  const depositPct = clamp(input.profile.depositPct || 20, 5, 100);
  const lvrPct = round1(100 - depositPct);
  const loan = value * (lvrPct / 100);

  const buildingValue = value * DEFAULTS.buildValueShareOfPrice;
  const depreciation = round0(buildingValue * (DEFAULTS.capitalWorksPctOfBuild / 100));

  // Interest vs principal per year.
  let yearInterest: number[];
  let yearPrincipal: number[];
  if (loanType === "IO") {
    yearInterest = [0, 1, 2].map(() => loan * (interestRatePct / 100));
    yearPrincipal = [0, 0, 0];
  } else {
    ({ yearInterest, yearPrincipal } = amortise(loan, interestRatePct, loanTermYears, 3));
  }

  const years: CashflowYear[] = [];
  for (let i = 0; i < 3; i++) {
    const year = new Date().getFullYear() + i;
    const grossRent = round0(
      input.weeklyRent * 52 * Math.pow(1 + DEFAULTS.rentGrowthPctPerYear / 100, i),
    );
    const operatingCosts = round0(grossRent * (opexPctOfRent / 100));
    const loanInterest = round0(yearInterest[i]);
    const principal = round0(yearPrincipal[i]);

    // CASH: rent in, minus opex, interest AND principal out.
    const netCashflowPreTax = round0(grossRent - operatingCosts - loanInterest - principal);

    // TAXABLE: only interest + opex + depreciation are deductible (principal is NOT).
    const taxableResult = round0(grossRent - operatingCosts - loanInterest - depreciation);
    const taxImpact =
      taxableResult < 0
        ? round0(Math.abs(taxableResult) * (marginalTaxRatePct / 100)) // benefit (+cash)
        : -round0(taxableResult * (marginalTaxRatePct / 100)); // tax payable (−cash)
    const negativeGearingBenefit = taxableResult < 0 ? Math.abs(taxImpact) : 0;
    const netCashflowAfterTax = round0(netCashflowPreTax + taxImpact);

    years.push({
      year,
      grossRent,
      operatingCosts,
      loanInterest,
      annualPrincipalRepayment: principal,
      netCashflowPreTax,
      depreciation,
      taxableResult,
      negativeGearingBenefit,
      netCashflowAfterTax,
    });
  }

  return {
    years,
    assumptions: {
      interestRatePct,
      lvrPct,
      loanType,
      loanTermYears,
      opexPctOfRent,
      marginalTaxRatePct,
    },
  };
}

/**
 * Second-dwelling potential.
 * Land size is necessary but NOT sufficient: a hostile planning overlay
 * (heritage / flood / easement) means Council generally won't approve a
 * second dwelling, so we hard-block regardless of size.
 */
export function secondDwellingHeuristic(
  landSqm: number | null,
  overlays?: { heritage: boolean; flood: boolean; easement: boolean },
): { supported: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (overlays?.heritage) blockers.push("Heritage overlay");
  if (overlays?.flood) blockers.push("Flood / inundation overlay");
  if (overlays?.easement) blockers.push("Easement across the lot");
  if (blockers.length > 0) return { supported: false, blockers };
  return { supported: (landSqm ?? 0) >= 350, blockers: [] };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function round0(n: number) {
  return Math.round(n);
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
