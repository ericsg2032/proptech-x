// ─────────────────────────────────────────────────────────────
// Domain official API (developer.domain.com.au) — the legal, national
// source for property specs, AVM, suburb performance, rent and listing
// search. Free "innovation" tier to start; production load needs a paid tier.
//
// Endpoints verified against the Domain developer portal:
//   GET  /v1/properties/_suggest?terms=...        → resolve address to id
//   GET  /v1/properties/{id}                      → beds/baths/cars/land/type
//   GET  /v1/properties/{id}/priceEstimate        → AVM mid + range
//   GET  /v2/suburbPerformanceStatistics/{state}/{suburb}/{postcode}
//   POST /v1/listings/residential/_search         → active listings
//
// Go-live terms: show "Powered by Domain", link out to the listing, and
// don't persist Listings data long-term.
// ─────────────────────────────────────────────────────────────

import type { AUState, Listing, ParsedQuery } from "./types";
import { mockListings, mockSuburbStatsFor, mockPropertyFor } from "./mock";

const TOKEN_URL = "https://auth.domain.com.au/v1/connect/token";
const API = "https://api.domain.com.au";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.DOMAIN_CLIENT_ID;
  const secret = process.env.DOMAIN_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  // Scopes must match the APIs enabled on your Domain project.
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope:
      "api_listings_read api_properties_read api_addresslocators_read api_suburbperformancestatistics_read api_propertysuggestions_read api_priceestimate_read",
  });
  try {
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
    cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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
    const sug = await fetch(`${API}/v1/properties/_suggest?terms=${encodeURIComponent(address)}&pageSize=1`, {
      headers: authHeaders(token),
    });
    if (!sug.ok) return mockProperty(address);
    const suggestions = await sug.json();
    const id = Array.isArray(suggestions) ? suggestions[0]?.id : null;
    if (!id) return mockProperty(address);

    const [propRes, peRes] = await Promise.all([
      fetch(`${API}/v1/properties/${id}`, { headers: authHeaders(token) }),
      fetch(`${API}/v1/properties/${id}/priceEstimate`, { headers: authHeaders(token) }),
    ]);
    const prop = propRes.ok ? await propRes.json() : null;

    let estimatedValue: number | null = null;
    let valueRange: { low: number; high: number } | null = null;
    if (peRes.ok) {
      const pe = await peRes.json();
      // field names vary by package version — read the likely candidates
      estimatedValue = pe.priceEstimate ?? pe.midPriceEstimate ?? pe.estimatedValue ?? null;
      const low = pe.lowerPriceEstimate ?? pe.lowPriceEstimate ?? null;
      const high = pe.upperPriceEstimate ?? pe.highPriceEstimate ?? null;
      if (low != null && high != null) valueRange = { low, high };
    }

    return {
      estimatedValue,
      valueRange,
      beds: prop?.bedrooms ?? null,
      baths: prop?.bathrooms ?? null,
      cars: prop?.carSpaces ?? null,
      landSqm: prop?.landArea ?? null,
      propertyType: prop?.propertyCategory ?? prop?.propertyType ?? null,
    };
  } catch {
    return mockProperty(address);
  }
}

export async function getSuburbStats(state: AUState, suburb: string, postcode: string): Promise<DomainSuburbStats> {
  const token = await getToken();
  if (!token) return mockSuburbStats(suburb);
  try {
    const url =
      `${API}/v2/suburbPerformanceStatistics/${state.toLowerCase()}/${encodeURIComponent(suburb)}/${postcode}` +
      `?propertyCategory=house&chronologicalSpan=12&tPlusFrom=1&tPlusTo=10`;
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) return mockSuburbStats(suburb);
    const data = await res.json();
    const info: any[] = data?.series?.seriesInfo ?? [];

    const byYear = new Map<number, number>();
    let latestRent: number | null = null;
    for (const pt of info) {
      const v = pt?.values ?? {};
      if (typeof v.medianSoldPrice === "number") byYear.set(pt.year, v.medianSoldPrice);
      if (typeof v.medianRentListingPrice === "number") latestRent = v.medianRentListingPrice; // weekly
    }
    const series = Array.from(byYear.entries())
      .map(([year, medianPrice]) => ({ year, medianPrice }))
      .sort((a, b) => a.year - b.year);

    return {
      medianWeeklyRent: latestRent ?? mockSuburbStats(suburb).medianWeeklyRent,
      medianPriceSeries: series.length ? series : mockSuburbStats(suburb).medianPriceSeries,
    };
  } catch {
    return mockSuburbStats(suburb);
  }
}

