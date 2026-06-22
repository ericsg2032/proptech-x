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

async function callAnthropic(user: string): Promise<string | null> {
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
        system: SYSTEM,
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

async function callGemini(user: string): Promise<string | null> {
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
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
