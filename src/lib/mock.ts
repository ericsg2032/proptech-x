import type { QualitativeOut } from "./llm";
import type { AUState, Listing } from "./types";

// Used when no LLM key is set, so the report reads naturally during UI testing.
export function mockQualitative(suburb: string): QualitativeOut {
  return {
    ownerOccupierProsCons: {
      pros: [
        `Walkable to transport and shops in ${suburb}`,
        "Well-regarded schools within or adjacent to the catchment",
        "Solid dwelling on a regular block",
      ],
      cons: [
        "A minor arterial road nearby may add traffic noise",
        "Older dwelling — budget for maintenance and energy upgrades",
      ],
    },
    ownerOccupierNarrative:
      `For owner-occupiers, this is a livability-first option: strong school access, genuine ` +
      `walkability and good transport. The main trade-off is road noise and the upkeep of an older home.`,
    investorNarrative:
      `As an investment, the appeal is the land component and a steady rental market rather than a ` +
      `standout yield. Holding costs at current rates mean it runs negatively geared early on.`,
    planningPlainEnglish:
      `Sits in a standard residential zone. Confirm any overlay before assuming an extension or ` +
      `second-dwelling footprint.`,
    secondDwellingSummary:
      `Land size suggests a second dwelling could be possible, but rules vary by state and council. ` +
      `Treat as a possibility to verify locally, not a given.`,
    crimeRateSummary:
      `Public data indicates broadly typical metropolitan rates for the area; no notable outliers.`,
  };
}

// ─────────────────────────────────────────────────────────────
// Intent-aware mock catalog. Even with zero keys, the chat returns
// properties in the CITY the user asked about (Sydney → NSW, etc.),
// so the demo never feels broken. Yields are kept realistic per market.
// ─────────────────────────────────────────────────────────────

type Overlays = Listing extends unknown ? {
  flood: boolean; bushfire: boolean; heritage: boolean; vegetation: boolean; easement: boolean; other: string[];
} : never;

interface MockEntry extends Listing {
  _weeklyRent: number;
  _base: number; // suburb median ~10yr ago
  _growth: number; // annual growth rate
  _overlays: Overlays;
  _commuteMin: number;
  _school: number;
  _safety: number;
  _amenity: number;
  _council: number;
}

const NONE: Overlays = { flood: false, bushfire: false, heritage: false, vegetation: false, easement: false, other: [] };
const ov = (o: Partial<Overlays>): Overlays => ({ ...NONE, ...o });

function E(p: Partial<MockEntry> & Pick<MockEntry, "id" | "address" | "suburb" | "state" | "postcode" | "price">): MockEntry {
  return {
    beds: 3, baths: 1, cars: 1, landSqm: 500, frontageM: 12, propertyType: "House",
    listingUrl: "https://www.domain.com.au/",
    _weeklyRent: 600, _base: 600_000, _growth: 0.05, _overlays: NONE,
    _commuteMin: 15, _school: 7, _safety: 74, _amenity: 78, _council: 60,
    ...p,
  } as MockEntry;
}