// ── Listing search (the buyer-agent engine) ──
export async function searchListings(q: ParsedQuery): Promise<Listing[]> {
  const token = await getToken();
  if (!token) return filterMock(q);
  try {
    const body: Record<string, unknown> = {
      listingType: "Sale",
      propertyTypes: q.propertyType ? [titleCase(q.propertyType)] : undefined,
      minBedrooms: q.bedrooms ?? undefined,
      maxPrice: q.budgetMax ?? undefined,
      minPrice: q.budgetMin ?? undefined,
      locations: q.suburbs.length
        ? q.suburbs.map((s) => ({ state: q.state ?? "", region: "", area: "", suburb: s, includeSurroundingSuburbs: true }))
        : undefined,
      pageSize: 10,
    };
    const res = await fetch(`${API}/v1/listings/residential/_search`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (!res.ok) return filterMock(q);
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : [];
    const mapped: Listing[] = items
      .filter((x) => x?.listing && (x.type === "PropertyListing" || x.listing.propertyDetails))
      .map((x) => {
        const L = x.listing;
        const pd = L.propertyDetails ?? {};
        return {
          id: String(L.id ?? pd.displayableAddress ?? Math.random()),
          address: pd.displayableAddress ?? `${pd.streetNumber ?? ""} ${pd.street ?? ""}, ${pd.suburb ?? ""} ${pd.state ?? ""} ${pd.postcode ?? ""}`.trim(),
          suburb: pd.suburb ?? "",
          state: (pd.state ?? "NSW") as AUState,
          postcode: pd.postcode ?? "",
          price: L.priceDetails?.price ?? null, // often null — Domain shows text price; AVM is a paid add-on
          beds: pd.bedrooms ?? null,
          baths: pd.bathrooms ?? null,
          cars: pd.carspaces ?? null,
          landSqm: pd.landArea ?? null,
          frontageM: null, // frontage isn't in listing data — comes from cadastre/title
          propertyType: Array.isArray(pd.propertyType) ? pd.propertyType[0] : pd.propertyType ?? null,
          lat: pd.latitude ?? undefined,
          lng: pd.longitude ?? undefined,
          listingUrl: L.seoUrl ? `https://www.domain.com.au/${L.seoUrl}` : "https://www.domain.com.au/",
        };
      });
    return mapped.length ? mapped.slice(0, 6) : filterMock(q);
  } catch {
    return filterMock(q);
  }
}

function filterMock(q: ParsedQuery): Listing[] {
  let items = mockListings(q.state, q.suburbs);
  if (q.budgetMax) items = items.filter((l) => (l.price ?? 0) <= q.budgetMax! * 1.05);
  if (q.bedrooms) items = items.filter((l) => (l.beds ?? 0) >= q.bedrooms!);
  if (q.suburbs.length) {
    const m = items.filter((l) => q.suburbs.some((s) => l.suburb.toLowerCase() === s.toLowerCase()));
    if (m.length) items = m;
  }
  return (items.length ? items : mockListings()).slice(0, 3);
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Mocks (realistic, so the app runs with zero keys) ──
function mockProperty(address: string): DomainProperty {
  const c = mockPropertyFor(address);
  if (c) return c;
  return { estimatedValue: 1_180_000, valueRange: { low: 1_080_000, high: 1_290_000 }, beds: 3, baths: 2, cars: 1, landSqm: 520, propertyType: "House" };
}
function mockSuburbStats(suburb?: string): DomainSuburbStats {
  const c = suburb ? mockSuburbStatsFor(suburb) : null;
  if (c) return c;
  const base = 760_000;
  const generic = Array.from({ length: 10 }, (_, i) => ({ year: new Date().getFullYear() - 9 + i, medianPrice: Math.round(base * Math.pow(1.052, i)) }));
  return { medianWeeklyRent: 640, medianPriceSeries: generic };
}
