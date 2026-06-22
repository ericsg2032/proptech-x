"use client";

import * as React from "react";
import { ShieldCheck, ShieldAlert, X, Loader2 } from "lucide-react";
import type { BudgetState, PrimaryIntent } from "@/lib/types";
import { Button, cn, fmtAUD, inputClass } from "./ui";

export function BudgetLock({ budget, onGetPreApproved }: { budget: BudgetState; onGetPreApproved: () => void }) {
  if (budget.verified && budget.amount) {
    return (
      <div className="rounded-2xl border border-invest/40 bg-invest-dim p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-invest">
          <ShieldCheck className="h-4 w-4" /> Budget verified
        </div>
        <div className="mt-1 font-display text-xl text-fg tabular">{fmtAUD(budget.amount)}</div>
        <p className="mt-1 text-xs text-fg-muted">Pre-approval locked — matches are capped at this ceiling.</p>
      </div>
    );
  }
  if (budget.amount) {
    return (
      <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-danger">
          <ShieldAlert className="h-4 w-4" /> Budget unverified
        </div>
        <div className="mt-1 font-display text-xl text-fg tabular">{fmtAUD(budget.amount)}</div>
        <p className="mt-1.5 text-xs text-fg-muted">
          This is your stated budget. Get a pre-approval so you don't fall for a home you can't finance.
        </p>
        <button
          onClick={onGetPreApproved}
          className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Get pre-approved — connect a broker
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-ink-500 bg-ink-700/50 p-4 text-xs text-fg-muted">
      Tell me your budget in the chat to start matching. I'll flag it as unverified until a broker confirms it.
    </div>
  );
}

export function BrokerModal({
  open,
  onClose,
  intent,
  suburbs,
  inputBudget,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  intent: PrimaryIntent;
  suburbs: string[];
  inputBudget: number | null;
  onSuccess: (brokerRef: string, amount: number | null) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!consent) {
      setErr("Please tick the consent box first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/broker-handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: name, email, phone, inputBudget, intent, suburbs, consent }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Something went wrong");
      onSuccess(data.brokerRef, inputBudget);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-500 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg text-fg">Connect a mortgage broker</h2>
          <button onClick={onClose} className="text-fg-faint hover:text-fg"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-fg-muted">
          A partner broker confirms how much you can actually borrow — usually within 24 hours. Then your matches lock to a real ceiling.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputClass} />

          <label className="flex items-start gap-2 rounded-xl border border-ink-500 bg-ink-700/50 p-3 text-xs text-fg-muted">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              I agree to share these details with a partner mortgage broker for the purpose of getting pre-approval.
              <strong className="text-fg"> PropTech-X may receive a referral fee.</strong> We don't advise on your loan or amount.
            </span>
          </label>

          {err && <p className="text-xs text-danger">{err}</p>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send my brief"}
          </Button>
        </form>
      </div>
    </div>
  );
}
