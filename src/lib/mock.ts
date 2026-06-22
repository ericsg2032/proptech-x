import type { QualitativeOut } from "./llm";

// Used when no LLM key is set, so the report reads naturally during UI testing.
export function mockQualitative(suburb: string): QualitativeOut {
  return {
    ownerOccupierProsCons: {
      pros: [
        `Walkable to two stations and a shopping precinct in ${suburb}`,
        "Well-regarded schools within or adjacent to the catchment",
        "Period home on a regular, usable block",
      ],
      cons: [
        "A minor arterial road on the eastern boundary may add traffic noise",
        "Older dwelling — budget for maintenance and energy upgrades",
      ],
    },
    ownerOccupierNarrative:
      `For owner-occupiers, this is a livability-first option: strong school access, ` +
      `genuine walkability and good transport. The main trade-off is road noise on one ` +
      `boundary and the upkeep that comes with an older home — worth checking at inspection.`,
    investorNarrative:
      `As an investment, the appeal is the land component and a steady rental market rather ` +
      `than a standout yield. The suburb's median has compounded at a healthy rate, but ` +
      `holding costs at current rates mean it runs negatively geared in the early years.`,
    planningPlainEnglish:
      `Sits in a standard residential zone. An easement is flagged on title — confirm its ` +
      `location before assuming any extension or second-dwelling footprint, as you generally ` +
      `can't build over it without the asset owner's consent.`,
    secondDwellingSummary:
      `Land size suggests a second dwelling could be physically possible, but rules vary by ` +
      `state and council (setbacks, overlays, the easement above). Treat as a possibility to ` +
      `verify locally, not a given.`,
    crimeRateSummary:
      `Public data indicates broadly typical metropolitan rates for the area; no notable ` +
      `outliers surfaced in the research.`,
  };
}

// ── V3 mock listings + per-listing enrichment proxies ──
import type { AUState, Listing } from "./types";

export function mockListings(): Listing[] {
  return [
    {
      id: "L-001",
      address: "23 Glenlyon Rd, Brunswick VIC 3056",
      suburb: "Brunswick",
      state: "VIC" as AUState,
      postcode: "3056",
      price: 1_150_000,
      beds: 3,
      baths: 1,
      cars: 2,
      landSqm: 604,
      frontageM: 15.2,
      propertyType: "House",
      lat: -37.7682,
      lng: 144.9614,
      listingUrl: "https://www.domain.com.au/",
    },
    {
      id: "L-002",
      address: "8 Mater St, Collingwood VIC 3066",
      suburb: "Collingwood",
      state: "VIC" as AUState,
      postcode: "3066",
      price: 1_080_000,
      beds: 2,
      baths: 1,
      cars: 0,
      landSqm: 188,
      frontageM: 5.0,
      propertyType: "House",
      lat: -37.8005,
      lng: 144.9876,
      listingUrl: "https://www.domain.com.au/",
    },
    {
      id: "L-003",
      address: "41 The Avenue, Coburg VIC 3058",
      suburb: "Coburg",
      state: "VIC" as AUState,
      postcode: "3058",
      price: 1_190_000,
      beds: 4,
      baths: 2,
      cars: 2,
      landSqm: 720,
      frontageM: 18.3,
      propertyType: "House",
      lat: -37.7436,
      lng: 144.9631,
      listingUrl: "https://www.domain.com.au/",
    },
  ];
}

// Deterministic per-listing proxies so scoring is stable in demo mode.
export function mockEnrichment(l: Listing) {
  const seed = l.id.charCodeAt(l.id.length - 1);
  return {
    estimatedValue: l.price,
    valueRange: l.price ? { low: Math.round(l.price * 0.94), high: Math.round(l.price * 1.07) } : null,
    weeklyRent: l.beds && l.beds >= 4 ? 720 : l.beds === 3 ? 640 : 560,
    medianPriceSeries: Array.from({ length: 10 }, (_, i) => ({
      year: new Date().getFullYear() - 9 + i,
      medianPrice: Math.round(720_000 * Math.pow(1.05 + (seed % 3) * 0.003, i)),
    })),
    overlays: {
      flood: false,
      bushfire: false,
      heritage: l.id === "L-002", // Collingwood lot: heritage-constrained
      vegetation: false,
      easement: l.id === "L-001", // Brunswick lot: easement
      other: [] as string[],
    },
    commuteDriveMin: l.id === "L-002" ? 9 : l.id === "L-001" ? 14 : 18,
    schoolRating: l.id === "L-003" ? 9 : l.id === "L-001" ? 8 : 6,
    safetyProxy: 72 + (seed % 10),
    amenityProxy: l.id === "L-002" ? 88 : 76,
    councilUpsideProxy: l.id === "L-003" ? 70 : 55,
  };
}
