import type { ParsedQuery, PrimaryIntent } from "./types";
import { detectState } from "./planning";

// Lightweight intent parser used when no LLM key is set, so the chat flow
// works on day one. The LLM path (llm.ts) produces richer parsing.
export function parseQueryHeuristic(message: string): ParsedQuery {
  const m = message.toLowerCase();

  // Intent
  let intent: PrimaryIntent = "both";
  const investHints = ["invest", "investment", "yield", "rental", "rent out", "cash flow", "cashflow", "投资", "出租", "回报"];
  const liveHints = ["live", "owner occup", "to live", "family home", "自住", "居住", "学区", "school zone"];
  const hasInvest = investHints.some((h) => m.includes(h));
  const hasLive = liveHints.some((h) => m.includes(h));
  if (hasInvest && !hasLive) intent = "invest";
  else if (hasLive && !hasInvest) intent = "live";

  // Budget — handle $1.2m / 1.2 million / under 900k / $1,200,000
  const budgetMax = parseMoney(m, ["under", "below", "max", "up to", "<", "以内", "以下"]) ?? parseAnyMoney(m);
  const budgetMin = parseMoney(m, ["over", "above", "min", ">", "以上"]);

  // Min yield e.g. ">5.5% yield"
  const yieldMatch = m.match(/(\d+(?:\.\d+)?)\s*%/);
  const minYieldPct = yieldMatch && (m.includes("yield") || m.includes("回报")) ? parseFloat(yieldMatch[1]) : null;

  // Bedrooms
  const bedMatch = m.match(/(\d+)\s*(?:bed|br|bedroom|房|室)/);
  const bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : null;

  // Property type
  let propertyType: string | null = null;
  if (m.includes("apartment") || m.includes("unit") || m.includes("公寓")) propertyType = "apartment";
  else if (m.includes("townhouse") || m.includes("联排")) propertyType = "townhouse";
  else if (m.includes("house") || m.includes("别墅") || m.includes("独立屋")) propertyType = "house";

  // Suburbs / state — naive capitalised-word + known suburb capture
  const suburbs = extractSuburbs(message);
  const state = /\b(nsw|vic|qld|sa|wa|tas|nt|act)\b/i.test(message) || /\b\d{4}\b/.test(message)
    ? detectState(message)
    : null;

  // Requirement tags
  const requirements: string[] = [];
  if (hasLive || m.includes("school")) requirements.push("school zone");
  if (m.includes("land") || m.includes("big block") || m.includes("large block") || m.includes("大地") || m.includes("地块")) requirements.push("large land");
  if (m.includes("frontage") || m.includes("duplex") || m.includes("subdiv") || m.includes("面宽") || m.includes("分割")) requirements.push("development potential");
  if (m.includes("train") || m.includes("station") || m.includes("commute") || m.includes("通勤") || m.includes("地铁")) requirements.push("transport");
  if (minYieldPct) requirements.push(`yield > ${minYieldPct}%`);

  return {
    rawQuery: message,
    intent,
    budgetMax,
    budgetMin,
    minYieldPct,
    bedrooms,
    propertyType,
    suburbs,
    state,
    requirements,
  };
}

function parseMoney(text: string, triggers: string[]): number | null {
  for (const t of triggers) {
    const idx = text.indexOf(t);
    if (idx >= 0) {
      const after = text.slice(idx, idx + 24);
      const v = parseAnyMoney(after);
      if (v) return v;
    }
  }
  return null;
}

function parseAnyMoney(text: string): number | null {
  // $1.2m / 1.2 million / 900k / $1,200,000 / 120万
  const wan = text.match(/(\d+(?:\.\d+)?)\s*万/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const mil = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*(m|mil|million)\b/);
  if (mil) return Math.round(parseFloat(mil[1]) * 1_000_000);
  const k = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1_000);
  const plain = text.match(/\$\s*([\d,]{4,})/);
  if (plain) return parseInt(plain[1].replace(/,/g, ""), 10);
  return null;
}

const KNOWN_SUBURBS = [
  "Brunswick", "Richmond", "Coburg", "Fitzroy", "Carlton", "Preston", "Northcote",
  "Redfern", "Newtown", "Parramatta", "Bondi", "Chatswood",
  "Brisbane", "South Brisbane", "Toowong", "Chermside",
  "Adelaide", "Norwood", "Perth", "Fremantle", "Subiaco", "Hobart",
];

function extractSuburbs(message: string): string[] {
  const found = KNOWN_SUBURBS.filter((s) => message.toLowerCase().includes(s.toLowerCase()));
  return Array.from(new Set(found));
}
