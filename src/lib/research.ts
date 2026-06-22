// ─────────────────────────────────────────────────────────────
// Long-tail PUBLIC research only: council news, suburb lifestyle,
// school context, recent policy changes. This is the correct use of a
// semantic-search API.
//
// IMPORTANT: never aim this at realestate.com.au / domain.com.au listing
// or sales data — that's their proprietary data and against their ToS.
// Structured property/market data comes from the Domain API (domain.ts).
// ─────────────────────────────────────────────────────────────

export interface ResearchSnippet {
  title: string;
  url: string;
  text: string;
}

// Public, research-appropriate domains. Note: NO realestate/domain listings.
const PUBLIC_RESEARCH_HINTS = [
  "site:abs.gov.au",
  "council",
  "school catchment",
  "suburb profile",
];

export async function publicResearch(
  suburb: string,
  topics: string[],
): Promise<ResearchSnippet[]> {
  const exa = process.env.EXA_API_KEY;
  const tavily = process.env.TAVILY_API_KEY;
  const query = `${suburb} ${topics.join(" ")} ${PUBLIC_RESEARCH_HINTS[2]}`;

  if (exa) return exaSearch(exa, query);
  if (tavily) return tavilySearch(tavily, query);
  return mockResearch(suburb);
}

async function exaSearch(key: string, query: string): Promise<ResearchSnippet[]> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        query,
        numResults: 5,
        type: "auto",
        contents: { text: { maxCharacters: 1200 } },
        // Keep it to public research sources; exclude listing portals.
        excludeDomains: ["realestate.com.au", "domain.com.au"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      text: r.text ?? "",
    }));
  } catch {
    return [];
  }
}

async function tavilySearch(key: string, query: string): Promise<ResearchSnippet[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        exclude_domains: ["realestate.com.au", "domain.com.au"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      text: r.content ?? "",
    }));
  } catch {
    return [];
  }
}

function mockResearch(suburb: string): ResearchSnippet[] {
  return [
    {
      title: `${suburb} suburb profile`,
      url: "https://www.abs.gov.au/",
      text: `${suburb} is an established, well-serviced suburb with a mix of period homes and newer townhouses. Median household income sits slightly above the metro average; the area skews toward families and professionals.`,
    },
    {
      title: `Schools near ${suburb}`,
      url: "https://www.bettereducation.com.au/",
      text: `Several well-regarded primary and secondary schools fall within or adjacent to the catchment. Selective and private options are within a short drive.`,
    },
    {
      title: `${suburb} amenity & transport`,
      url: "https://www.example-council.vic.gov.au/",
      text: `Two train stations within ~1.5km, a shopping precinct, parks and a hospital nearby. A minor arterial road borders the eastern edge.`,
    },
  ];
}