const CATALOG: Record<AUState, MockEntry[]> = {
  VIC: [
    E({ id: "VIC-1", address: "23 Glenlyon Rd, Brunswick VIC 3056", suburb: "Brunswick", state: "VIC", postcode: "3056", price: 1_150_000, beds: 3, baths: 1, cars: 2, landSqm: 604, frontageM: 15.2, lat: -37.7682, lng: 144.9614, _weeklyRent: 640, _base: 720_000, _growth: 0.05, _overlays: ov({ easement: true }), _commuteMin: 14, _school: 8, _amenity: 80, _council: 55 }),
    E({ id: "VIC-2", address: "8 Mater St, Collingwood VIC 3066", suburb: "Collingwood", state: "VIC", postcode: "3066", price: 1_080_000, beds: 2, baths: 1, cars: 0, landSqm: 188, frontageM: 5.0, lat: -37.8005, lng: 144.9876, _weeklyRent: 600, _base: 700_000, _growth: 0.056, _overlays: ov({ heritage: true }), _commuteMin: 9, _school: 6, _amenity: 88, _council: 55 }),
    E({ id: "VIC-3", address: "41 The Avenue, Coburg VIC 3058", suburb: "Coburg", state: "VIC", postcode: "3058", price: 1_190_000, beds: 4, baths: 2, cars: 2, landSqm: 720, frontageM: 18.3, lat: -37.7436, lng: 144.9631, _weeklyRent: 720, _base: 720_000, _growth: 0.052, _commuteMin: 18, _school: 9, _amenity: 76, _council: 70 }),
  ],
  NSW: [
    E({ id: "NSW-1", address: "14 Illawarra Rd, Marrickville NSW 2204", suburb: "Marrickville", state: "NSW", postcode: "2204", price: 1_650_000, beds: 3, baths: 1, cars: 1, landSqm: 430, frontageM: 12, lat: -33.9111, lng: 151.1547, _weeklyRent: 850, _base: 1_050_000, _growth: 0.054, _commuteMin: 16, _school: 8, _amenity: 84, _council: 60 }),
    E({ id: "NSW-2", address: "22 Albert St, Parramatta NSW 2150", suburb: "Parramatta", state: "NSW", postcode: "2150", price: 1_180_000, beds: 3, baths: 2, cars: 1, landSqm: 405, frontageM: 12.5, lat: -33.8136, lng: 151.0027, _weeklyRent: 780, _base: 760_000, _growth: 0.05, _commuteMin: 28, _school: 7, _amenity: 80, _council: 68 }),
    E({ id: "NSW-3", address: "30 Bourke St, Surry Hills NSW 2010", suburb: "Surry Hills", state: "NSW", postcode: "2010", price: 1_750_000, beds: 2, baths: 1, cars: 0, landSqm: 110, frontageM: 4.5, lat: -33.8853, lng: 151.2119, _weeklyRent: 950, _base: 1_200_000, _growth: 0.052, _overlays: ov({ heritage: true }), _commuteMin: 6, _school: 6, _amenity: 92, _council: 60 }),
  ],
  QLD: [
    E({ id: "QLD-1", address: "12 Cracknell Rd, Annerley QLD 4103", suburb: "Annerley", state: "QLD", postcode: "4103", price: 850_000, beds: 3, baths: 1, cars: 1, landSqm: 600, frontageM: 15, lat: -27.5103, lng: 153.0317, _weeklyRent: 650, _base: 520_000, _growth: 0.055, _commuteMin: 12, _school: 7, _amenity: 78, _council: 68 }),
    E({ id: "QLD-2", address: "9 Lisburn St, Woolloongabba QLD 4102", suburb: "Woolloongabba", state: "QLD", postcode: "4102", price: 1_100_000, beds: 3, baths: 2, cars: 1, landSqm: 405, frontageM: 10, lat: -27.4949, lng: 153.0345, _weeklyRent: 780, _base: 650_000, _growth: 0.058, _commuteMin: 6, _school: 7, _amenity: 82, _council: 70 }),
    E({ id: "QLD-3", address: "5 Hamson Tce, Chermside QLD 4032", suburb: "Chermside", state: "QLD", postcode: "4032", price: 900_000, beds: 4, baths: 2, cars: 2, landSqm: 620, frontageM: 16, lat: -27.3858, lng: 153.0316, _weeklyRent: 700, _base: 520_000, _growth: 0.054, _commuteMin: 20, _school: 8, _amenity: 75, _council: 72 }),
  ],
  SA: [
    E({ id: "SA-1", address: "10 Rose St, Prospect SA 5082", suburb: "Prospect", state: "SA", postcode: "5082", price: 900_000, beds: 3, baths: 1, cars: 2, landSqm: 700, frontageM: 17, lat: -34.8836, lng: 138.5953, _weeklyRent: 620, _base: 520_000, _growth: 0.056, _commuteMin: 10, _school: 8, _amenity: 76, _council: 62 }),
    E({ id: "SA-2", address: "18 George St, Norwood SA 5067", suburb: "Norwood", state: "SA", postcode: "5067", price: 1_150_000, beds: 3, baths: 2, cars: 1, landSqm: 480, frontageM: 12, lat: -34.9203, lng: 138.6311, _weeklyRent: 700, _base: 720_000, _growth: 0.052, _overlays: ov({ heritage: true }), _commuteMin: 8, _school: 8, _amenity: 86, _council: 60 }),
    E({ id: "SA-3", address: "7 Cral St, Findon SA 5023", suburb: "Findon", state: "SA", postcode: "5023", price: 750_000, beds: 3, baths: 1, cars: 2, landSqm: 650, frontageM: 16, lat: -34.8923, lng: 138.5453, _weeklyRent: 600, _base: 430_000, _growth: 0.054, _commuteMin: 15, _school: 6, _amenity: 70, _council: 64 }),
  ],
  WA: [
    E({ id: "WA-1", address: "12 Second Ave, Mount Lawley WA 6050", suburb: "Mount Lawley", state: "WA", postcode: "6050", price: 1_200_000, beds: 3, baths: 2, cars: 2, landSqm: 600, frontageM: 15, lat: -31.9355, lng: 115.8726, _weeklyRent: 750, _base: 760_000, _growth: 0.048, _overlays: ov({ heritage: true }), _commuteMin: 8, _school: 8, _amenity: 84, _council: 58 }),
    E({ id: "WA-2", address: "9 Surrey St, Bassendean WA 6054", suburb: "Bassendean", state: "WA", postcode: "6054", price: 750_000, beds: 3, baths: 1, cars: 2, landSqm: 700, frontageM: 18, lat: -31.9047, lng: 115.9453, _weeklyRent: 600, _base: 430_000, _growth: 0.05, _commuteMin: 16, _school: 6, _amenity: 70, _council: 64 }),
    E({ id: "WA-3", address: "5 Hay St, Subiaco WA 6008", suburb: "Subiaco", state: "WA", postcode: "6008", price: 1_400_000, beds: 3, baths: 2, cars: 1, landSqm: 410, frontageM: 11, lat: -31.9489, lng: 115.8261, _weeklyRent: 850, _base: 920_000, _growth: 0.046, _overlays: ov({ heritage: true }), _commuteMin: 6, _school: 8, _amenity: 90, _council: 56 }),
  ],
  TAS: [
    E({ id: "TAS-1", address: "12 Warwick St, Hobart TAS 7000", suburb: "Hobart", state: "TAS", postcode: "7000", price: 780_000, beds: 3, baths: 1, cars: 1, landSqm: 480, frontageM: 12, lat: -42.8794, lng: 147.3294, _weeklyRent: 580, _base: 420_000, _growth: 0.06, _commuteMin: 7, _school: 7, _amenity: 80, _council: 60 }),
    E({ id: "TAS-2", address: "8 Hampden Rd, Battery Point TAS 7004", suburb: "Battery Point", state: "TAS", postcode: "7004", price: 1_050_000, beds: 3, baths: 1, cars: 1, landSqm: 320, frontageM: 9, lat: -42.8901, lng: 147.3329, _weeklyRent: 680, _base: 600_000, _growth: 0.055, _overlays: ov({ heritage: true }), _commuteMin: 6, _school: 7, _amenity: 88, _council: 58 }),
    E({ id: "TAS-3", address: "5 Main Rd, Moonah TAS 7009", suburb: "Moonah", state: "TAS", postcode: "7009", price: 620_000, beds: 3, baths: 1, cars: 2, landSqm: 560, frontageM: 15, lat: -42.8419, lng: 147.3036, _weeklyRent: 520, _base: 330_000, _growth: 0.058, _commuteMin: 12, _school: 6, _amenity: 68, _council: 62 }),
  ],
  NT: [
    E({ id: "NT-1", address: "12 Smith St, Darwin NT 0800", suburb: "Darwin", state: "NT", postcode: "0800", price: 650_000, beds: 3, baths: 2, cars: 1, landSqm: 400, frontageM: 12, lat: -12.4611, lng: 130.8418, _weeklyRent: 620, _base: 480_000, _growth: 0.03, _commuteMin: 8, _school: 6, _amenity: 76, _council: 60 }),
    E({ id: "NT-2", address: "8 Gardens Rd, Fannie Bay NT 0820", suburb: "Fannie Bay", state: "NT", postcode: "0820", price: 850_000, beds: 4, baths: 2, cars: 2, landSqm: 620, frontageM: 16, lat: -12.4256, lng: 130.8311, _weeklyRent: 720, _base: 620_000, _growth: 0.032, _commuteMin: 10, _school: 7, _amenity: 78, _council: 62 }),
    E({ id: "NT-3", address: "5 Bradshaw Tce, Palmerston NT 0830", suburb: "Palmerston", state: "NT", postcode: "0830", price: 560_000, beds: 4, baths: 2, cars: 2, landSqm: 700, frontageM: 18, lat: -12.4861, lng: 130.9833, _weeklyRent: 600, _base: 440_000, _growth: 0.028, _commuteMin: 22, _school: 6, _amenity: 68, _council: 64 }),
  ],
  ACT: [
    E({ id: "ACT-1", address: "12 Eyre St, Kingston ACT 2604", suburb: "Kingston", state: "ACT", postcode: "2604", price: 1_150_000, beds: 3, baths: 2, cars: 1, landSqm: 380, frontageM: 11, lat: -35.3169, lng: 149.1419, _weeklyRent: 760, _base: 760_000, _growth: 0.045, _commuteMin: 8, _school: 8, _amenity: 84, _council: 64 }),
    E({ id: "ACT-2", address: "8 Antill St, Dickson ACT 2602", suburb: "Dickson", state: "ACT", postcode: "2602", price: 980_000, beds: 3, baths: 1, cars: 2, landSqm: 620, frontageM: 16, lat: -35.2503, lng: 149.1419, _weeklyRent: 700, _base: 620_000, _growth: 0.046, _commuteMin: 10, _school: 8, _amenity: 78, _council: 66 }),
    E({ id: "ACT-3", address: "5 Hibberson St, Gungahlin ACT 2912", suburb: "Gungahlin", state: "ACT", postcode: "2912", price: 820_000, beds: 4, baths: 2, cars: 2, landSqm: 480, frontageM: 13, lat: -35.1839, lng: 149.1331, _weeklyRent: 680, _base: 520_000, _growth: 0.044, _commuteMin: 18, _school: 7, _amenity: 74, _council: 68 }),
  ],
};

