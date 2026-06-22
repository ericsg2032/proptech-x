"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, SlidersHorizontal, Home, TrendingUp } from "lucide-react";
import type { ChatResponse, IncomeBracket, LoanType, PrimaryIntent, Recommendation } from "@/lib/types";
import { cn, inputClass } from "@/components/ui";
import { AgentThinking, RecommendationCard } from "@/components/recommend";

interface Msg {
  role: "user" | "agent";
  text: string;
  response?: ChatResponse;
}

const EXAMPLES = [
  "School-zone house in Brunswick under $1.2M to live in",
  "Investment with > 5.5% yield and subdivision potential",
  "4 bed family home near a train station in Melbourne",
];

export default function ChatHome() {
  const router = useRouter();
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showAssump, setShowAssump] = React.useState(false);
  const [depositPct, setDepositPct] = React.useState("20");
  const [loanType, setLoanType] = React.useState<LoanType>("PI");
  const [income, setIncome] = React.useState<IncomeBracket | "">("");
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          assumptions: { depositPct: Number(depositPct) || 20, loanType, annualIncomeBracket: income || undefined },
        }),
      });
      const data: ChatResponse = await res.json();
      setMsgs((m) => [...m, { role: "agent", text: data.agentNarrative, response: data }]);
    } catch {
      setMsgs((m) => [...m, { role: "agent", text: "Something went wrong reaching the agent. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function openReport(rec: Recommendation, intent: PrimaryIntent) {
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
    <main className="canvas-grid flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-500 bg-ink-900/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-fg">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-live" />
              <span className="h-1.5 w-1.5 rounded-full bg-invest" />
            </span>
            PropTech-X
            <span className="ml-1 text-xs font-normal text-fg-faint">buyer's agent</span>
          </div>
          <button onClick={() => setShowAssump((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Assumptions
          </button>
        </div>
        {showAssump && (
          <div className="mx-auto mt-3 grid max-w-3xl grid-cols-3 gap-2">
            <label className="text-xs text-fg-muted">
              Deposit %
              <input value={depositPct} onChange={(e) => setDepositPct(e.target.value)} inputMode="numeric" className={cn(inputClass, "mt-1 py-2")} />
            </label>
            <div className="text-xs text-fg-muted">
              Loan
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(["PI", "IO"] as LoanType[]).map((lt) => (
                  <button key={lt} onClick={() => setLoanType(lt)} className={cn("rounded-lg border py-2 text-xs", loanType === lt ? "border-brand bg-brand-dim text-fg" : "border-ink-500 text-fg-muted")}>
                    {lt === "PI" ? "P&I" : "IO"}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs text-fg-muted">
              Income
              <select value={income} onChange={(e) => setIncome(e.target.value as IncomeBracket | "")} className={cn(inputClass, "mt-1 py-2")}>
                <option value="">—</option>
                <option value="low">&lt;$45k</option>
                <option value="mid">$45–135k</option>
                <option value="high">$135–190k</option>
                <option value="top">&gt;$190k</option>
              </select>
            </label>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        {empty ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <h1 className="font-display text-3xl leading-tight text-fg">
              Tell me what you're after.
            </h1>
            <p className="mt-2 text-sm text-fg-muted">
              Describe the home in plain words — to <span className="text-live">live in</span> or <span className="text-invest">invest in</span> — and I'll shortlist real properties with the data behind each call.
            </p>
            <div className="mt-6 space-y-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => send(ex)} className="block w-full rounded-xl border border-ink-500 bg-ink-700/50 px-4 py-3 text-left text-sm text-fg-muted transition hover:border-ink-400 hover:text-fg">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="space-y-4">
                  <p className="text-sm leading-relaxed text-fg">{m.text}</p>
                  {m.response?.recommendations.map((rec, idx) => (
                    <RecommendationCard key={rec.listing.id} rec={rec} rank={idx + 1} onOpenReport={(r) => openReport(r, m.response!.parsed.intent)} />
                  ))}
                  {m.response?.isMock && (
                    <p className="text-xs text-fg-faint">Demo data — add API keys for live listings. {m.response.disclaimer}</p>
                  )}
                </div>
              ),
            )}
            {loading && <AgentThinking />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-ink-500 bg-ink-900/80 px-5 py-3 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. investment under $1M in Brunswick with good yield"
            className={inputClass}
          />
          <button type="submit" disabled={loading || !input.trim()} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand p-3 text-white transition hover:brightness-110 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
