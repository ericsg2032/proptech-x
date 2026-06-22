// ─────────────────────────────────────────────────────────────
// Dual-track headline metrics.
//
// SQS — School Quality Score for owner-occupiers: school rating decayed
//       by walking distance (no decay within 500m, fast decay past ~1.5km).
//
// Land-to-Asset Ratio — investor signal: estimated land value as a share of
//       price. The sound core of the "buy land, not the house" thesis.
//       IMPORTANT: this is NOT "LVR". In Australia LVR means Loan-to-Value
//       Ratio (a lending metric) and lives in cashflow.ts. Conflating the
//       two would confuse every buyer and broker — so we keep them distinct.
// ─────────────────────────────────────────────────────────────

/** School Quality Score, 0–10. */
export function computeSQS(schoolRating: number, schoolDistM: number): number {
  const decay = Math.exp(-0.001 * Math.max(0, schoolDistM - 500));
  return Math.round(schoolRating * decay * 10) / 10;
}

/** Rough walk-distance-to-school proxy from how walkable the area is. */
export function estimateSchoolDistM(amenityProxy: number): number {
  if (amenityProxy >= 84) return 500;
  if (amenityProxy >= 76) return 800;
  return 1200;
}

/**
 * Estimated land value as a share of price. Land share is anchored at a
 * typical ~55% and scaled by how big the block is relative to a 450m² norm.
 * This is an ESTIMATE (a precise figure needs a land valuation).
 */
export function computeLAR(
  landSqm: number | null,
  price: number | null,
): { ratioPct: number | null; strongLandPlay: boolean } {
  if (!landSqm || !price) return { ratioPct: null, strongLandPlay: false };
  const landShare = clamp(0.35 + 0.25 * (landSqm / 450), 0.3, 0.85);
  const ratioPct = Math.round(landShare * 1000) / 10;
  return { ratioPct, strongLandPlay: ratioPct >= 60 };
}

/** Strip phone/email so raw contact PII never reaches the LLM or logs. */
export function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email redacted]")
    .replace(/(?:\+?61\s?|0)[2-478](?:[ -]?\d){8}\b/g, "[phone redacted]");
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
