"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Home, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import type { EvaluateRequest, EvaluationReport } from "@/lib/types";
import { Badge, Card, cn, fmtAUD } from "@/components/ui";
import { ThinkingTree, LiveTab, InvestTab } from "@/components/report";

const DEMO: EvaluateRequest = {
  address: "12 Smith St, Brunswick VIC 3056",
  profile: { budget: 1_200_000, depositPct: 20, suburbs: ["Brunswick"], primaryIntent: "both", loanType: "PI", annualIncomeBracket: "high" },
};

type Tab = "live" | "invest";

export default function Dashboard() {
  const router = useRouter();
  const [report, setReport] = React.useState<EvaluationReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("live");

  React.useEffect(() => {
    const stored = sessionStorage.getItem("ptx_request");
    const reqBody: EvaluateRequest = stored ? JSON.parse(stored) : DEMO;
    const started = Date.now();
    fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
        return r.json();
      })
      .then(async (data: EvaluationReport) => {
        // keep the loader visible briefly so the steps read as a sequence
        const elapsed = Date.now() - started;
        if (elapsed < 1800) await new Promise((res) => setTimeout(res, 1800 - elapsed));
        setReport(data);
        setTab(reqBody.profile.primaryIntent === "invest" ? "invest" : "live");
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Shell>
        <Card className="mx-auto max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-danger" />
          <p className="text-sm text-fg">Couldn't generate the report: {error}</p>
          <Link href="/onboarding" className="mt-4 inline-block text-sm text-brand">Try another address →</Link>
        </Card>
      </Shell>
    );
  }

  if (!report) {
    return (
      <Shell>
        <ThinkingTree done={false} />
      </Shell>
    );
  }

  const p = report.propertyInfo;
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.push("/onboarding")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> New search
        </button>

        {/* Property header */}
        <Card className="mb-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <MapPin className="h-4 w-4" /> {p.address}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl text-fg tabular">{fmtAUD(p.estimatedValue)}</span>
                {p.valueRange && (
                  <span className="text-sm text-fg-faint tabular">
                    {fmtAUD(p.valueRange.low, { compact: true })}–{fmtAUD(p.valueRange.high, { compact: true })}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg-muted">
                <Spec>{p.beds ?? "—"} bed</Spec>
                <Spec>{p.baths ?? "—"} bath</Spec>
                <Spec>{p.cars ?? "—"} car</Spec>
                <Spec>{p.landSqm ?? "—"} m²</Spec>
                <Spec>{p.state}</Spec>
              </div>
            </div>
            {report.isMock && <Badge>Demo data</Badge>}
          </div>

          {/* Planning strip */}
          <div className="mt-5 rounded-xl border border-ink-500 bg-ink-800/50 p-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-fg-faint">Planning</span>
              {report.planning.zoneCodeRaw && <Badge>{report.planning.zoneCodeRaw}</Badge>}
              {overlayBadges(report)}
            </div>
            <p className="text-sm leading-relaxed text-fg-muted">{report.planning.plainEnglish}</p>
            {report.planning.sourceUrl && (
              <a href={report.planning.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand">
                {report.planning.schemeName} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </Card>

        {/* Dual-lens tabs */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-ink-500 bg-ink-800/50 p-1.5">
          <TabButton active={tab === "live"} lens="live" onClick={() => setTab("live")} icon={<Home className="h-4 w-4" />} label="自住 · To live in" />
          <TabButton active={tab === "invest"} lens="invest" onClick={() => setTab("invest")} icon={<TrendingUp className="h-4 w-4" />} label="投资 · To invest" />
        </div>

        {tab === "live" ? <LiveTab r={report} /> : <InvestTab r={report} />}

        <p className="mt-6 text-xs leading-relaxed text-fg-faint">
          {report.disclaimer}
          <br />
          Sources: {report.dataSources.join(" · ")}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="canvas-grid min-h-screen px-5 py-10">{children}</main>;
}

function Spec({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-ink-500 bg-ink-800 px-2 py-0.5">{children}</span>;
}

function TabButton({
  active,
  lens,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  lens: "live" | "invest";
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition",
        active
          ? lens === "live"
            ? "bg-live-dim text-live"
            : "bg-invest-dim text-invest"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function overlayBadges(r: EvaluationReport) {
  const o = r.planning.overlays;
  const items: string[] = [];
  if (o.flood) items.push("Flood");
  if (o.bushfire) items.push("Bushfire");
  if (o.heritage) items.push("Heritage");
  if (o.vegetation) items.push("Vegetation");
  if (o.easement) items.push("Easement");
  return items.map((i) => <Badge key={i}>{i}</Badge>);
}
