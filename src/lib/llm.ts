// ─────────────────────────────────────────────────────────────
// The LLM is used ONLY for qualitative synthesis — turning the
// already-fetched structured data + public research into plain-English
// pros/cons and narratives. It is NEVER asked to invent numbers.
// Provider auto-selected from whichever API key is present.
// ─────────────────────────────────────────────────────────────

export interface QualitativeOut {
  ownerOccupierProsCons: { pros: string[]; cons: string[] };
  ownerOccupierNarrative: string;
  investorNarrative: string;
  planningPlainEnglish: string;
  secondDwellingSummary: string;
  crimeRateSummary: string;
}

const SYSTEM = `You are the analyst inside PropTech-X, an Australian property research tool.
You are given STRUCTURED FACTS (already computed) plus PUBLIC RESEARCH snippets for one property.
Write balanced, specific, plain-English synthesis for a buyer deciding owner-occupier vs investment.

Hard rules:
- Do NOT invent or change any number. Refer only to figures present in the FACTS.
- Be balanced: surface genuine downsides, not just upsides.
- Keep crime phrasing neutral and non-stigmatising; summarise only what the research supports.
- This is general information, not financial/legal/tax advice.
- Return ONLY strict JSON matching the schema. No markdown, no backticks.`;

function buildUserPrompt(facts: object, research: object): string {
  return `FACTS:\n${JSON.stringify(facts, null, 2)}\n\nPUBLIC_RESEARCH:\n${JSON.stringify(
    research,
    null,
    2,
  )}\n\nReturn JSON with exactly these keys:
{
  "ownerOccupierProsCons": { "pros": string[], "cons": string[] },
  "ownerOccupierNarrative": string,
  "investorNarrative": string,
  "planningPlainEnglish": string,
  "secondDwellingSummary": string,
  "crimeRateSummary": string
}`;
}

export async function synthesize(facts: object, research: object): Promise<QualitativeOut | null> {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  const use = provider || (hasAnthropic ? "anthropic" : hasGemini ? "gemini" : "");
  if (!use) return null; // caller falls back to mock qualitative text

  const user = buildUserPrompt(facts, research);
  let raw: string | null = null;
  if (use === "anthropic" && hasAnthropic) raw = await callAnthropic(user);
  else if (use === "gemini" && hasGemini) raw = await callGemini(user);
  if (!raw) return null;

  try {
    return JSON.parse(stripFences(raw)) as QualitativeOut;
  } catch {
    return null;
  }
}

async function callAnthropic(user: string, systemOverride?: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemOverride ?? SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.map((c: any) => c.text || "").join("") ?? null;
  } catch {
    return null;
  }
}

async function callGemini(user: string, systemOverride?: string): Promise<string | null> {
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemOverride ?? SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ?? null;
  } catch {
    return null;
  }
}

function stripFences(s: string): string {
  return s.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// ── V3: parse a natural-language query and polish the agent's prose ──
// Numbers/scores/stars are NEVER set here — only wording.
import type { ParsedQuery } from "./types";
import { parseQueryHeuristic } from "./parse";

export async function parseQueryLLM(message: string): Promise<ParsedQuery> {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const hasA = !!process.env.ANTHROPIC_API_KEY;
  const hasG = !!process.env.GEMINI_API_KEY;
  const use = provider || (hasA ? "anthropic" : hasG ? "gemini" : "");
  if (!use) return parseQueryHeuristic(message);

  const prompt = `Extract structured search parameters from this Australian property buyer's request.
Request: "${message}"
Return ONLY JSON: {"intent":"live|invest|both","budgetMax":number|null,"budgetMin":number|null,"minYieldPct":number|null,"bedrooms":number|null,"propertyType":"house|townhouse|apartment|null","suburbs":string[],"state":"NSW|VIC|QLD|SA|WA|TAS|NT|ACT|null","requirements":string[]}`;
  const raw = use === "anthropic" && hasA ? await callAnthropic(prompt) : use === "gemini" && hasG ? await callGemini(prompt) : null;
  if (!raw) return parseQueryHeuristic(message);
  try {
    const p = JSON.parse(stripFences(raw));
    return { rawQuery: message, intent: p.intent ?? "both", budgetMax: p.budgetMax ?? null, budgetMin: p.budgetMin ?? null, minYieldPct: p.minYieldPct ?? null, bedrooms: p.bedrooms ?? null, propertyType: p.propertyType ?? null, suburbs: p.suburbs ?? [], state: p.state ?? null, requirements: p.requirements ?? [] };
  } catch {
    return parseQueryHeuristic(message);
  }
}

export async function polishChat(
  parsed: ParsedQuery,
  cards: { address: string; score: number; topFactors: string[]; strategies: string[] }[],
): Promise<{ agentNarrative: string; reasons: string[] } | null> {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const hasA = !!process.env.ANTHROPIC_API_KEY;
  const hasG = !!process.env.GEMINI_API_KEY;
  const use = provider || (hasA ? "anthropic" : hasG ? "gemini" : "");
  if (!use) return null;

  const sys = `You are a sharp Australian buyer's-advocate assistant. You are given a parsed query and pre-computed property facts/scores/strategy ratings. Write the prose ONLY — never change any number, score or star. Be specific and balanced, cite the given evidence, flag downsides. Return ONLY JSON: {"agentNarrative": string, "reasons": string[]} where reasons[i] is a 2-3 sentence recommendation rationale for card i.`;
  const user = `PARSED:\n${JSON.stringify(parsed)}\n\nCARDS:\n${JSON.stringify(cards, null, 2)}`;
  const raw = use === "anthropic" && hasA ? await callAnthropic(user, sys) : use === "gemini" && hasG ? await callGemini(user, sys) : null;
  if (!raw) return null;
  try {
    const out = JSON.parse(stripFences(raw));
    if (!out.reasons || out.reasons.length !== cards.length) return null;
    return out;
  } catch {
    return null;
  }
}
