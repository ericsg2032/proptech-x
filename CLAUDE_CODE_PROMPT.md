# Corrected Claude Code prompt

Hand this to Claude Code instead of the original (which scraped REA/Domain).
The key changes: **Domain official API** for structured data, **Exa/Tavily for
public long-tail only**, and **financial maths in code, not in the LLM**.

---

System Persona: You are an expert full-stack engineer building a lean MVP for
"PropTech-X", an AI property advisor for the Australian market. Users enter an
address + budget and get a 2-tab comparison: Owner-Occupier (自住) vs Investor (投资).
It must be **national** (all of Australia), run on mock data with zero keys, and
look like a high-end fintech product (dark, dual-accent: warm for 自住, cool for 投资).

Stack: Next.js 14 (App Router) + TypeScript, Tailwind, Vercel.
LLM: Anthropic Claude (or Gemini) — used ONLY for qualitative prose, never numbers.

DATA LAYER — IMPORTANT, do not scrape:
- Structured property/market data → **Domain official API** (developer.domain.com.au,
  free innovation tier): listings, comparable sales, suburb performance, AVM, rent.
  OAuth2 client-credentials. This REPLACES scraping realestate.com.au / domain.com.au,
  which is against their terms.
- Planning/zoning → detect the state from the address and route to that state's
  official source (VicPlan, NSW Spatial Viewer, QLD SPP/DAMS, SA SAPPA, WA, TAS
  PlanBuild, NT, ACT). Normalise into ONE canonical `PlanningSnapshot` type.
- Public research (council news, schools, suburb lifestyle, crime context) →
  Exa/Tavily, EXCLUDING realestate.com.au / domain.com.au.
- Geocode + commute → Google Maps Platform.

FINANCIALS — in code, not the LLM:
- `lib/cashflow.ts`: gross yield = (weekly rent × 52) ÷ value; a 3-year cashflow
  using deposit→LVR, an interest-rate assumption, opex ≈ 22% of rent, and a
  negative-gearing tax estimate. The LLM must never invent or alter a number.

Build:
1. Init Next.js + TS + Tailwind. Add lucide-react.
2. `lib/types.ts` (UserProfile, EvaluationReport with propertyInfo / planning /
   ownerOccupier / investor), `lib/cashflow.ts`, `lib/planning.ts` (state detection
   + provider), `lib/domain.ts`, `lib/research.ts`, `lib/geo.ts`, `lib/llm.ts`,
   `lib/mock.ts`. Mock fallback everywhere so it runs with no keys.
3. `/onboarding` form (address, budget, deposit %, intent live/invest/both, suburbs).
4. `/dashboard`: an "agent thinking tree" loader, then 2 tabs (自住 / 投资) with the
   warm/cool accent split; investor tab includes an SVG suburb-growth chart and the
   3-year cashflow table with a negative-gearing line.
5. `src/app/api/evaluate/route.ts`: orchestrate geocode → Domain → planning →
   research → cashflow (code) → LLM (prose) → return EvaluationReport.

Keep a "general information, not financial/legal/tax advice" disclaimer in the UI.
Begin with the types and cashflow logic, then the API route, then the UI.
