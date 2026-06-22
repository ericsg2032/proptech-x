// ─────────────────────────────────────────────────────────────
// Domain official API (developer.domain.com.au) — the SANCTIONED,
// national source for listings, comparable sales, suburb performance,
// AVM (price estimate) and rent. Free "innovation" tier to start.
//
// This deliberately REPLACES scraping realestate.com.au / domain.com.au,
// which is against their terms of use. Same data, legally.
//
// Go-live note: display "Powered by Domain", link out to the original
// listing, and don't persist Listings data long-term.
// ─────────────────────────────────────────────────────────────

import type { AUState } from "./types";

const TOKEN_URL = "https://auth.domain.com.au/v1/connect/token";
const API = "https://api.domain.com.au";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.DOMAIN_CLIENT_ID;
  const secret = process.env.DOMAIN_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "api_listings_read api_properties_read api_locations_read api_suburbperformance_read",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

export interface DomainProperty {
  estimatedValue: number | null;
  valueRange: { low: number; high: number } | null;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  landSqm: number | null;
  propertyType: string | null;
}

export interface DomainSuburbStats {
  medianWeeklyRent: number | null;
  medianPriceSeries: { year: number; medianPrice: number }[];
}

export async function getProperty(address: string): Promise<DomainProperty> {
  const token = await getToken();
  if (!token) return mockProperty(address);
  try {
    // 1) resolve address -> propertyId, 2) GET /v1/properties/{id}, 3) GET price estimate.
    // Endpoints: POST /v1/addressLocators , GET /v1/properties/{id},
    //            GET /v1/priceEstimates/...  (see developer.domain.com.au)
    // Left as a typed stub with the real call shape:
    const res = await fetch(`${API}/v1/properties/_suggest?terms=${encodeURIComponent(address)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return mockProperty(address);
    // Map Domain's response into DomainProperty here.
    return mockProperty(address); // TODO: parse real fields
  } catch {
    return mockProperty(address);
  }
}

export async function getSuburbStats(
  state: AUState,
  suburb: string,
  postcode: string,
): Promise<DomainSuburbStats> {
  const token = await getToken();
  if (!token) return mockSuburbStats();
  try {
    // GET /v2/suburbPerformanceStatistics/{state}/{suburb}/{postcode}
    const res = await fetch(
      `${API}/v2/suburbPerformanceStatistics/${state}/${encodeURIComponent(suburb)}/${postcode}` +
        `?propertyCategory=house&chronologicalSpan=12`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return mockSuburbStats();
    // Map series[].seriesInfo[] -> medianPriceSeries and latest medianRentListingPrice.
    return mockSuburbStats(); // TODO: parse real fields
  } catch {
    return mockSuburbStats();
  }
}

// ── Mocks (realistic, so the UI is fully testable with zero keys) ──
function mockProperty(_address: string): DomainProperty {
  return {
    estimatedValue: 1_180_000,
    valueRange: { low: 1_080_000, high: 1_290_000 },
    beds: 3,
    baths: 2,
    cars: 1,
    landSqm: 520,
    propertyType: "House",
  };
}

function mockSuburbStats(): DomainSuburbStats {
  const base = 760_000;
  const series = Array.from({ length: 10 }, (_, i) => ({
    year: new Date().getFullYear() - 9 + i,
    medianPrice: Math.round(base * Math.pow(1.052, i)),
  }));
  return { medianWeeklyRent: 640, medianPriceSeries: series };
}