const FLAT: Record<string, MockEntry> = Object.values(CATALOG).flat().reduce((acc, e) => { acc[e.id] = e; return acc; }, {} as Record<string, MockEntry>);

export function mockListings(state?: AUState | null, _suburbs?: string[]): Listing[] {
  const list = (state && CATALOG[state]) || CATALOG.VIC;
  return list.map(stripPrivate);
}

function stripPrivate(e: MockEntry): Listing {
  const { _weeklyRent, _base, _growth, _overlays, _commuteMin, _school, _safety, _amenity, _council, ...listing } = e;
  return listing;
}

// Per-listing enrichment. Reads the catalog entry when available; otherwise
// derives generic proxies from the listing itself (used for real listings).
export function mockEnrichment(l: Listing) {
  const e = FLAT[l.id];
  if (e) {
    return {
      estimatedValue: e.price,
      valueRange: e.price ? { low: Math.round(e.price * 0.94), high: Math.round(e.price * 1.07) } : null,
      weeklyRent: e._weeklyRent,
      medianPriceSeries: series(e._base, e._growth),
      overlays: e._overlays,
      commuteDriveMin: e._commuteMin,
      schoolRating: e._school,
      safetyProxy: e._safety,
      amenityProxy: e._amenity,
      councilUpsideProxy: e._council,
    };
  }
  // generic fallback for real listings missing some data
  const seed = (l.id.charCodeAt(l.id.length - 1) || 7) % 10;
  const rent = (l.beds ?? 3) >= 4 ? 720 : (l.beds ?? 3) === 3 ? 640 : 560;
  return {
    estimatedValue: l.price,
    valueRange: l.price ? { low: Math.round(l.price * 0.94), high: Math.round(l.price * 1.07) } : null,
    weeklyRent: rent,
    medianPriceSeries: series(700_000, 0.05),
    overlays: NONE,
    commuteDriveMin: 12 + seed,
    schoolRating: 6 + (seed % 4),
    safetyProxy: 70 + seed,
    amenityProxy: 74 + (seed % 12),
    councilUpsideProxy: 55 + seed,
  };
}

function series(base: number, growth: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    year: new Date().getFullYear() - 9 + i,
    medianPrice: Math.round(base * Math.pow(1 + growth, i)),
  }));
}
