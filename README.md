# PropTech-X — MVP

An AI property advisor for Australia. Paste an address; get a one-page,
**dual-lens** read of the same property: **自住 (owner-occupier)** vs
**投资 (investor)** — side by side, in seconds.

This is a lean, runnable MVP scaffold. **It runs with zero API keys** on
realistic mock data, so you can test the whole flow immediately, then wire real
data sources one at a time.

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## What changed vs the original blueprint (and why)

The starting blueprint had the agent **scrape `realestate.com.au` / `domain.com.au`**
via a semantic-search API to avoid paying for property data. Three problems: it's
against those sites' terms of use (REA enforces this), the data is lower quality
than the official source, and it's **unnecessary**. Two corrections are baked in:

1. **Structured property data → Domain official API** (`src/lib/domain.ts`).
   Free "innovation" tier; gives listings, comparable sales, suburb performance,
   AVM (price estimate) and rent — legally and nationally. Semantic search
   (`src/lib/research.ts`) is kept, but **only for genuinely public long-tail**
   (council news, school context, suburb profile), never for listing/sales data.

2. **Financial maths is done in code, not by the LLM** (`src/lib/cashflow.ts`).
   Gross yield, the 3-year cashflow and the negative-gearing position are
   deterministic and auditable. The LLM only writes the *qualitative* parts
   (pros/cons, plain-English planning summary, narratives).

Also: it's **national, not single-state**. Everything except statutory planning is
already national via Domain + Maps + ABS. Planning is the one fragmented layer, so
`src/lib/planning.ts` detects the state from the address and routes to that state's
official source (VicPlan, NSW Spatial Viewer, QLD SPP/DAMS, SA SAPPA, WA, TAS
PlanBuild, NT, ACT), normalising everything into one `PlanningSnapshot` shape.

---

## Architecture

```
/onboarding  ── collects address + intent ──▶ sessionStorage
/dashboard   ── POST /api/evaluate ──▶ thinking-tree loader ──▶ dual-lens report

/api/evaluate orchestrates:
  geocode (Maps) → Domain (property, comparables, suburb stats, AVM, rent)
                 → planning (state-aware, normalised)
                 → public research (Exa/Tavily, long-tail only)
                 → cashflow.ts (deterministic numbers)
                 → llm.ts (prose only)  → EvaluationReport
```

## Wiring real data (each is independent; mock until filled)

Copy `.env.local.example` to `.env.local` and add keys as you get them:

| Layer | Env | Where |
|---|---|---|
| LLM (prose only) | `ANTHROPIC_API_KEY` **or** `GEMINI_API_KEY` + `LLM_PROVIDER` | Anthropic / Google AI Studio |
| Property data | `DOMAIN_CLIENT_ID`, `DOMAIN_CLIENT_SECRET` | developer.domain.com.au |
| Geocode + commute | `GOOGLE_MAPS_API_KEY` | Google Maps Platform |
| Public research | `EXA_API_KEY` or `TAVILY_API_KEY` | exa.ai / tavily.com |

`src/lib/domain.ts` and `src/lib/planning.ts` have the real endpoints stubbed with
`TODO` markers — fill in the response parsing once your keys are provisioned.

**Domain go-live terms:** show "Powered by Domain", link out to the original
listing, and don't persist Listings data long-term.

---

## Continue in Claude Code

If you're iterating with Claude Code, hand it the corrected prompt in
[`CLAUDE_CODE_PROMPT.md`](./CLAUDE_CODE_PROMPT.md) instead of the scraping version.

## Not advice

General information only — not financial, legal or tax advice. Indicative figures.
Verify with licensed professionals. (Personalised financial/credit/tax advice in
Australia can require AFSL/ACL/TPB registration — keep this positioned as research.)
