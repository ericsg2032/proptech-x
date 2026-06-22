"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, SlidersHorizontal, Map as MapIcon } from "lucide-react";
import type { BudgetState, ChatResponse, IncomeBracket, LoanType, PrimaryIntent, Recommendation } from "@/lib/types";
import { cn, inputClass, fmtAUD } from "@/components/ui";
import { AgentThinking, RecommendationCard } from "@/components/recommend";
import { BudgetLock, BrokerModal } from "@/components/broker";
import { redactPII } from "@/lib/metrics";

interface Msg { role: "user" | "agent"; text: string }

const EXAMPLES = [
  "Investment in Melbourne under $1.2M, big land, good yield",
  "School-zone family home in Sydney to live in",
  "Brisbane investment with subdivision potential",
];

export default function Workspace() {
  const router = useRouter();
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [recs, setRecs] = React.useState<Recommendation[]>([]);
  const [intent, setIntent] = React.useState<PrimaryIntent>("both");
  const [budget, setBudget] = React.useState<BudgetState>({ amount: null, verified: false });
  const [brokerOpen, setBrokerOpen] = React.useState(false);
  const [lastQuery, setLastQuery] = React.useState("");

  // assumptions
  const [showAssump, setShowAssump] = React.useState(false);
  const [depositPct, setDepositPct] = React.useState("20");
  const [loanType, setLoanType] = React.useState<LoanType>("PI");
  const [income, setIncome] = React.useState<IncomeBracket | "">("");

  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setLastQuery(q);
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: redactPII(q), // contact PII never reaches the LLM
          verifiedBudget: budget.verified ? budget.amount : null,
          assumptions: { depositPct: Number(depositPct) || 20, loanType, annualIncomeBracket: income || undefined },
        }),
      });
      const data: ChatResponse = await res.json();
      setMsgs((m) => [...m, { role: "agent", text: data.agentNarrative }]);
      setRecs(data.recommendations);
      setIntent(data.parsed.intent);
      // capture a stated budget as Unverified (don't override a verified cap)
      if (!budget.verified && data.parsed.budgetMax) {
        setBudget({ amount: data.parsed.budgetMax, verified: false });
      }
    } catch {
      setMsgs((m) => [...m, { role: "agent", text: "Something went wrong reaching the agent. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function onBrokerSuccess(brokerRef: string, amount: number | null) {
    setBudget({ amount: amount ?? budget.amount, verified: true, brokerRef });
    setBrokerOpen(false);
    setMsgs((m) => [...m, { role: "agent", text: "Your brief's on the way to a partner broker — I've locked your budget as verified and re-matched within that ceiling." }]);
    if (lastQuery) setTimeout(() => send(lastQuery), 50);
  }

  function openReport(rec: Recommendation) {
    const profile = {
      budget: rec.estimatedValue ?? rec.listing.price ?? 1_200_000,
      depositPct: Number(depositPct) || 20,
      suburbs: [rec.listing.suburb],
      primaryIntent: intent,
      loanType,
      annualIncomeBracket: income || undefined,
    };
    sessionStorage.setItem("ptx_request", JSON.stringify({ address: rec.listing.address, profile }));
    router.push("/dashboard");
  }

  const empty = msgs.length === 0 && !loading;

  return (
    <main className="canvas-grid lg:flex lg:h-screen lg:overflow-hidden">
      {/* LEFT — conversation */}
      <section className="flex flex-col border-b border-ink-500 lg:h-screen lg:w-2/5 lg:border-b-0 lg:border-r">
        <header className="flex items-center justify-between border-b border-ink-500 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-fg">
            <span className="flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-live" /><span className="h-1.5 w-1.5 rounded-full bg-invest" /></span>
            PropTech-X <span className="text-xs font-normal text-fg-faint">buyer's agent</span>
          </div>
          <button onClick={() => setShowAssump((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Assumptions
          </button>
        </header>
        {showAssump && (
          <div className="grid grid-cols-3 gap-2 border-b border-ink-500 px-5 py-3">
            <label className="text-xs text-fg-muted">Deposit %<input value={depositPct} onChange={(e) => setDepositPct(e.target.value)} inputMode="numeric" className={cn(inputClass, "mt-1 py-2")} /></label>
            <div className="text-xs text-fg-muted">Loan<div className="mt-1 grid grid-cols-2 gap-1">{(["PI", "IO"] as LoanType[]).map((lt) => (<button key={lt} onClick={() => setLoanType(lt)} className={cn("rounded-lg border py-2 text-xs", loanType === lt ? "border-brand bg-brand-dim text-fg" : "border-ink-500 text-fg-muted")}>{lt === "PI" ? "P&I" : "IO"}</button>))}</div></div>
            <label className="text-xs text-fg-muted">Income<select value={income} onChange={(e) => setIncome(e.target.value as IncomeBracket | "")} className={cn(inputClass, "mt-1 py-2")}><option value="">—</option><option value="low">&lt;$45k</option><option value="mid">$45–135k</option><option value="high">$135–190k</option><option value="top">&gt;$190k</option></select></label>
          </div>
        )}

        <div className="space-y-5 p-5 lg:flex-1 lg:overflow-y-auto">
          {empty ? (
            <div className="py-6">
              <h1 className="font-display text-2xl leading-tight text-fg">Tell me what you're after.</h1>
              <p className="mt-2 text-sm text-fg-muted">Describe the home in plain words — to <span className="text-live">live in</span> or <span className="text-invest">invest in</span>. I'll shortlist real properties with the data behind each call.</p>
              <div className="mt-5 space-y-2">
                {EXAMPLES.map((ex) => (<button key={ex} onClick={() => send(ex)} className="block w-full rounded-xl border border-ink-500 bg-ink-700/50 px-4 py-3 text-left text-sm text-fg-muted transition hover:border-ink-400 hover:text-fg">{ex}</button>))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">{m.text}</div></div>
              ) : (
                <div key={i} className="text-sm leading-relaxed text-fg">{m.text}{recs.length > 0 && i === msgs.length - 1 && <span className="mt-1 block text-xs text-fg-faint">→ {recs.length} matches in the panel</span>}</div>
              ))}
              {loading && <AgentThinking />}
              <div ref={endRef} />
            </>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-0 flex items-center gap-2 border-t border-ink-500 bg-ink-900/90 p-3 backdrop-blur lg:static">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. investment under $1M in Brunswick" className={inputClass} />
          <button type="submit" disabled={loading || !input.trim()} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand p-3 text-white transition hover:brightness-110 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </section>

      {/* RIGHT — workspace */}
      <section className="space-y-4 p-5 lg:h-screen lg:w-3/5 lg:overflow-y-auto">
        <BudgetLock budget={budget} onGetPreApproved={() => setBrokerOpen(true)} />

        {recs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-500 p-8 text-center text-sm text-fg-faint">
            Your matched properties will appear here, ranked with data-backed reasoning.
          </div>
        ) : (
          recs.map((rec, idx) => (<RecommendationCard key={rec.listing.id} rec={rec} rank={idx + 1} intent={intent} onOpenReport={openReport} />))
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-ink-500 bg-ink-700/40 p-4 text-xs text-fg-faint">
          <MapIcon className="h-4 w-4" /> Map view arrives in Phase 2 — wired to live Domain listings.
        </div>
      </section>

      <BrokerModal open={brokerOpen} onClose={() => setBrokerOpen(false)} intent={intent} suburbs={recs.map((r) => r.listing.suburb)} inputBudget={budget.amount} onSuccess={onBrokerSuccess} />
    </main>
  );
}
