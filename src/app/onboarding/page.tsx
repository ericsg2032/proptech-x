"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Home, TrendingUp, ArrowLeftRight, ArrowRight } from "lucide-react";
import type { IncomeBracket, LoanType, PrimaryIntent, UserProfile } from "@/lib/types";
import { Button, Field, inputClass, cn } from "@/components/ui";

const INTENTS: { id: PrimaryIntent; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "live", label: "To live in", sub: "Owner-occupier", icon: <Home className="h-4 w-4" /> },
  { id: "invest", label: "To invest", sub: "Rental / growth", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "both", label: "Live, then rent", sub: "Convert later", icon: <ArrowLeftRight className="h-4 w-4" /> },
];

export default function Onboarding() {
  const router = useRouter();
  const [address, setAddress] = React.useState("");
  const [budget, setBudget] = React.useState("1200000");
  const [depositPct, setDepositPct] = React.useState("20");
  const [intent, setIntent] = React.useState<PrimaryIntent>("both");
  const [loanType, setLoanType] = React.useState<LoanType>("PI");
  const [incomeBracket, setIncomeBracket] = React.useState<IncomeBracket | "">("");
  const [suburbs, setSuburbs] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const profile: UserProfile = {
      budget: Number(budget) || 0,
      depositPct: Number(depositPct) || 20,
      suburbs: suburbs.split(",").map((s) => s.trim()).filter(Boolean),
      primaryIntent: intent,
      loanType,
      annualIncomeBracket: incomeBracket || undefined,
    };
    sessionStorage.setItem("ptx_request", JSON.stringify({ address, profile }));
    router.push("/dashboard");
  }

  return (
    <main className="canvas-grid min-h-screen px-5 py-10">
      <div className="mx-auto max-w-lg">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ink-500 bg-ink-700/60 px-3 py-1 text-xs text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            <span className="h-1.5 w-1.5 rounded-full bg-invest" />
            PropTech-X
          </div>
          <h1 className="font-display text-3xl leading-tight text-fg">
            Read any property <span className="text-live">to live in</span> and{" "}
            <span className="text-invest">to invest</span> — at once.
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Paste an address. We assemble the data you'd spend two hours Googling into one page.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-ink-500 bg-ink-700/50 p-6">
          <Field label="Property address" hint="Anywhere in Australia — state is detected automatically.">
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 Smith St, Brunswick VIC 3056"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget (AUD)">
              <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="Deposit %">
              <input value={depositPct} onChange={(e) => setDepositPct(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-fg">Loan type</span>
              <div className="grid grid-cols-2 gap-2">
                {(["PI", "IO"] as LoanType[]).map((lt) => (
                  <button
                    type="button"
                    key={lt}
                    onClick={() => setLoanType(lt)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                      loanType === lt ? "border-brand bg-brand-dim text-fg" : "border-ink-500 bg-ink-800 text-fg-muted hover:border-ink-400",
                    )}
                  >
                    {lt === "PI" ? "P&I" : "Interest-only"}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Income (optional)" hint="Sets your tax rate for negative gearing.">
              <select
                value={incomeBracket}
                onChange={(e) => setIncomeBracket(e.target.value as IncomeBracket | "")}
                className={inputClass}
              >
                <option value="">Prefer not to say</option>
                <option value="low">Under $45k</option>
                <option value="mid">$45k–$135k</option>
                <option value="high">$135k–$190k</option>
                <option value="top">Over $190k</option>
              </select>
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-fg">What's it for?</span>
            <div className="grid grid-cols-3 gap-2">
              {INTENTS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setIntent(opt.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition",
                    intent === opt.id
                      ? "border-brand bg-brand-dim"
                      : "border-ink-500 bg-ink-800 hover:border-ink-400",
                  )}
                >
                  <span className="mb-1 flex items-center gap-1.5 text-fg">{opt.icon}</span>
                  <span className="block text-sm font-medium text-fg">{opt.label}</span>
                  <span className="block text-xs text-fg-faint">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="Preferred suburbs (optional)" hint="Comma-separated.">
            <input value={suburbs} onChange={(e) => setSuburbs(e.target.value)} placeholder="Brunswick, Coburg" className={inputClass} />
          </Field>

          <Button type="submit" className="w-full">
            Generate report <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-fg-faint">
          General information only — not financial, legal or tax advice.
        </p>
      </div>
    </main>
  );
}
